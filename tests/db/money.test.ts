import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// Phase 2: voids, closing the day, expenses, and the owner's money totals.

let db: PGlite
let owner: string
let staff: string
let phoneCounter = 0

const newMember = (name: string) =>
  registerMember(db, staff, name, `0920${String(++phoneCounter).padStart(7, '0')}`)

const sell = (memberId: string, plan: string, method = 'cash', ref: string | null = null) =>
  as(db, staff, async () =>
    value(db, 'select public.record_membership_payment($1, $2, $3, $4) as r', [
      memberId,
      await planId(db, plan),
      method,
      ref,
    ]),
  )

const money = (userId: string) =>
  as(db, userId, () =>
    rows(
      db,
      `select revenue_centavos::int as revenue, cash_centavos::int as cash, gcash_centavos::int as gcash,
              expenses_centavos::int as expenses, void_count::int as voids
       from public.analytics_money(7)`,
    ),
  )

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('voiding a payment', () => {
  it('is refused for staff', async () => {
    const sale = await sell(await newMember('Staff Void Attempt'), 'regular_month')
    await expect(
      as(db, staff, () => db.query("select public.void_payment($1, 'Wrong plan')", [sale.payment_id])),
    ).rejects.toThrow(/Only the owner/)
  })

  it('needs a reason', async () => {
    const sale = await sell(await newMember('No Reason'), 'regular_month')
    await expect(
      as(db, owner, () => db.query("select public.void_payment($1, ' ')", [sale.payment_id])),
    ).rejects.toThrow(/reason/)
  })

  it('keeps the row, records who and why, and cancels the membership', async () => {
    const member = await newMember('Voided Sale')
    const sale = await sell(member, 'regular_month')
    await as(db, owner, () => db.query("select public.void_payment($1, 'Entered twice')", [sale.payment_id]))

    const [payment] = await rows(db, 'select voided_by, void_reason from public.payments where id = $1', [
      sale.payment_id,
    ])
    expect(payment).toEqual({ voided_by: owner, void_reason: 'Entered twice' })

    // With the membership cancelled, the member has no valid plan again.
    const [overview] = await rows(db, 'select status from public.member_overview where id = $1', [member])
    expect(overview.status).toBe('none')

    const [entry] = await rows(
      db,
      "select actor from public.audit_log where table_name = 'payments' and row_id = $1 and action = 'update'",
      [sale.payment_id],
    )
    expect(entry.actor).toBe(owner)
  })

  it('cannot be done twice', async () => {
    const sale = await sell(await newMember('Double Void'), 'regular_month')
    const voidIt = () =>
      as(db, owner, () => db.query("select public.void_payment($1, 'Mistake')", [sale.payment_id]))
    await voidIt()
    await expect(voidIt()).rejects.toThrow(/already voided/)
  })

  it('frees the GCash reference so the payment can be entered again', async () => {
    const member = await newMember('Reference Retry')
    const first = await sell(member, 'regular_month', 'gcash', '9001234567')
    await as(db, owner, () => db.query("select public.void_payment($1, 'Wrong plan')", [first.payment_id]))
    const second = await sell(member, 'promo_2m', 'gcash', '9001234567')
    expect(second.amount_centavos).toBe(170000)
  })
})

describe('money totals', () => {
  it('adds revenue by method, leaves out voids, and counts them', async () => {
    const [before] = await money(owner)
    const kept = await sell(await newMember('Cash Sale'), 'regular_month')
    await sell(await newMember('GCash Sale'), 'promo_2m', 'gcash', '9007654321')
    const voided = await sell(await newMember('To Be Voided'), 'promo_3m')
    await as(db, owner, () => db.query("select public.void_payment($1, 'Test void')", [voided.payment_id]))

    const [after] = await money(owner)
    expect(after.revenue - before.revenue).toBe(95000 + 170000)
    expect(after.cash - before.cash).toBe(95000)
    expect(after.gcash - before.gcash).toBe(170000)
    expect(after.voids - before.voids).toBe(1)
    expect(kept.amount_centavos).toBe(95000)
  })

  it('subtracts nothing for a voided expense', async () => {
    const add = (category: string, amount: number) =>
      as(db, owner, () =>
        value(
          db,
          `insert into public.expenses (category, amount_centavos, spent_on, recorded_by)
           values ($1, $2, public.manila_today(), $3) returning id as r`,
          [category, amount, owner],
        ),
      )
    await add('Electricity', 450000)
    const mistake = await add('Typo', 999900)
    await as(db, owner, () => db.query("select public.void_expense($1, 'Typed wrong amount')", [mistake]))

    expect((await money(owner))[0].expenses).toBe(450000)
    await expect(
      as(db, staff, () => db.query("select public.void_expense($1, 'Not mine to void')", [mistake])),
    ).rejects.toThrow(/Only the owner/)
  })

  it('ranks plans by revenue', async () => {
    const plans = await as(db, owner, () =>
      rows(db, 'select plan_name, revenue_centavos::int as revenue from public.analytics_plans(7)'),
    )
    expect(plans.length).toBeGreaterThan(1)
    expect(plans.map((row) => row.revenue)).toEqual([...plans.map((row) => row.revenue)].sort((a, b) => b - a))
  })

  it('gives staff no totals', async () => {
    expect(await money(staff)).toHaveLength(0)
    expect(await as(db, staff, () => rows(db, 'select * from public.analytics_plans(7)'))).toHaveLength(0)
  })
})

describe('closing the day', () => {
  it('tells staff only that the day is closed, and stores the comparison for the owner', async () => {
    expect(await as(db, staff, () => value(db, 'select public.is_day_closed() as r'))).toBe(false)

    const [expected] = await money(owner)
    const result = await as(db, staff, () =>
      value(db, "select public.close_day($1, $2, 'Drawer short by 50') as r", [expected.cash - 5000, expected.gcash]),
    )
    // No expected amounts in what staff get back.
    expect(Object.keys(result)).toEqual(['close_date'])
    expect(await as(db, staff, () => value(db, 'select public.is_day_closed() as r'))).toBe(true)

    // Staff cannot read the close, even their own.
    expect(await as(db, staff, () => rows(db, 'select * from public.daily_closes'))).toHaveLength(0)

    const [close] = await as(db, owner, () =>
      rows(
        db,
        `select counted_cash_centavos - expected_cash_centavos as cash_diff,
                counted_gcash_centavos - expected_gcash_centavos as gcash_diff, closed_by, note
         from public.daily_closes`,
      ),
    )
    expect(close).toEqual({ cash_diff: -5000, gcash_diff: 0, closed_by: staff, note: 'Drawer short by 50' })
  })

  it('cannot close the same day twice', async () => {
    await expect(as(db, owner, () => db.query('select public.close_day(0, 0)'))).rejects.toThrow(/already closed/)
  })

  it('rejects a missing or negative count', async () => {
    await expect(as(db, staff, () => db.query('select public.close_day(-1, 0)'))).rejects.toThrow(/counted cash/)
    await expect(as(db, staff, () => db.query('select public.close_day(null, 0)'))).rejects.toThrow(/counted cash/)
  })
})
