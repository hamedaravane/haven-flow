/**
 * CSV Parser for HavenFlow — Iranian bank transaction exports.
 *
 * This module is purely client-safe (no "use server").
 * It handles:
 *   - Auto-detection of the data header row (skipping metadata rows at the top)
 *   - Column mapping for the Iranian bank CSV format
 *   - Amount normalisation (remove thousand-separator commas, handle Persian digits)
 *   - Date parsing (YYYY/MM/DD Jalali → ISO Gregorian string)
 *   - Type mapping (DEBIT → expense, CREDIT → income)
 */

import Papa from "papaparse"
import {
  KNOWN_COLUMN_HEADERS,
  MAX_HEADER_SCAN_ROWS,
  CSV_TYPE_MAP,
  type CsvColumnKey,
} from "@/lib/csv-constants"
import { toGregorian } from "@/lib/date-utils"

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single parsed row ready to be inserted into the DB */
export interface ParsedTransaction {
  /** Positive number (commas removed, Persian digits normalised) */
  amount: number
  /** income or expense */
  type: "income" | "expense"
  /** ISO Gregorian date string e.g. "2025-03-15" */
  transactionDate: string
  /** Combined description text */
  description: string
  /** Raw date string from the CSV (for display in preview) */
  rawDate: string
  /** Raw amount string from the CSV (for display in preview) */
  rawAmount: string
  /** Raw type string from the CSV (for display in preview) */
  rawType: string
}

/** Result returned by parseCsvFile */
export interface ParseResult {
  /** Successfully parsed rows */
  transactions: ParsedTransaction[]
  /** Number of rows that could not be parsed (e.g. invalid date/amount) */
  skippedCount: number
  /** Array of parse error messages (first few only) */
  errors: string[]
}

// ─── Persian / Arabic digit normaliser ───────────────────────────────────────

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

function normalizeDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
}

// ─── Header detection ─────────────────────────────────────────────────────────

/**
 * Build a lower-cased, trimmed version of a cell value for comparison.
 */
function normaliseCell(cell: string): string {
  return normalizeDigits(cell).toLowerCase().trim()
}

/**
 * Check whether a row looks like the data header row by counting how many
 * known column names it contains.
 */
function scoreHeaderRow(row: string[]): number {
  const cells = row.map(normaliseCell)
  let score = 0
  for (const variants of Object.values(KNOWN_COLUMN_HEADERS)) {
    for (const v of variants) {
      if (cells.includes(v.toLowerCase())) {
        score++
        break
      }
    }
  }
  return score
}

/**
 * Scan up to MAX_HEADER_SCAN_ROWS rows and return the index of the best
 * candidate header row. Returns -1 if none found.
 */
function findHeaderRowIndex(rows: string[][]): number {
  let bestIdx = -1
  let bestScore = 0
  const limit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS)
  for (let i = 0; i < limit; i++) {
    const score = scoreHeaderRow(rows[i])
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  // Need at least 3 recognised columns to accept a header row
  return bestScore >= 3 ? bestIdx : -1
}

// ─── Column mapping ───────────────────────────────────────────────────────────

/**
 * Build a map from CsvColumnKey → column index using the detected header row.
 * Returns null for any column that could not be found.
 */
