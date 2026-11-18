import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { computeDeductions } from '../../src/lib/payroll'
import { createDatabase, value } from './helpers'

// The payroll sheet shows a preview worked out in the browser. The database
// works the amounts out again on save. Both must agree, or the owner would see
// one number and save another.

let db: PGlite

beforeAll(async () => {
  db = await createDatabase()
})

const grosses = [
  1200, 1500, 4000, 5249.99, 5250, 9999, 10000, 12345.67, 14749, 14750, 15000, 20000, 20833, 23000, 33333, 34750,
  40000, 66667, 100000, 150000, 166667, 700000,
]

describe('payroll preview matches the database', () => {
  for (const pesos of grosses) {
    for (const withContributions of [true, false]) {
      it(`₱${pesos}${withContributions ? '' : ', no contributions'}`, async () => {
        const centavos = Math.round(pesos * 100)
        const fromDb = await value(db, 'select public.payroll_deductions($1, $2) as r', [centavos, withContributions])
        const fromApp = computeDeductions(centavos, withContributions)
        expect(fromApp).toEqual({
          sssEe: fromDb.sss_ee,
          sssEr: fromDb.sss_er,
          sssEc: fromDb.sss_ec,
          philhealthEe: fromDb.philhealth_ee,
          philhealthEr: fromDb.philhealth_er,
          pagibigEe: fromDb.pagibig_ee,
          pagibigEr: fromDb.pagibig_er,
          tax: fromDb.tax,
        })
      })
    }
  }
})
