/**
 * Date utilities for HavenFlow — Jalali (Solar Hijri) ↔ Gregorian conversions.
 *
 * ALL dates are stored in the database as ISO 8601 Gregorian strings.
 * These helpers are used ONLY for display and user input conversion.
 *
 * Calendar system values:
 *   'jalali'    → Solar Hijri / Shamsi / Persian
 *   'gregorian' → Standard ISO / Gregorian
 */

import jalaali from "jalaali-js"

export type CalendarSystem = "jalali" | "gregorian"

// ─── Persian / Jalali month names ─────────────────────────────────────────────

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const

// ─── Persian/Arabic digit normalization helpers ───────────────────────────────

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

/** Replace Persian or Arabic-Indic digits with their ASCII equivalents. */
function normalizeDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
}

// ─── Core conversion helpers ──────────────────────────────────────────────────

/**
 * Convert a Gregorian Date object to a Jalali date object { jy, jm, jd }.
 */
export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  return jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/**
 * Convert a Jalali date string "YYYY/MM/DD" (or "YYYY-MM-DD") to a Gregorian Date.
 * Accepts Persian/Arabic-Indic digits. Returns null if the input is invalid.
 */
export function toGregorian(jalaliStr: string): Date | null {
  const normalised = normalizeDigits(jalaliStr)
  const parts = normalised.split(/[-/]/).map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  const [jy, jm, jd] = parts as [number, number, number]
  try {
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd)
    return new Date(gy, gm - 1, gd)
  } catch {
    return null
  }
}

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Format a Date for display in the chosen calendar system.
 *
 * Jalali example:    "۱۴۰۵/۰۲/۱۵"
 * Gregorian example: "2026-04-15"
 */
