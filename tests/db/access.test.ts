import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// Who can see and change what. These are the rules that keep revenue private
// and stop anyone from editing money records directly.

let db: PGlite
let owner: string
let staffA: string
let staffB: string
let stranger: string
let monthly: string

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staffA = await addUser(db, 'Ana Staff', 'staff')
  staffB = await addUser(db, 'Ben Staff', 'staff')
  stranger = await addUser(db, 'No Staff Row')
  monthly = await planId(db, 'regular_month')

  const memberA = await registerMember(db, staffA, 'Member One', '09170000001')
  const memberB = await registerMember(db, staffB, 'Member Two', '09170000002')
  await as(db, staffA, () =>
    db.query("select public.record_membership_payment($1, $2, 'cash')", [memberA, monthly]),
  )
  await as(db, staffB, () =>
    db.query("select public.record_membership_payment($1, $2, 'cash')", [memberB, monthly]),
  )
  await as(db, owner, () =>
    db.query(
      `insert into public.expenses (category, amount_centavos, spent_on, recorded_by)
       values ('Electricity', 450000, public.manila_today(), $1)`,
      [owner],
    ),
  )
})

describe('signed-out visitors', () => {
  it('cannot read any table', async () => {
    for (const table of ['members', 'payments', 'plans', 'expenses', 'staff', 'checkins', 'audit_log']) {
      await expect(as(db, null, () => rows(db, `select * from public.${table}`))).rejects.toThrow(
        /permission denied/,
      )
    }
  })

  it('cannot call any action', async () => {
    await expect(
      as(db, null, () => rows(db, "select public.register_member('Eve Outsider', '09170000009', true)")),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('a login with no staff row', () => {
  it('sees no rows and cannot act', async () => {
    expect(await as(db, stranger, () => rows(db, 'select * from public.members'))).toHaveLength(0)
    expect(await as(db, stranger, () => rows(db, 'select * from public.plans'))).toHaveLength(0)
    await expect(
      as(db, stranger, () => rows(db, "select public.register_member('Eve Outsider', '09170000009', true)")),
    ).rejects.toThrow(/Not allowed/)
  })
})

describe('staff cannot see the money picture', () => {
  it('cannot read expenses', async () => {
    expect(await as(db, staffA, () => rows(db, 'select * from public.expenses'))).toHaveLength(0)
    expect(await as(db, owner, () => rows(db, 'select * from public.expenses'))).toHaveLength(1)
  })

  it('sees only the payments they collected, not the gym total', async () => {
    const mine = await as(db, staffA, () => rows(db, 'select received_by from public.payments'))
    expect(mine).toHaveLength(1)
    expect(mine[0].received_by).toBe(staffA)
    expect(await as(db, owner, () => rows(db, 'select * from public.payments'))).toHaveLength(2)
  })

  it('cannot read the audit log', async () => {
    expect(await as(db, staffA, () => rows(db, 'select * from public.audit_log'))).toHaveLength(0)
    const ownerView = await as(db, owner, () => rows(db, 'select * from public.audit_log'))
    expect(ownerView.length).toBeGreaterThan(0)
  })

  it('sees only their own staff row', async () => {
    const visible = await as(db, staffA, () => rows(db, 'select id from public.staff'))
    expect(visible.map((row) => row.id)).toEqual([staffA])
    expect(await as(db, owner, () => rows(db, 'select id from public.staff'))).toHaveLength(3)
  })

  it('cannot record an expense', async () => {
    await expect(
      as(db, staffA, () =>
        db.query(
          `insert into public.expenses (category, amount_centavos, spent_on, recorded_by)
           values ('Snacks', 1000, public.manila_today(), $1)`,
          [staffA],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
  })
})

describe('money records cannot be edited directly', () => {
  it('rejects a direct payment insert, even from the owner', async () => {
    for (const user of [staffA, owner]) {
      await expect(
        as(db, user, () =>
          db.query(
            `insert into public.payments (guest_name, plan_id, amount_centavos, method, received_by)
             values ('Cheap Guest', $1, 100, 'cash', $2)`,
            [monthly, user],
          ),
        ),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('rejects changing or deleting a payment', async () => {
    await expect(
      as(db, staffA, () => db.query('update public.payments set amount_centavos = 1')),
    ).rejects.toThrow(/permission denied/)
    await expect(as(db, owner, () => db.query('delete from public.payments'))).rejects.toThrow(
      /permission denied/,
    )
  })

  it('lets only the owner change a price', async () => {
    await as(db, staffA, () =>
      db.query('update public.plans set price_centavos = 100 where id = $1', [monthly]),
    )
    expect(await value(db, 'select price_centavos as r from public.plans where id = $1', [monthly])).toBe(95000)

    await as(db, owner, () =>
      db.query('update public.plans set price_centavos = 99000 where id = $1', [monthly]),
    )
    expect(await value(db, 'select price_centavos as r from public.plans where id = $1', [monthly])).toBe(99000)
  })
})

describe('offboarding', () => {
  it('cuts off a deactivated staff account at once', async () => {
    expect(await as(db, staffB, () => rows(db, 'select * from public.members'))).not.toHaveLength(0)
    await as(db, owner, () => db.query('update public.staff set active = false where id = $1', [staffB]))
    expect(await as(db, staffB, () => rows(db, 'select * from public.members'))).toHaveLength(0)
  })
})
