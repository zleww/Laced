import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, rows } from './helpers'

// The owner sets how many wrong passwords the sign-in screen allows before it asks
// people to wait. Anyone may read the two numbers; only the owner may change them.

let db: PGlite
let owner: string
let staff: string

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('sign-in limits', () => {
  it('starts at 5 tries and a 10-minute wait, readable before sign-in', async () => {
    const limits = await as(db, null, () => rows(db, 'select * from public.sign_in_limits()'))
    expect(limits).toEqual([{ max_tries: 5, wait_minutes: 10 }])
  })

  it('keeps the settings table itself closed to visitors and staff', async () => {
    await expect(as(db, null, () => rows(db, 'select * from public.app_settings'))).rejects.toThrow()
    expect(await as(db, staff, () => rows(db, 'select * from public.app_settings'))).toEqual([])
    const changed = await as(db, staff, () =>
      rows(db, 'update public.app_settings set max_sign_in_tries = 20 returning max_sign_in_tries'),
    )
    expect(changed).toEqual([])
  })

  it('lets the owner change them within sensible bounds', async () => {
    await as(db, owner, () => db.query('update public.app_settings set max_sign_in_tries = 3, sign_in_wait_minutes = 15'))
    expect(await rows(db, 'select * from public.sign_in_limits()')).toEqual([{ max_tries: 3, wait_minutes: 15 }])
    await expect(
      as(db, owner, () => db.query('update public.app_settings set max_sign_in_tries = 1')),
    ).rejects.toThrow()
  })
})
