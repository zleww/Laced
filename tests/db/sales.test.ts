import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addMembership, addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// Selling and renewing: prices come from the database, dates follow the gym's
// counting rule, and a failed payment leaves nothing half-written.

let db: PGlite
let staff: string
let phoneCounter = 0

const sell = (memberId: string, plan: string, method = 'cash', ref: string | null = null, idChecked = false) =>
  as(db, staff, () =>
    value(db, 'select public.record_membership_payment($1, $2, $3, $4, $5) as r', [
      memberId,
      plan,
      method,
      ref,
      idChecked,
    ]),
  )

const newMember = (name: string) =>
  registerMember(db, staff, name, `0918${String(++phoneCounter).padStart(7, '0')}`)

beforeAll(async () => {
  db = await createDatabase()
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('membership dates', () => {
  it('counts the end date inclusively: Nov 16 + 1 month ends Dec 15', async () => {
    expect(await value(db, "select public.membership_end('2026-11-16', 1)::text as r")).toBe('2026-12-15')
  })

  it('gives 13 months for the yearly promo', async () => {
    expect(await value(db, "select public.membership_end('2026-11-16', 13)::text as r")).toBe('2027-12-15')
  })

  it('handles month ends without overflowing', async () => {
    expect(await value(db, "select public.membership_end('2026-03-01', 1)::text as r")).toBe('2026-03-31')
    expect(await value(db, "select public.membership_end('2026-01-31', 1)::text as r")).toBe('2026-02-27')
  })
})

describe('price integrity', () => {
  it('charges the plan price from the database', async () => {
    const member = await newMember('Price Check')
    const sale = await sell(member, await planId(db, 'promo_3m'))
    expect(sale.amount_centavos).toBe(255000)
    expect(
      await value(db, 'select amount_centavos as r from public.payments where id = $1', [sale.payment_id]),
    ).toBe(255000)
  })

  it('has no way to pass an amount', async () => {
    const member = await newMember('Tamper Attempt')
    await expect(
      as(db, staff, async () =>
        db.query("select public.record_membership_payment($1, $2, 'cash', null, false, 100)", [
          member,
          await planId(db, 'regular_month'),
        ]),
      ),
    ).rejects.toThrow(/does not exist/)
  })
})

describe('new, renewal, and returning', () => {
  it('starts a first membership today', async () => {
    const member = await newMember('First Timer')
    const sale = await sell(member, await planId(db, 'regular_month'))
    expect(sale.kind).toBe('new')
    expect(sale.start_date).toBe(await value(db, 'select public.manila_today()::text as r'))
    expect(sale.end_date).toBe(
      await value(db, 'select public.membership_end(public.manila_today(), 1)::text as r'),
    )
  })

  it('starts an early renewal the day after the current one ends', async () => {
    const member = await newMember('Early Bird')
    const first = await sell(member, await planId(db, 'regular_month'))
    const second = await sell(member, await planId(db, 'regular_month'))
    expect(second.kind).toBe('renewal')
    expect(second.start_date).toBe(await value(db, 'select ($1::date + 1)::text as r', [first.end_date]))
  })

  it('treats a lapse of a few days as a renewal starting today', async () => {
    const member = await newMember('Slightly Late')
    await addMembership(db, member, staff, -33, -3)
    const sale = await sell(member, await planId(db, 'regular_month'))
    expect(sale.kind).toBe('renewal')
    expect(sale.start_date).toBe(await value(db, 'select public.manila_today()::text as r'))
  })

  it('marks a long lapse as returning', async () => {
    const member = await newMember('Long Gone')
    await addMembership(db, member, staff, -70, -40)
    const sale = await sell(member, await planId(db, 'regular_month'))
    expect(sale.kind).toBe('returning')
  })

  it('adds the free month to the yearly promo', async () => {
    const member = await newMember('Yearly Buyer')
    const sale = await sell(member, await planId(db, 'promo_1y'))
    expect(sale.end_date).toBe(
      await value(db, 'select public.membership_end(public.manila_today(), 13)::text as r'),
    )
    expect(sale.amount_centavos).toBe(900000)
  })
})

describe('payment rules', () => {
  it('requires a reference number for GCash', async () => {
    const member = await newMember('No Ref')
    await expect(sell(member, await planId(db, 'regular_month'), 'gcash')).rejects.toThrow(
      /GCash reference number/,
    )
  })

  it('rejects a GCash reference that was already recorded, and writes nothing', async () => {
    const first = await newMember('Ref Owner')
    const second = await newMember('Ref Copier')
    const plan = await planId(db, 'regular_month')
    await sell(first, plan, 'gcash', '1002 345 678 901')

    await expect(sell(second, plan, 'gcash', '1002345678901')).rejects.toThrow(/already recorded/)
    // The membership row must be rolled back together with the failed payment.
    expect(
      await rows(db, 'select 1 from public.memberships where member_id = $1', [second]),
    ).toHaveLength(0)
  })

  it('stores no reference for cash', async () => {
    const member = await newMember('Cash Payer')
    const sale = await sell(member, await planId(db, 'regular_month'), 'cash', 'ignored-ref')
    expect(
      await value(db, 'select gcash_ref as r from public.payments where id = $1', [sale.payment_id]),
    ).toBeNull()
  })

  it('needs the school ID tick for a student plan', async () => {
    const member = await newMember('Student One')
    const plan = await planId(db, 'student_month')
    await expect(sell(member, plan)).rejects.toThrow(/school ID/)
    const sale = await sell(member, plan, 'cash', null, true)
    expect(sale.amount_centavos).toBe(85000)
  })

  it('refuses a day plan here', async () => {
    const member = await newMember('Day Plan Mixup')
    await expect(sell(member, await planId(db, 'regular_day'))).rejects.toThrow(/day pass action/)
  })

  it('writes every sale to the audit log with the staff member who made it', async () => {
    const member = await newMember('Audited Sale')
    const sale = await sell(member, await planId(db, 'regular_month'))
    const [entry] = await rows(
      db,
      "select action, actor from public.audit_log where table_name = 'payments' and row_id = $1",
      [sale.payment_id],
    )
    expect(entry).toEqual({ action: 'insert', actor: staff })
  })
})

describe('registering a member', () => {
  it('stores +63 numbers in the 09 format', async () => {
    const result = await as(db, staff, () =>
      value(db, "select public.register_member('Plus Sixty Three', '+63 917 555 0001', true) as r"),
    )
    expect(await value(db, 'select phone as r from public.members where id = $1', [result.member_id])).toBe(
      '09175550001',
    )
  })

  it('rejects a bad number, a duplicate number, and missing consent', async () => {
    const register = (name: string, phone: string, consent: boolean) =>
      as(db, staff, () => db.query('select public.register_member($1, $2, $3)', [name, phone, consent]))

    await expect(register('Short Number', '0917123', true)).rejects.toThrow(/11-digit/)
    await expect(register('Same Number', '09175550001', true)).rejects.toThrow(/already registered/)
    await expect(register('No Consent', '09175550002', false)).rejects.toThrow(/consent/)
  })
})
