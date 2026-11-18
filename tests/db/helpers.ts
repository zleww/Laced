import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

// The tests run the real migration files against PGlite, a full Postgres that
// runs in memory inside Node. No Docker and no network are needed.

const root = process.cwd()
const migrationsDir = join(root, 'supabase', 'migrations')

export type Row = Record<string, any>

/** A fresh database with the Supabase stand-ins and every migration applied. */
export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(join(root, 'tests', 'db', 'supabase-stub.sql'), 'utf8'))
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const name of files) {
    await db.exec(readFileSync(join(migrationsDir, name), 'utf8'))
  }
  return db
}

/** Run a query and return its rows. Outside `as()` this runs as the database owner. */
export async function rows(db: PGlite, sql: string, params: unknown[] = []): Promise<Row[]> {
  const result = await db.query<Row>(sql, params)
  return result.rows
}

/** Run a query that returns one value in a column named "r". */
export async function value(db: PGlite, sql: string, params: unknown[] = []): Promise<any> {
  const [row] = await rows(db, sql, params)
  return row?.r
}

/** Create a login. With a role it also gets a staff row; without one it is a stranger. */
export async function addUser(db: PGlite, name: string, role?: 'owner' | 'staff'): Promise<string> {
  const id: string = await value(db, 'insert into auth.users default values returning id as r')
  if (role) {
    await db.query('insert into public.staff (id, full_name, role) values ($1, $2, $3)', [id, name, role])
  }
  return id
}

/**
 * Run `fn` the way the app would: as a signed-in user (or signed out when
 * userId is null), with row-level security applied.
 */
export async function as<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ''])
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
  }
}

export async function planId(db: PGlite, code: string): Promise<string> {
  return value(db, 'select id as r from public.plans where code = $1', [code])
}

/** Register a member the way the desk does, acting as `staffId`. */
export async function registerMember(db: PGlite, staffId: string, name: string, phone: string): Promise<string> {
  const result = await as(db, staffId, () =>
    value(db, 'select public.register_member($1, $2, true) as r', [name, phone]),
  )
  return result.member_id
}

/** Insert a past or future membership directly, to set up a member's history. */
export async function addMembership(
  db: PGlite,
  memberId: string,
  staffId: string,
  startOffsetDays: number,
  endOffsetDays: number,
): Promise<string> {
  return value(
    db,
    `insert into public.memberships (member_id, plan_id, start_date, end_date, kind, created_by)
     values ($1, (select id from public.plans where code = 'regular_month'),
             public.manila_today() + $3::int, public.manila_today() + $4::int, 'new', $2)
     returning id as r`,
    [memberId, staffId, startOffsetDays, endOffsetDays],
  )
}
