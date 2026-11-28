import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// A member can sign in to the member app and read only their own membership,
// visits, and payments. Everything staff and owners can do stays closed to them.

let db: PGlite
let owner: string
let staff: string

/** Run `fn` as the Edge Function does: with the service role key. */
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
  await db.exec('set role service_role')
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

const issue = async (memberId: string): Promise<string> =>
  (await as(db, staff, () => value(db, 'select public.issue_member_claim_code($1) as r', [memberId]))).code

const status = (code: string) => asService(() => value(db, 'select public.member_claim_status($1) as r', [code]))
const complete = (code: string, userId: string) =>
  asService(() => db.query('select public.complete_member_claim($1, $2)', [code, userId]))

/** A member with a linked login, the way the claim flow leaves them. */
async function memberWithLogin(name: string, phone: string) {
  const memberId = await registerMember(db, staff, name, phone)
  const userId = await addUser(db, name)
  await complete(await issue(memberId), userId)
  return { memberId, userId }
}

const sell = (memberId: string, code = 'regular_month', method = 'cash', ref: string | null = null) =>
  as(db, staff, async () =>
    value(db, 'select public.record_membership_payment($1, $2, $3, $4) as r', [
      memberId,
      await planId(db, code),
      method,
      ref,
    ]),
  )

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('claim codes', () => {
  it('are made by the desk, shown once, and stored only as a hash', async () => {
    const member = await registerMember(db, staff, 'Code Carl', '09401110001')
    const code = await issue(member)
    expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/)

    const stored = await rows(db, 'select code_hash from public.member_claim_codes where member_id = $1', [member])
    expect(stored).toHaveLength(1)
    expect(stored[0].code_hash).not.toContain(code.replace('-', ''))
    expect(stored[0].code_hash).toHaveLength(64)
  })

  it('cannot be made by a member, a stranger, or someone signed out', async () => {
    const target = await registerMember(db, staff, 'Target Tina', '09401110002')
    const { userId: memberUser } = await memberWithLogin('Member Mia', '09401110003')
    const stranger = await addUser(db, 'Stranger')

    for (const who of [memberUser, stranger, null]) {
      await expect(
        as(db, who, () => db.query('select public.issue_member_claim_code($1)', [target])),
      ).rejects.toThrow()
    }
  })

  it('cannot be read or changed from the browser', async () => {
    const member = await registerMember(db, staff, 'Hidden Hal', '09401110004')
    await issue(member)
    for (const who of [staff, owner, null]) {
      await expect(as(db, who, () => rows(db, 'select * from public.member_claim_codes'))).rejects.toThrow()
      await expect(
        as(db, who, () => db.query("update public.member_claim_codes set expires_at = now() + interval '1 year'")),
      ).rejects.toThrow()
    }
  })

  it('link a login to the member, once', async () => {
    const member = await registerMember(db, staff, 'Link Lena', '09401110005')
    const user = await addUser(db, 'Lena login')
    const code = await issue(member)

    expect(await status(code)).toBe(member)
    await complete(code, user)
    expect(await value(db, 'select auth_user_id as r from public.members where id = $1', [member])).toBe(user)

    expect(await status(code)).toBeNull()
    await expect(complete(code, await addUser(db, 'Second login'))).rejects.toThrow(/Invalid or expired/)
  })

  it('accept lowercase and missing dashes, and reject wrong codes', async () => {
    const member = await registerMember(db, staff, 'Loose Lou', '09401110006')
    const code = await issue(member)
    expect(await status(code.toLowerCase().replace('-', ' '))).toBe(member)
    expect(await status('AAAAA-AAAAA')).toBeNull()
    expect(await status('')).toBeNull()
  })

  it('expire after 48 hours', async () => {
    const member = await registerMember(db, staff, 'Late Lia', '09401110007')
    const code = await issue(member)
    const [row] = await rows(db, 'select expires_at, created_at from public.member_claim_codes where member_id = $1', [member])
    const hours = (new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000
    expect(Math.round(hours)).toBe(48)

    await db.query("update public.member_claim_codes set expires_at = now() - interval '1 minute' where member_id = $1", [member])
    expect(await status(code)).toBeNull()
    await expect(complete(code, await addUser(db, 'Late login'))).rejects.toThrow(/Invalid or expired/)
  })

  it('are replaced when the desk makes a new one', async () => {
    const member = await registerMember(db, staff, 'Twice Tim', '09401110008')
    const first = await issue(member)
    const second = await issue(member)
    expect(await status(first)).toBeNull()
    expect(await status(second)).toBe(member)
  })

  it('are refused for a member who already has an account or was deleted', async () => {
    const { memberId } = await memberWithLogin('Done Dan', '09401110009')
    await expect(as(db, staff, () => db.query('select public.issue_member_claim_code($1)', [memberId]))).rejects.toThrow(
      /already has an app account/,
    )

    const gone = await registerMember(db, staff, 'Gone Gus', '09401110010')
    const code = await issue(gone)
    await as(db, owner, () => db.query("select public.delete_member_data($1, 'Member asked')", [gone]))
    expect(await status(code)).toBeNull()
    await expect(as(db, staff, () => db.query('select public.issue_member_claim_code($1)', [gone]))).rejects.toThrow(/not found/)
  })

  it('cannot link a desk account to a member', async () => {
    const member = await registerMember(db, staff, 'Mixed Max', '09401110011')
    await expect(complete(await issue(member), staff)).rejects.toThrow(/desk team/)
  })

  it('can only be checked or completed with the service role', async () => {
    const member = await registerMember(db, staff, 'Closed Cleo', '09401110012')
    const code = await issue(member)
    const user = await addUser(db, 'Cleo login')
    for (const who of [staff, owner, user, null]) {
      await expect(as(db, who, () => db.query('select public.member_claim_status($1)', [code]))).rejects.toThrow()
      await expect(as(db, who, () => db.query('select public.complete_member_claim($1, $2)', [code, user]))).rejects.toThrow()
    }
  })
})

