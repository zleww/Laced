// Turns rows into a CSV file and hands it to the browser as a download.

function cell(value: string | number): string {
  let text = String(value)
  // A cell starting with = + - or @ can run as a formula when the file is opened
  // in a spreadsheet. A leading apostrophe makes the spreadsheet treat it as text.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // The BOM at the start makes Excel read the peso sign and accented names correctly.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
