/**
 * Shared constants used across transactions, budgets, forms, and inventory.
 */

export const EXPENSE_CATEGORIES = [
  "Food & Groceries",
  "Dining Out",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Entertainment",
  "Clothing",
  "Education",
  "Personal Care",
  "Gifts",
  "Savings",
  "Other",
] as const

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Refund",
  "Other",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const

// ─── Inventory ────────────────────────────────────────────────────────────────

export const INVENTORY_LOCATIONS = ["fridge", "pantry", "freezer"] as const
export type InventoryLocation = (typeof INVENTORY_LOCATIONS)[number]

export const INVENTORY_LOCATION_LABELS: Record<InventoryLocation, string> = {
  fridge: "🧊 Fridge",
  pantry: "🗄️ Pantry",
  freezer: "❄️ Freezer",
}

export const INVENTORY_UNITS = [
  "pcs",
  "kg",
  "g",
  "L",
  "mL",
  "lb",
  "oz",
  "cup",
  "tbsp",
  "tsp",
  "pack",
  "box",
  "bag",
  "bottle",
  "can",
  "bunch",
] as const

export type InventoryUnit = (typeof INVENTORY_UNITS)[number]

/**
 * Expiry urgency levels for inventory items.
 * "expired"  — expiresAt is in the past
 * "critical" — expires within 1 day
 * "warning"  — expires within 3 days
 * "ok"       — expires in > 3 days or no expiry date
 */
export type ExpiryStatus = "expired" | "critical" | "warning" | "ok"

export function getExpiryStatus(expiresAt: Date | null | undefined): ExpiryStatus {
  if (!expiresAt) return "ok"
  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return "expired"
  if (diffDays <= 1) return "critical"
  if (diffDays <= 3) return "warning"
  return "ok"
}

export function formatExpiryLabel(expiresAt: Date | null | undefined): string {
  if (!expiresAt) return ""
  const status = getExpiryStatus(expiresAt)
  const formatted = expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (status === "expired") return `Expired ${formatted}`
  if (status === "critical") return `Expires tomorrow (${formatted})`
  if (status === "warning") return `Expires ${formatted}`
  return `Expires ${formatted}`
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Supported currencies for HavenFlow. */
export const CURRENCIES = ["IRR", "USD", "USDT"] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_LABELS: Record<Currency, string> = {
  IRR: "IRR — Iranian Rial (﷼)",
  USD: "USD — US Dollar ($)",
  USDT: "USDT — Tether (₮)",
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  IRR: "﷼",
  USD: "$",
  USDT: "₮",
}

/**
 * Format a number as a currency string using the given currency code.
 * IRR and USD use Intl.NumberFormat; USDT uses a custom formatter since it
 * is not an ISO 4217 code supported by the browser's locale engine.
 */
export function formatCurrency(amount: number | string, currency = "IRR"): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(value)) return "—"

  // USDT is not an ISO currency code — format manually.
  if (currency === "USDT") {
    return `₮${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(value)}`
  }

  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
  } catch {
    // Fallback for any unrecognised currency code
    return `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
  }
}

/**
 * Returns the currency if it is a supported Currency, otherwise falls back to 'IRR'.
 * Useful when validating a potentially-unknown string (e.g. from DB or URL param).
 */
export function resolveDefaultCurrency(currency: string): Currency {
  return CURRENCIES.includes(currency as Currency) ? (currency as Currency) : "IRR"
}

/** Return the current month in YYYY-MM format */
export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Return start and end Date objects for a YYYY-MM month string */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number)
  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 1) // exclusive upper bound
  return { start, end }
}