describe('what a member can read', () => {
  it('shows their own status', async () => {
    const { memberId, userId } = await memberWithLogin('Active Ally', '09402220001')
    await sell(memberId)

    const [me] = await as(db, userId, () => rows(db, 'select * from public.my_status()'))
    expect(me.full_name).toBe('Active Ally')
    expect(me.plan_name).toMatch(/month/i)
    expect(me.status).toBe('active')
    expect(me.days_left).toBeGreaterThan(7)
  })

  it('shows "none" before a first purchase, and expired after the end date', async () => {
    const fresh = await memberWithLogin('Fresh Fay', '09402220002')
    const [none] = await as(db, fresh.userId, () => rows(db, 'select * from public.my_status()'))
    expect(none.status).toBe('none')
    expect(none.valid_until).toBeNull()

    const lapsed = await memberWithLogin('Lapsed Lee', '09402220003')
    await sell(lapsed.memberId)
    await db.query(
      `update public.memberships
       set start_date = public.manila_today() - 40, end_date = public.manila_today() - 5
       where member_id = $1`,
      [lapsed.memberId],
    )
    const [old] = await as(db, lapsed.userId, () => rows(db, 'select * from public.my_status()'))
    expect(old.status).toBe('expired')
    expect(old.days_left).toBe(-5)
  })

  it('shows expiring when 7 days or fewer are left', async () => {
    const m = await memberWithLogin('Soon Sal', '09402220004')
    await sell(m.memberId)
    await db.query('update public.memberships set end_date = public.manila_today() + 3 where member_id = $1', [m.memberId])
    const [me] = await as(db, m.userId, () => rows(db, 'select * from public.my_status()'))
    expect(me.status).toBe('expiring')
    expect(me.days_left).toBe(3)
  })

  it('ignores a voided membership', async () => {
    const m = await memberWithLogin('Voided Val', '09402220005')
    const sale = await sell(m.memberId)
    await as(db, owner, () => db.query("select public.void_payment($1, 'Entered by mistake')", [sale.payment_id]))
    const [me] = await as(db, m.userId, () => rows(db, 'select * from public.my_status()'))
    expect(me.status).toBe('none')
  })

  it('shows only their own visits', async () => {
    const a = await memberWithLogin('Visit Vic', '09402220006')
    const b = await memberWithLogin('Other Ola', '09402220007')
    await sell(a.memberId)
    await sell(b.memberId)
    await as(db, staff, () => db.query("select public.check_in($1, 'search')", [a.memberId]))
    await as(db, staff, () => db.query("select public.check_in($1, 'search')", [b.memberId]))

    const mine = await as(db, a.userId, () => rows(db, 'select * from public.my_visits()'))
    expect(mine).toHaveLength(1)
    expect(Object.keys(mine[0]).sort()).toEqual(['checked_in_at', 'visit_date'])
    const total = await value(db, 'select count(*)::int as r from public.checkins where member_id in ($1, $2)', [a.memberId, b.memberId])
    expect(total).toBe(2)
  })

  it('shows their payments without the GCash reference, staff, or voided rows', async () => {
    const m = await memberWithLogin('Pay Pia', '09402220008')
    await sell(m.memberId, 'regular_month', 'gcash', 'GC1234567890')
    const mistake = await sell(m.memberId, 'regular_month', 'cash')
    await as(db, owner, () => db.query("select public.void_payment($1, 'Wrong plan')", [mistake.payment_id]))

    const list = await as(db, m.userId, () => rows(db, 'select * from public.my_payments()'))
    expect(list).toHaveLength(1)
    expect(Object.keys(list[0]).sort()).toEqual(['amount_centavos', 'method', 'paid_at', 'plan_name'])
    expect(list[0].method).toBe('gcash')
    expect(list[0].amount_centavos).toBe(95000)
    expect(JSON.stringify(list)).not.toContain('GC1234567890')
  })

  it('caps the list size', async () => {
    const m = await memberWithLogin('Cap Cai', '09402220009')
    await expect(as(db, m.userId, () => rows(db, 'select * from public.my_visits(100000)'))).resolves.toEqual([])
    await expect(as(db, m.userId, () => rows(db, 'select * from public.my_payments(-5)'))).resolves.toEqual([])
  })

  it('gives staff, the owner, strangers, and signed-out visitors nothing', async () => {
    const stranger = await addUser(db, 'Stranger Sam')
    for (const who of [staff, owner, stranger]) {
      expect(await as(db, who, () => rows(db, 'select * from public.my_status()'))).toEqual([])
      expect(await as(db, who, () => rows(db, 'select * from public.my_visits()'))).toEqual([])
      expect(await as(db, who, () => rows(db, 'select * from public.my_payments()'))).toEqual([])
    }
    await expect(as(db, null, () => rows(db, 'select * from public.my_status()'))).rejects.toThrow()
    await expect(as(db, null, () => rows(db, 'select * from public.my_payments()'))).rejects.toThrow()
  })

  it('stops working when the owner deletes the member’s data', async () => {
    const m = await memberWithLogin('Erased Eli', '09402220010')
    await sell(m.memberId)
    expect(await as(db, m.userId, () => rows(db, 'select * from public.my_status()'))).toHaveLength(1)

    await as(db, owner, () => db.query("select public.delete_member_data($1, 'Member asked')", [m.memberId]))
    expect(await as(db, m.userId, () => rows(db, 'select * from public.my_status()'))).toEqual([])
    expect(await as(db, m.userId, () => rows(db, 'select * from public.my_payments()'))).toEqual([])
  })
})

