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
