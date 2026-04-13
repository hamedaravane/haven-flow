/**
 * Shared constants used across transactions, budgets, and forms.
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

/** Format a number as a currency string (e.g. 1234.56 → "$1,234.56") */
export function formatCurrency(amount: number | string, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    typeof amount === "string" ? parseFloat(amount) : amount
  )
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
