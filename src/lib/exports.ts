import { api } from './api'
import { downloadCsv, toCsv } from './csv'
import { manilaToday } from './dates'
import type { ExportTable } from './types'

// Downloads for the owner: one table as a spreadsheet, or everything as a backup file.

const allTables: ExportTable[] = [
  'members',
  'plans',
  'memberships',
  'payments',
  'checkins',
  'expenses',
  'daily_closes',
  'staff',
  'employees',
  'payroll_entries',
]

/** One table as CSV, columns exactly as stored. Amounts stay in centavos. */
export async function exportTableCsv(table: ExportTable): Promise<number> {
  const rows = await api.exportTable(table)
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const csv = toCsv(
    headers,
    rows.map((row) =>
      headers.map((key) => {
        const value = row[key]
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return JSON.stringify(value)
        return typeof value === 'number' ? value : String(value)
      }),
    ),
  )
  downloadCsv(`laced-${table.replace('_', '-')}-${manilaToday()}.csv`, csv)
  return rows.length
}

/** Every table in one JSON file. Keep it somewhere safe: it holds members' names and numbers. */
export async function downloadBackup(): Promise<number> {
  const tables: Record<string, unknown[]> = {}
  let count = 0
  for (const table of allTables) {
    tables[table] = await api.exportTable(table)
    count += tables[table].length
  }
  const file = JSON.stringify({ app: 'laced', createdAt: new Date().toISOString(), tables }, null, 2)
  const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `laced-backup-${manilaToday()}.json`
  link.click()
  URL.revokeObjectURL(url)
  return count
}
