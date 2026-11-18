import type { Deductions } from './types'

// A copy of the database's payroll_deductions() for showing a live preview while
// the owner types. The database works the amounts out again when an entry is
// saved, so this copy only affects what is shown before saving.
// tests/unit/payroll.test.ts checks both give the same answers.
// Rates as of 2026; see the migration for where each one comes from.

const round2 = (value: number) => Math.round(value * 100) / 100
const toCentavos = (pesos: number) => Math.round(pesos * 100)

export function computeDeductions(grossCentavos: number, withContributions: boolean): Deductions {
  const gross = grossCentavos / 100
  let sssEe = 0
  let sssEr = 0
  let sssEc = 0
  let philhealthEe = 0
  let philhealthEr = 0
  let pagibigEe = 0
  let pagibigEr = 0

  if (withContributions) {
    const msc = Math.min(Math.max(500 * Math.floor((gross + 250) / 500), 5000), 35000)
    sssEe = msc * 0.05
    sssEr = msc * 0.1
    sssEc = msc < 15000 ? 10 : 30

    const philhealthBase = Math.min(Math.max(gross, 10000), 100000)
    philhealthEe = round2(philhealthBase * 0.025)
    philhealthEr = round2(philhealthBase * 0.025)

    const pagibigBase = Math.min(gross, 10000)
    pagibigEe = round2(pagibigBase * (gross <= 1500 ? 0.01 : 0.02))
    pagibigEr = round2(pagibigBase * 0.02)
  }

  const taxable = Math.max(gross - sssEe - philhealthEe - pagibigEe, 0)
  let tax: number
  if (taxable <= 20833) tax = 0
  else if (taxable < 33333) tax = (taxable - 20833) * 0.15
  else if (taxable < 66667) tax = 1875 + (taxable - 33333) * 0.2
  else if (taxable < 166667) tax = 8541.8 + (taxable - 66667) * 0.25
  else if (taxable < 666667) tax = 33541.8 + (taxable - 166667) * 0.3
  else tax = 183541.8 + (taxable - 666667) * 0.35

  return {
    sssEe: toCentavos(sssEe),
    sssEr: toCentavos(sssEr),
    sssEc: toCentavos(sssEc),
    philhealthEe: toCentavos(philhealthEe),
    philhealthEr: toCentavos(philhealthEr),
    pagibigEe: toCentavos(pagibigEe),
    pagibigEr: toCentavos(pagibigEr),
    tax: toCentavos(round2(tax)),
  }
}

/** What the employee takes home. */
export function netPay(grossCentavos: number, d: Deductions, otherCentavos: number): number {
  return grossCentavos - d.sssEe - d.philhealthEe - d.pagibigEe - d.tax - otherCentavos
}

/** What the gym pays on top of the gross: its share of the contributions. */
export function employerShare(d: Deductions): number {
  return d.sssEr + d.sssEc + d.philhealthEr + d.pagibigEr
}
