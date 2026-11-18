import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, manilaToday, membershipEnd } from '../../src/lib/dates'

describe('date helpers', () => {
  it('uses the Manila calendar day', () => {
    // 15:30 UTC is 11:30 PM in Manila; 16:30 UTC is already the next day there.
    expect(manilaToday(new Date('2026-11-16T15:30:00Z'))).toBe('2026-11-16')
    expect(manilaToday(new Date('2026-11-16T16:30:00Z'))).toBe('2026-11-17')
  })

  it('matches the database rule for end dates', () => {
    expect(membershipEnd('2026-11-16', 1)).toBe('2026-12-15')
    expect(membershipEnd('2026-11-16', 13)).toBe('2027-12-15')
    expect(membershipEnd('2026-03-01', 1)).toBe('2026-03-31')
    expect(membershipEnd('2026-01-31', 1)).toBe('2026-02-27')
  })

  it('adds and counts days across month ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(daysBetween('2026-11-16', '2026-12-15')).toBe(29)
    expect(daysBetween('2026-11-16', '2026-11-15')).toBe(-1)
  })
})
