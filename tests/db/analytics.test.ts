import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, planId, registerMember, rows } from './helpers'

// The owner dashboard's daily totals: correct numbers, and owner-only.

let db: PGlite
let owner: string
let staff: string

const daily = (userId: string | null, days = 7) =>
  as(db, userId, () =>
    rows(
      db,
      `select day::text, revenue_centavos::int as revenue, checkins::int as checkins
       from public.analytics_daily($1)`,
      [days],
    ),
  )

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')

  const member = await registerMember(db, staff, 'Paying Member', '09170000001')
  await as(db, staff, async () => {
    await db.query("select public.record_membership_payment($1, $2, 'cash')", [
      member,
      await planId(db, 'regular_month'),
    ])
    await db.query("select public.check_in($1, 'search')", [member])
    await db.query("select public.sell_day_pass($1, 'cash', null, 'Walk-in Guest')", [
      await planId(db, 'regular_day'),
    ])
  })
  // A visit three days ago, to check that each day gets its own row.
  await db.query(
    `insert into public.checkins (guest_name, checked_in_at, method, staff_id, status_at_checkin)
     values ('Earlier Guest', now() - interval '3 days', 'search', $1, 'day_pass')`,
    [staff],
  )
})

describe('analytics_daily', () => {
  it('returns one row per day, oldest first, ending today', async () => {
    const result = await daily(owner, 7)
    expect(result).toHaveLength(7)
    const [today] = await rows(db, 'select public.manila_today()::text as day')
    expect(result[6].day).toBe(today.day)
    expect(result.map((row) => row.day)).toEqual([...result.map((row) => row.day)].sort())
  })

  it("adds up today's money and visits", async () => {
    const result = await daily(owner, 7)
    // Monthly ₱950 + day pass ₱85; one member check-in + one guest check-in.
    expect(result[6]).toMatchObject({ revenue: 95000 + 8500, checkins: 2 })
    expect(result[3]).toMatchObject({ revenue: 0, checkins: 1 })
    expect(result[5]).toMatchObject({ revenue: 0, checkins: 0 })
  })

  it('leaves voided payments out of revenue', async () => {
    await db.query(
      `update public.payments set voided_at = now(), voided_by = $1, void_reason = 'Entered twice'
       where guest_name = 'Walk-in Guest'`,
      [owner],
    )
    expect((await daily(owner, 7))[6].revenue).toBe(95000)
  })

  it('gives staff nothing', async () => {
    expect(await daily(staff)).toHaveLength(0)
  })

  it('refuses signed-out visitors', async () => {
    await expect(daily(null)).rejects.toThrow(/permission denied/)
  })
})