function buildColumnMap(headerRow: string[]): Partial<Record<CsvColumnKey, number>> {
  const map: Partial<Record<CsvColumnKey, number>> = {}
  headerRow.forEach((cell, idx) => {
    const normalised = normaliseCell(cell)
    for (const [key, variants] of Object.entries(KNOWN_COLUMN_HEADERS) as [CsvColumnKey, readonly string[]][]) {
      // Only map the first occurrence — skip if already mapped
      if (map[key] !== undefined) continue
      if (variants.map((v) => v.toLowerCase()).includes(normalised)) {
        map[key] = idx
        break
      }
    }
  })
  return map
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

/**
 * Parse an amount string like "3,580,000" or "۳,۵۸۰,۰۰۰" to a number.
 * Returns NaN if the value cannot be parsed.
 */
function parseAmount(raw: string): number {
  const normalised = normalizeDigits(raw).replace(/,/g, "").trim()
  return parseFloat(normalised)
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a Jalali date string "YYYY/MM/DD" into a Gregorian ISO string "YYYY-MM-DD".
 * Also accepts pure Gregorian "YYYY-MM-DD" or "YYYY/MM/DD".
 * Returns null if parsing fails.
 */
function parseCsvDate(raw: string): string | null {
  const normalised = normalizeDigits(raw).trim()
  // Try Jalali first (most Iranian bank exports use Jalali dates)
  const gregorianDate = toGregorian(normalised)
  if (gregorianDate) {
    const y = gregorianDate.getFullYear()
    const m = String(gregorianDate.getMonth() + 1).padStart(2, "0")
    const d = String(gregorianDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  // Fallback: try parsing as Gregorian ISO
  const iso = normalised.replace(/\//g, "-")
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const test = new Date(iso)
    if (!isNaN(test.getTime())) return iso
  }
  return null
}

// ─── Description builder ──────────────────────────────────────────────────────

/**
 * Build a combined description string from available columns.
 * Prioritises Description > Extra Info > Channel > Comment, deduplicating identical values.
 */
function buildDescription(
  row: string[],
  colMap: Partial<Record<CsvColumnKey, number>>
): string {
  const parts: string[] = []
  for (const key of ["description", "extraInfo", "channel", "comment"] as CsvColumnKey[]) {
    const idx = colMap[key]
    if (idx !== undefined) {
      const val = row[idx]?.trim()
      if (val && val !== "0" && !parts.includes(val)) {
        parts.push(val)
      }
    }
  }
  return parts.join(" — ")
}

// ─── Dedup key helper ─────────────────────────────────────────────────────────

/**
 * Build a stable deduplication key from a date string and amount.
 * Format: "YYYY-MM-DD|amount.toFixed(2)"
 */
function buildDedupKey(date: string, amount: number): string {
  return `${date}|${amount.toFixed(2)}`
}

// ─── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parse a CSV file (as a string) from an Iranian bank export.
 *
 * Steps:
 * 1. Parse CSV with papaparse
 * 2. Find the header row by scanning the first MAX_HEADER_SCAN_ROWS rows
 * 3. Build column map
 * 4. Parse each data row into a ParsedTransaction
 * 5. Return results with skipped count and error messages
 */
export function parseCsvContent(csvText: string): ParseResult {
  const parseResult = Papa.parse(csvText, {
    header: false,
    skipEmptyLines: true,
  }) as { data: string[][] }

  const rawRows = parseResult.data
  if (rawRows.length === 0) {
    return { transactions: [], skippedCount: 0, errors: ["File is empty"] }
  }

  const headerIdx = findHeaderRowIndex(rawRows)
  if (headerIdx === -1) {
    return {
      transactions: [],
      skippedCount: rawRows.length,
      errors: [
        "Could not find the data header row. Make sure this is an Iranian bank CSV export with columns like Amount, Type, Date, Description.",
      ],
    }
  }

  const colMap = buildColumnMap(rawRows[headerIdx])

  // Minimum required columns
  if (colMap.amount === undefined || colMap.type === undefined || colMap.date === undefined) {
    return {
      transactions: [],
      skippedCount: rawRows.length - headerIdx - 1,
      errors: [
        `Header found at row ${headerIdx + 1} but required columns (Amount, Type, Date) are missing. ` +
        `Detected columns: ${rawRows[headerIdx].join(", ")}`,
      ],
    }
  }

  const transactions: ParsedTransaction[] = []
  const errors: string[] = []
  let skippedCount = 0

  const dataRows = rawRows.slice(headerIdx + 1)
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]

    // Skip completely empty rows
    if (row.every((c) => !c.trim())) continue

    const rawAmount = row[colMap.amount!]?.trim() ?? ""
    const rawType = row[colMap.type!]?.trim() ?? ""
    const rawDate = row[colMap.date!]?.trim() ?? ""

    const amount = parseAmount(rawAmount)
    if (isNaN(amount) || amount <= 0) {
      skippedCount++
      if (errors.length < 5) errors.push(`Row ${i + headerIdx + 2}: invalid amount "${rawAmount}"`)
      continue
    }

    const type = CSV_TYPE_MAP[rawType] ?? CSV_TYPE_MAP[rawType.toUpperCase()]
    if (!type) {
      skippedCount++
      if (errors.length < 5) errors.push(`Row ${i + headerIdx + 2}: unknown type "${rawType}"`)
      continue
    }

    const transactionDate = parseCsvDate(rawDate)
    if (!transactionDate) {
      skippedCount++
      if (errors.length < 5) errors.push(`Row ${i + headerIdx + 2}: invalid date "${rawDate}"`)
      continue
    }

    const description = buildDescription(row, colMap)

    transactions.push({
      amount,
      type,
      transactionDate,
      description,
      rawDate,
      rawAmount,
      rawType,
    })
  }

  return { transactions, skippedCount, errors }
}
