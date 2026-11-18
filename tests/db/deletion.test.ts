import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// A member's right to have their data deleted, without breaking the money records.

let db: PGlite
let owner: string
let staff: string

const sell = (memberId: string) =>
  as(db, staff, async () =>
    value(db, "select public.record_membership_payment($1, $2, 'cash', null) as r", [
      memberId,
      await planId(db, 'regular_month'),
    ]),
  )

const remove = (userId: string, memberId: string, reason: string) =>
  as(db, userId, () => db.query('select public.delete_member_data($1, $2)', [memberId, reason]))

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('deleting a member’s data', () => {
  it('is refused for staff and needs a reason', async () => {
    const member = await registerMember(db, staff, 'Keep Me', '09301110001')
    await expect(remove(staff, member, 'Member asked')).rejects.toThrow(/Only the owner/)
    await expect(remove(owner, member, ' ')).rejects.toThrow(/reason/)
  })

  it('wipes the name and phone but keeps the payments', async () => {
    const member = await registerMember(db, staff, 'Maria Clara', '09301110002')
    const sale = await sell(member)
    await remove(owner, member, 'Member asked')

    const [row] = await rows(db, 'select full_name, phone, deleted_at from public.members where id = $1', [member])
    expect(row.full_name).toBe('Deleted member')
    expect(row.phone).toBeNull()
    expect(row.deleted_at).not.toBeNull()

    const kept = await rows(db, 'select amount_centavos from public.payments where id = $1', [sale.payment_id])
    expect(kept).toHaveLength(1)

    // The old name is nowhere a signed-in user can read it.
    const leftovers = await as(db, owner, () =>
      rows(db, "select summary from public.activity_feed(500) where summary like '%Maria Clara%'"),
    )
    expect(leftovers).toEqual([])
  })

  it('hides the member from the desk and refuses check-in', async () => {
    const member = await registerMember(db, staff, 'Gone Member', '09301110003')
    await sell(member)
    await remove(owner, member, 'Member asked')

    const listed = await as(db, staff, () => rows(db, 'select id from public.member_overview where id = $1', [member]))
    expect(listed).toEqual([])
    await expect(
      as(db, staff, () => db.query("select public.check_in($1, 'search')", [member])),
    ).rejects.toThrow()
  })

  it('frees the phone number and logs the deletion', async () => {
    const member = await registerMember(db, staff, 'Old Number', '09301110004')
    await remove(owner, member, 'Member asked')
    await expect(registerMember(db, staff, 'New Person', '09301110004')).resolves.toBeTruthy()

    const feed = await as(db, owner, () => rows(db, "select summary, actor from public.activity_feed(50, null, 'member')"))
    const entry = feed.find((item) => item.summary.startsWith('Deleted the data'))
    expect(entry?.actor).toBe('Olive Owner')
    expect(entry?.summary).toMatch(/Member asked/)

    await expect(remove(owner, member, 'Again')).rejects.toThrow(/already deleted/)
  })
})
