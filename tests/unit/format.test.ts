import { describe, expect, it } from 'vitest'
import { toCsv } from '../../src/lib/csv'
import { formatDifference, formatPeso, parsePeso, searchTerm } from '../../src/lib/format'

describe('peso amounts', () => {
  it('turns typed pesos into whole centavos', () => {
    expect(parsePeso('6840')).toBe(684000)
    expect(parsePeso('1,234.50')).toBe(123450)
    expect(parsePeso('₱ 85.5')).toBe(8550)
    expect(parsePeso('0')).toBe(0)
    // A classic floating-point trap: 0.1 + 0.2 style amounts must stay exact.
    expect(parsePeso('1.10')).toBe(110)
    expect(parsePeso('19.99')).toBe(1999)
  })

  it('rejects text that is not an amount', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1.2.3', '12k']) {
      expect(parsePeso(bad)).toBeNull()
    }
  })

  it('formats centavos for display', () => {
    expect(formatPeso(95000)).toBe('₱950')
    expect(formatPeso(123450)).toBe('₱1,234.50')
    expect(formatDifference(0)).toBe('Matches')
    expect(formatDifference(-5000)).toBe('-₱50')
    expect(formatDifference(5000)).toBe('+₱50')
  })
})

describe('member search', () => {
  it('reduces a spaced phone number to digits and leaves names alone', () => {
    expect(searchTerm(' 0917 123-4567 ')).toBe('09171234567')
    expect(searchTerm('  Dela Cruz ')).toBe('Dela Cruz')
  })
})

describe('CSV export', () => {
  it('quotes commas and quotes, and defuses spreadsheet formulas', () => {
    const csv = toCsv(['Name', 'Note'], [
      ['Cruz, Juan', 'said "ok"'],
      ['=HYPERLINK("http://x")', '+63917'],
      ['Plain', 12.5],
    ])
    expect(csv.split('\r\n')).toEqual([
      'Name,Note',
      '"Cruz, Juan","said ""ok"""',
      '"\'=HYPERLINK(""http://x"")",\'+63917',
      'Plain,12.5',
    ])
  })
})
