/** 95000 centavos -> "₱950". Shows centavos only when there are any. */
export function formatPeso(centavos: number): string {
  const hasCentavos = centavos % 100 !== 0
  return (
    '₱' +
    (centavos / 100).toLocaleString('en-PH', {
      minimumFractionDigits: hasCentavos ? 2 : 0,
      maximumFractionDigits: 2,
    })
  )
}

/** "Marco Reyes" -> "MR" */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

/**
 * Cleans what was typed into a member search. A phone number typed with
 * spaces or dashes ("0917 123 4567") is reduced to its digits so it still matches.
 */
export function searchTerm(query: string): string {
  const trimmed = query.trim()
  return /^[\d\s+-]+$/.test(trimmed) ? trimmed.replace(/\D/g, '') : trimmed
}

/** 3000000 centavos -> "₱30K", for chart axes. */
export function formatPesoCompact(centavos: number): string {
  return (
    '₱' +
    (centavos / 100).toLocaleString('en-PH', { notation: 'compact', maximumFractionDigits: 1 })
  )
}

/**
 * Turns typed pesos into whole centavos without using decimals in the math:
 * "1,234.50" -> 123450. Returns null when the text is not a valid amount.
 */
export function parsePeso(text: string): number | null {
  const cleaned = text.replace(/[₱,\s]/g, '')
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** Signed difference for the day close: "+₱50", "-₱50", or "Matches". */
export function formatDifference(centavos: number): string {
  if (centavos === 0) return 'Matches'
  return (centavos > 0 ? '+' : '-') + formatPeso(Math.abs(centavos))
}