describe('what a member cannot do', () => {
  it('reads no table or view directly', async () => {
    const { userId } = await memberWithLogin('Snoop Sid', '09403330001')
    await sell((await rows(db, "select id from public.members where full_name = 'Snoop Sid'"))[0].id)

    const relations = await rows(
      db,
      `select c.relname
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v', 'p')`,
    )
    expect(relations.length).toBeGreaterThan(10)

    for (const { relname } of relations) {
      let seen = 0
      try {
        const result = await as(db, userId, () => rows(db, `select count(*)::int as n from public."${relname}"`))
        seen = result[0].n
      } catch {
        seen = 0 // "permission denied" is as closed as it gets
      }
      expect(seen, `a member can read ${relname}`).toBe(0)
    }
  })

  it('cannot write to any table directly', async () => {
    const { userId, memberId } = await memberWithLogin('Writer Wes', '09403330002')
    await expect(
      as(db, userId, () => db.query("update public.members set full_name = 'Hacked' where id = $1", [memberId])),
    ).resolves.toMatchObject({ affectedRows: 0 })
    await expect(
      as(db, userId, () => db.query('update public.members set auth_user_id = null where id = $1', [memberId])),
    ).rejects.toThrow()
    await expect(
      as(db, userId, () => db.query('delete from public.payments')),
    ).rejects.toThrow()
    await expect(
      as(db, userId, () => db.query("insert into public.expenses (category, amount_centavos, spent_on, recorded_by) values ('Rent', 100, now(), $1)", [userId])),
    ).rejects.toThrow()
    expect(await value(db, 'select full_name as r from public.members where id = $1', [memberId])).toBe('Writer Wes')
  })

  it('is refused every desk and owner action', async () => {
    const { userId, memberId } = await memberWithLogin('Sneaky Sue', '09403330003')
    const plan = await planId(db, 'regular_month')
    const calls: [string, unknown[]][] = [
      ["select public.register_member('Fake Person', '09999999999', true)", []],
      ["select public.record_membership_payment($1, $2, 'cash', null)", [memberId, plan]],
      ["select public.check_in($1, 'search', null)", [memberId]],
      ["select public.close_day(0, 0, null)", []],
      ["select public.delete_member_data($1, 'Because')", [memberId]],
      ["select public.void_payment($1, 'Because')", [memberId]],
      ["select public.issue_member_claim_code($1)", [memberId]],
    ]
    for (const [sql, params] of calls) {
      await expect(as(db, userId, () => db.query(sql, params)), sql).rejects.toThrow()
    }
  })

  it('gets no owner numbers', async () => {
    const { userId } = await memberWithLogin('Nosy Nat', '09403330004')
    for (const sql of [
      'select * from public.analytics_daily(14)',
      'select * from public.analytics_money(14)',
      'select * from public.analytics_plans(14)',
      'select * from public.analytics_monthly(6)',
      'select * from public.activity_feed(50)',
    ]) {
      let seen = 0
      try {
        seen = (await as(db, userId, () => rows(db, sql))).length
      } catch {
        seen = 0
      }
      expect(seen, sql).toBe(0)
    }
  })

  it('is not treated as staff or owner', async () => {
    const { userId } = await memberWithLogin('Plain Pat', '09403330005')
    expect(await as(db, userId, () => value(db, 'select public.is_staff() as r'))).toBe(false)
    expect(await as(db, userId, () => value(db, 'select public.is_owner() as r'))).toBe(false)
  })
})
