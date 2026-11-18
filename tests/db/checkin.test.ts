import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addMembership, addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// Check-in: the Manila day boundary, the expired path, and day passes.

let db: PGlite
let owner: string
let staff: string
let phoneCounter = 0

const checkIn = (userId: string, memberId: string, reason: string | null = null) =>
  as(db, userId, () => value(db, "select public.check_in($1, 'search', $2) as r", [memberId, reason]))

const newMember = (name: string) =>
  registerMember(db, staff, name, `0919${String(++phoneCounter).padStart(7, '0')}`)

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('Manila day boundary', () => {
  it('counts 11:30 PM Manila on that day, not the next', async () => {
    // 15:30 UTC is 11:30 PM in Manila (UTC+8).
    expect(await value(db, "select public.manila_date('2026-11-16 15:30:00+00')::text as r")).toBe('2026-11-16')
    expect(await value(db, "select public.manila_date('2026-11-16 16:30:00+00')::text as r")).toBe('2026-11-17')
  })

  it('stamps a late check-in with the right visit date', async () => {
    const member = await newMember('Night Owl')
    const visitDate = await value(
      db,
      `insert into public.checkins (member_id, checked_in_at, method, staff_id, status_at_checkin)
       values ($1, '2026-11-16 15:30:00+00', 'search', $2, 'active')
       returning visit_date::text as r`,
      [member, staff],
    )
    expect(visitDate).toBe('2026-11-16')
  })
})

describe('checking in', () => {
  it('lets an active member in', async () => {
    const member = await newMember('Active Member')
    await addMembership(db, member, staff, -5, 25)
    const result = await checkIn(staff, member)
    expect(result.status).toBe('active')
    expect(result.already_checked_in).toBe(false)
  })

  it('flags a membership that ends within 7 days', async () => {
    const member = await newMember('Expiring Member')
    await addMembership(db, member, staff, -27, 3)
    expect((await checkIn(staff, member)).status).toBe('expiring')
  })

  it('does not count a second tap on the same day', async () => {
    const member = await newMember('Double Tap')
    await addMembership(db, member, staff, -5, 25)
    const first = await checkIn(staff, member)
    const second = await checkIn(staff, member)
    expect(second.already_checked_in).toBe(true)
    expect(second.checkin_id).toBe(first.checkin_id)
    expect(await rows(db, 'select 1 from public.checkins where member_id = $1', [member])).toHaveLength(1)
  })
})

describe('expired members', () => {
  it('are refused when staff try to check them in', async () => {
    const member = await newMember('Expired Member')
    await addMembership(db, member, staff, -31, -1)
    await expect(checkIn(staff, member)).rejects.toThrow(/expired/i)
    await expect(checkIn(staff, member, 'he said he will pay later')).rejects.toThrow(/expired/i)
  })

  it('are refused when they never had a membership', async () => {
    const member = await newMember('Never Paid')
    await expect(checkIn(staff, member)).rejects.toThrow(/expired/i)
  })

  it('can be let in by the owner, but only with a reason, and it is recorded', async () => {
    const member = await newMember('Owner Override')
    await addMembership(db, member, staff, -31, -1)
    await expect(checkIn(owner, member)).rejects.toThrow(/reason/)

    const result = await checkIn(owner, member, 'Paying tomorrow, approved')
    expect(result.status).toBe('expired')
    const [row] = await rows(
      db,
      'select status_at_checkin, override_reason, staff_id from public.checkins where id = $1',
      [result.checkin_id],
    )
    expect(row).toEqual({
      status_at_checkin: 'expired',
      override_reason: 'Paying tomorrow, approved',
      staff_id: owner,
    })
  })

  it('can check in again after renewing', async () => {
    const member = await newMember('Renewed Member')
    await addMembership(db, member, staff, -31, -1)
    await as(db, staff, async () =>
      db.query("select public.record_membership_payment($1, $2, 'cash')", [
        member,
        await planId(db, 'regular_month'),
      ]),
    )
    expect((await checkIn(staff, member)).status).toBe('active')
  })
})

describe('day pass', () => {
  const dayPass = (guestName: string | null, memberId: string | null = null) =>
    as(db, staff, async () =>
      value(db, "select public.sell_day_pass($1, 'cash', null, $2, $3) as r", [
        await planId(db, 'regular_day'),
        guestName,
        memberId,
      ]),
    )

  it('takes payment and checks a named guest in as one action', async () => {
    const result = await dayPass('Walk-in Guest')
    expect(result.amount_centavos).toBe(8500)

    const [payment] = await rows(
      db,
      'select guest_name, member_id, amount_centavos from public.payments where id = $1',
      [result.payment_id],
    )
    expect(payment).toEqual({ guest_name: 'Walk-in Guest', member_id: null, amount_centavos: 8500 })

    const [visit] = await rows(db, 'select guest_name, status_at_checkin from public.checkins where id = $1', [
      result.checkin_id,
    ])
    expect(visit).toEqual({ guest_name: 'Walk-in Guest', status_at_checkin: 'day_pass' })
  })

  it('needs a name for a guest', async () => {
    await expect(dayPass(null)).rejects.toThrow(/guest's name or a member/)
    await expect(dayPass('  ')).rejects.toThrow(/guest's name or a member/)
  })

  it('works for a registered member whose plan has lapsed', async () => {
    const member = await newMember('Lapsed Regular')
    await addMembership(db, member, staff, -60, -30)
    await dayPass(null, member)
    const [visit] = await rows(db, 'select status_at_checkin from public.checkins where member_id = $1', [member])
    expect(visit.status_at_checkin).toBe('day_pass')
  })
})

describe('what the desk can see', () => {
  it('shows staff today only; the owner sees history', async () => {
    const member = await newMember('Old Visit')
    await db.query(
      `insert into public.checkins (member_id, checked_in_at, method, staff_id, status_at_checkin)
       values ($1, now() - interval '3 days', 'search', $2, 'active')`,
      [member, staff],
    )
    const staffView = await as(db, staff, () =>
      rows(db, 'select 1 from public.checkins where member_id = $1', [member]),
    )
    const ownerView = await as(db, owner, () =>
      rows(db, 'select 1 from public.checkins where member_id = $1', [member]),
    )
    expect(staffView).toHaveLength(0)
    expect(ownerView).toHaveLength(1)
  })

  it('lists each member with a live status', async () => {
    const active = await newMember('Overview Active')
    const expiring = await newMember('Overview Expiring')
    const expired = await newMember('Overview Expired')
    const none = await newMember('Overview None')
    await addMembership(db, active, staff, -5, 25)
    await addMembership(db, expiring, staff, -23, 7)
    await addMembership(db, expired, staff, -31, -1)

    const overview = await as(db, staff, () =>
      rows(db, 'select id, status, days_left from public.member_overview where id = any($1)', [
        [active, expiring, expired, none],
      ]),
    )
    const byId = Object.fromEntries(overview.map((row) => [row.id, row]))
    expect(byId[active]).toMatchObject({ status: 'active', days_left: 25 })
    expect(byId[expiring]).toMatchObject({ status: 'expiring', days_left: 7 })
    expect(byId[expired]).toMatchObject({ status: 'expired', days_left: -1 })
    expect(byId[none]).toMatchObject({ status: 'none', days_left: null })
  })
})