export function formatDate(date: Date | null | undefined, calendar: CalendarSystem): string {
  if (!date) return "—"
  if (calendar === "jalali") {
    const { jy, jm, jd } = toJalali(date)
    return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Format a month string "YYYY-MM" for display in the chosen calendar.
 *
 * Jalali example:    "فروردین ۱۴۰۵"
 * Gregorian example: "April 2026"
 */
export function formatMonth(month: string, calendar: CalendarSystem): string {
  const [y, m] = month.split("-").map(Number)
  if (calendar === "jalali") {
    // Convert the first day of the Gregorian month to Jalali
    const { jy, jm } = jalaali.toJalaali(y, m, 1)
    const monthName = JALALI_MONTH_NAMES[jm - 1] ?? ""
    return `${monthName} ${jy}`
  }
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

/**
 * Format an expiry date for display (short form), respecting calendar.
 *
 * Jalali example:    "۱۵ اردیبهشت"
 * Gregorian example: "May 15"
 */
export function formatDateShort(date: Date | null | undefined, calendar: CalendarSystem): string {
  if (!date) return ""
  if (calendar === "jalali") {
    const { jm, jd } = toJalali(date)
    const monthName = JALALI_MONTH_NAMES[jm - 1] ?? ""
    return `${jd} ${monthName}`
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── Input parsing ────────────────────────────────────────────────────────────

/**
 * Parse a date string from a form input into an ISO 8601 date string (Gregorian).
 *
 * - Gregorian input: "YYYY-MM-DD"  →  returned as-is
 * - Jalali input:    "YYYY/MM/DD"  →  converted to "YYYY-MM-DD" Gregorian
 *
 * Returns null if parsing fails.
 */
export function parseDate(dateStr: string, calendar: CalendarSystem): string | null {
  if (!dateStr) return null
  if (calendar === "gregorian") {
    // Validate basic format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    return null
  }
  // Jalali: normalise Persian/Arabic digits and accept both "/" and "-" separators
  const normalised = normalizeDigits(dateStr)
  const date = toGregorian(normalised)
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// ─── "Current month" helpers ──────────────────────────────────────────────────

/**
 * Return the current month as a Gregorian "YYYY-MM" string.
 * This is what gets stored in the DB for budget.month.
 *
 * When calendarSystem is 'jalali' this still returns the Gregorian month that
 * corresponds to the start of the current Jalali month (since budgets are
 * always anchored to a Gregorian month boundary in the DB).
 */
export function getCurrentMonth(calendar: CalendarSystem): string {
  const now = new Date()
  if (calendar === "jalali") {
    // Return the Gregorian month in which the current Jalali month starts.
    // We find the first day of the current Jalali month and convert back.
    const { jy, jm } = toJalali(now)
    const { gy, gm } = jalaali.toGregorian(jy, jm, 1)
    return `${gy}-${String(gm).padStart(2, "0")}`
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Return the Gregorian [start, end) Date bounds for a "YYYY-MM" Gregorian month.
 * These are used for DB queries which always operate in Gregorian time.
 */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number)
  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 1) // exclusive upper bound
  return { start, end }
}

/**
 * Convert a Jalali month label "YYYY-MM" (e.g. "1404-02") to the
 * Gregorian "YYYY-MM" month string used in the DB.
 */
export function jalaliMonthToGregorian(jalaliMonth: string): string {
  const [jy, jm] = jalaliMonth.split("-").map(Number)
  const { gy, gm } = jalaali.toGregorian(jy, jm, 1)
  return `${gy}-${String(gm).padStart(2, "0")}`
}

/**
 * Convert a Gregorian "YYYY-MM" month string to its Jalali "YYYY-MM" equivalent.
 */
export function gregorianMonthToJalali(gregorianMonth: string): string {
  const [gy, gm] = gregorianMonth.split("-").map(Number)
  const { jy, jm } = jalaali.toJalaali(gy, gm, 1)
  return `${jy}-${String(jm).padStart(2, "0")}`
}

/**
 * Return a display-ready month label for a Gregorian "YYYY-MM" string.
 * Used wherever budget.month (always stored as Gregorian) needs to be shown.
 */
export function formatStoredMonth(gregorianMonth: string, calendar: CalendarSystem): string {
  return formatMonth(gregorianMonth, calendar)
}

/**
 * Return the current month in the display format for the chosen calendar.
 * Jalali example:    "1404-02"
 * Gregorian example: "2026-04"
 * (This is the value shown in the month input field, NOT what's stored in DB.)
 */
export function getCurrentMonthInput(calendar: CalendarSystem): string {
  const now = new Date()
  if (calendar === "jalali") {
    const { jy, jm } = toJalali(now)
    return `${jy}-${String(jm).padStart(2, "0")}`
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Parse a month input string to the Gregorian "YYYY-MM" stored in the DB.
 * - Gregorian input "YYYY-MM" is returned as-is.
 * - Jalali input "YYYY-MM" is converted to the corresponding Gregorian month.
 */
export function parseMonthInput(monthStr: string, calendar: CalendarSystem): string | null {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return null
  if (calendar === "gregorian") return monthStr
  return jalaliMonthToGregorian(monthStr)
}

/**
 * Format an expiry label respecting the chosen calendar.
 * Mirrors the logic of `formatExpiryLabel` in lib/constants.ts but calendar-aware.
 */
export function formatExpiryLabel(
  expiresAt: Date | null | undefined,
  calendar: CalendarSystem
): string {
  if (!expiresAt) return ""
  // Import inline to avoid circular deps with constants.ts
  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const formatted = formatDateShort(expiresAt, calendar)
  if (diffDays < 0) return `Expired ${formatted}`
  if (diffDays <= 1) return `Expires tomorrow (${formatted})`
  // Both warning (≤3 days) and ok (>3 days) show the same "Expires {date}" label;
  // the urgency distinction is conveyed via badge color from getExpiryStatus().
  return `Expires ${formatted}`
}

/**
 * Format a Gregorian date (stored in DB) for display inside an input field.
 * Returns: "YYYY/MM/DD" for Jalali, "YYYY-MM-DD" for Gregorian.
 */
export function formatDateForInput(
  isoDate: string | null | undefined,
  calendar: CalendarSystem
): string {
  if (!isoDate) return ""
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return ""
  return formatDate(date, calendar)
}
