import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, registerMember, rows, value } from './helpers'

// Two-step sign-in: with an authenticator app turned on, a password alone opens nothing.

let db: PGlite
let owner: string
let staff: string

/** Act as a user at a given sign-in level: "aal1" after a password, "aal2" after the code too. */
async function atLevel<T>(userId: string, aal: 'aal1' | 'aal2', fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ aal })])
  try {
    return await as(db, userId, fn)
  } finally {
    await db.query("select set_config('request.jwt.claims', '', false)")
  }
}

const powers = (userId: string, aal: 'aal1' | 'aal2') =>
  atLevel(userId, aal, () =>
    value(db, 'select json_build_object(\'staff\', public.is_staff(), \'owner\', public.is_owner()) as r'),
  )

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
  await registerMember(db, staff, 'Some Member', '09401110001')
})

describe('two-step sign-in', () => {
  it('changes nothing for an account without an authenticator app', async () => {
    expect(await powers(owner, 'aal1')).toEqual({ staff: true, owner: true })
  })

  it('needs the code once an authenticator app is turned on', async () => {
    await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner])

    expect(await powers(owner, 'aal1')).toEqual({ staff: false, owner: false })
    expect(await powers(owner, 'aal2')).toEqual({ staff: true, owner: true })

    // With only the password, the members list and the money are closed.
    const members = await atLevel(owner, 'aal1', () => rows(db, 'select id from public.member_overview'))
    expect(members).toEqual([])
    const money = await atLevel(owner, 'aal1', () => rows(db, 'select * from public.analytics_money(7)'))
    expect(money).toEqual([])
    await expect(
      atLevel(owner, 'aal1', () => db.query("select public.void_expense(gen_random_uuid(), 'Testing')")),
    ).rejects.toThrow(/Only the owner/)
  })

  it('ignores an app that was added but never confirmed', async () => {
    await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'unverified')", [staff])
    expect(await powers(staff, 'aal1')).toEqual({ staff: true, owner: false })
  })

  it('applies to desk accounts too', async () => {
    await db.query("update auth.mfa_factors set status = 'verified' where user_id = $1", [staff])
    expect(await powers(staff, 'aal1')).toEqual({ staff: false, owner: false })
    expect(await powers(staff, 'aal2')).toEqual({ staff: true, owner: false })
  })
})
