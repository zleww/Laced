import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { addUser, as, createDatabase, planId, registerMember, rows, value } from './helpers'

// Payroll, the activity log, and the monthly report: all owner only.

let db: PGlite
let owner: string
let staff: string

const deductions = (grossPesos: number, withContributions = true) =>
  value(db, 'select public.payroll_deductions($1, $2) as r', [grossPesos * 100, withContributions])

const addEmployee = (name: string, ratePesos: number, withContributions = true) =>
  as(db, owner, () =>
    value(
      db,
      `insert into public.employees (full_name, job_title, monthly_rate_centavos, with_contributions)
       values ($1, 'Coach', $2, $3) returning id as r`,
      [name, ratePesos * 100, withContributions],
    ),
  )

const savePay = (userId: string, employeeId: string, grossPesos: number, otherPesos = 0) =>
  as(db, userId, () =>
    value(db, "select public.save_payroll_entry($1, '2026-11-01', $2, $3, 'Cash advance') as r", [
      employeeId,
      grossPesos * 100,
      otherPesos * 100,
    ]),
  )

beforeAll(async () => {
  db = await createDatabase()
  owner = await addUser(db, 'Olive Owner', 'owner')
  staff = await addUser(db, 'Ana Staff', 'staff')
})

describe('government deductions', () => {
  it('works out a ₱20,000 salary', async () => {
    const d = await deductions(20000)
    expect(d.sss_ee).toBe(100000) // 5% of MSC 20,000
    expect(d.sss_er).toBe(200000)
    expect(d.sss_ec).toBe(3000)
    expect(d.philhealth_ee).toBe(50000) // 2.5% of 20,000
    expect(d.pagibig_ee).toBe(20000) // capped at ₱200
    expect(d.tax).toBe(0) // taxable 18,300 is under 20,833
  })

  it('applies the floors and ceilings', async () => {
    const low = await deductions(4000)
    expect(low.sss_ee).toBe(25000) // MSC floor 5,000
    expect(low.philhealth_ee).toBe(25000) // floor 10,000
    expect(low.pagibig_ee).toBe(8000) // 2% of 4,000

    const high = await deductions(150000)
    expect(high.sss_ee).toBe(175000) // MSC ceiling 35,000
    expect(high.philhealth_ee).toBe(250000) // ceiling 100,000
    expect(high.pagibig_ee).toBe(20000)
  })

  it('withholds tax above the exempt bracket', async () => {
    // 40,000 gross - 1,750 SSS - 1,000 PhilHealth - 200 Pag-IBIG = 37,050 taxable.
    // 1,875 + 20% of (37,050 - 33,333) = 2,618.40
    const d = await deductions(40000)
    expect(d.tax).toBe(261840)
  })

  it('takes nothing but tax from workers without contributions', async () => {
    const d = await deductions(15000, false)
    expect(d.sss_ee + d.philhealth_ee + d.pagibig_ee + d.tax).toBe(0)
  })
})

describe('payroll entries', () => {
  it('saves a draft with the net pay worked out, and recalculates it', async () => {
    const coach = await addEmployee('Carlo Coach', 20000)
    const id = await savePay(owner, coach, 20000, 500)
    let [entry] = await rows(db, 'select * from public.payroll_entries where id = $1', [id])
    // 20,000 - 1,000 - 500 - 200 - 0 tax - 500 other
    expect(entry.net_centavos).toBe(1780000)
    expect(entry.status).toBe('draft')

    const again = await savePay(owner, coach, 18000)
    expect(again).toBe(id)
    ;[entry] = await rows(db, 'select * from public.payroll_entries where id = $1', [id])
    expect(entry.gross_centavos).toBe(1800000)
  })

  it('locks a paid month until it is voided', async () => {
    const cleaner = await addEmployee('Cora Cleaner', 15000, false)
    const id = await savePay(owner, cleaner, 15000)
    await as(db, owner, () => db.query('select public.mark_payroll_paid($1)', [id]))
    await expect(savePay(owner, cleaner, 16000)).rejects.toThrow(/already paid/)

    await as(db, owner, () => db.query("select public.void_payroll_entry($1, 'Wrong amount')", [id]))
    const fresh = await savePay(owner, cleaner, 16000)
    expect(fresh).not.toBe(id)
  })

  it('is closed to staff', async () => {
    const coach = await addEmployee('Staff Cannot Pay', 12000)
    await expect(savePay(staff, coach, 12000)).rejects.toThrow(/Only the owner/)
    const seen = await as(db, staff, () =>
      rows(db, 'select (select count(*) from public.employees)::int as e, (select count(*) from public.payroll_entries)::int as p'),
    )
    expect(seen[0]).toEqual({ e: 0, p: 0 })
    await expect(
      as(db, staff, () =>
        db.query("insert into public.employees (full_name, job_title, monthly_rate_centavos) values ('X Y', 'Coach', 100)"),
      ),
    ).rejects.toThrow()
  })
})

describe('activity log and monthly report', () => {
  it('shows the owner who did what, and staff nothing', async () => {
    const member = await registerMember(db, staff, 'Logged Member', '09201112222')
    await as(db, staff, async () =>
      db.query("select public.record_membership_payment($1, $2, 'cash', null)", [member, await planId(db, 'regular_month')]),
    )

    const feed = await as(db, owner, () => rows(db, 'select * from public.activity_feed(50)'))
    const kinds = new Set(feed.map((row) => row.kind))
    expect(kinds).toContain('sale')
    expect(kinds).toContain('member')
    expect(kinds).toContain('payroll')
    const sale = feed.find((row) => row.kind === 'sale')!
    expect(sale.actor).toBe('Ana Staff')
    expect(sale.summary).toMatch(/Logged Member/)

    const onlySales = await as(db, owner, () => rows(db, "select kind from public.activity_feed(50, null, 'sale')"))
    expect(onlySales.every((row) => row.kind === 'sale')).toBe(true)

    expect(await as(db, staff, () => rows(db, 'select * from public.activity_feed(50)'))).toEqual([])
  })

  it('gives the owner one row per month and staff none', async () => {
    const months = await as(db, owner, () => rows(db, 'select * from public.analytics_monthly(12)'))
    expect(months).toHaveLength(12)
    const thisMonth = months[months.length - 1]
    expect(Number(thisMonth.revenue_centavos)).toBeGreaterThan(0)
    expect(Number(thisMonth.new_members)).toBeGreaterThan(0)

    expect(await as(db, staff, () => rows(db, 'select * from public.analytics_monthly(12)'))).toEqual([])
  })
})
