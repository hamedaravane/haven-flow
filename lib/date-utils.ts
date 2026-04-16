/**
 * Date utilities for HavenFlow.
 *
 * ALL dates are stored in the database as ISO 8601 Gregorian strings.
 * These helpers provide consistent date formatting using the built-in
 * Intl.DateTimeFormat API — no external date libraries required.
 *
 * To display dates in Persian (Solar Hijri), pass locale "fa-IR" or
 * "fa-IR-u-nu-latn" (Persian calendar, Latin digits) to any formatting
 * function. No manual conversion logic is needed.
 */

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Format a Date for display using Intl.DateTimeFormat.
 *
 * @example formatDate(new Date())              → "Apr 15, 2026"
 * @example formatDate(new Date(), "fa-IR")     → Solar Hijri with Persian digits
 * @example formatDate(new Date(), "fa-IR-u-nu-latn") → Solar Hijri with Latin digits
 */
export function formatDate(
  date: Date | null | undefined,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale, options).format(date)
}

/**
 * Format a month string "YYYY-MM" for display.
 *
 * @example formatMonth("2026-04")          → "April 2026"
 * @example formatMonth("2026-04", "fa-IR") → Solar Hijri month name
 */
export function formatMonth(month: string, locale = "en-US"): string {
  const [y, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(
    new Date(y, m - 1, 1)
  )
}

/**
 * Format a Date as a short display (e.g. "Apr 15").
 */
export function formatDateShort(date: Date | null | undefined, locale = "en-US"): string {
  if (!date) return ""
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date)
}

// ─── "Current month" helpers ──────────────────────────────────────────────────

/**
 * Return the current month as a Gregorian "YYYY-MM" string.
 * This is the format stored in budgets.month.
 */
export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Return the Gregorian [start, end) Date bounds for a "YYYY-MM" string.
 * Used for DB range queries.
 */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number)
  return { start: new Date(year, mon - 1, 1), end: new Date(year, mon, 1) }
}

/**
 * Return the current Gregorian month's [start, end) bounds and YYYY-MM key.
 */
export function getCurrentCalendarMonthBounds(): { start: Date; end: Date; month: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const month = `${y}-${String(m).padStart(2, "0")}`
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1), month }
}

/**
 * Return the Gregorian YYYY-MM key for the month that contains `date`.
 */
export function getCalendarMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Return an array of Gregorian month windows for the past `count` months,
 * ordered oldest → newest.
 *
 * Each entry contains:
 *   month – "YYYY-MM" key
 *   start – inclusive lower bound for DB queries
 *   end   – exclusive upper bound for DB queries
 */
export function getCalendarMonths(count: number): Array<{ month: string; start: Date; end: Date }> {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i // oldest first
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const month = `${y}-${String(m).padStart(2, "0")}`
    return { month, start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
  })
}

/**
 * Return a display-ready month label for a Gregorian "YYYY-MM" string.
 * Used wherever budget.month needs to be shown.
 */
export function formatStoredMonth(gregorianMonth: string, locale = "en-US"): string {
  return formatMonth(gregorianMonth, locale)
}

/**
 * Format a Gregorian ISO date string for use in an `<input type="date">` field.
 * Returns "YYYY-MM-DD" or "" if invalid.
 */
export function formatDateForInput(isoDate: string | null | undefined): string {
  if (!isoDate) return ""
  const match = String(isoDate).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ""
}
