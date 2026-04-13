import { headers } from "next/headers"
import { and, eq, gte, lt, sql } from "drizzle-orm"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportsCharts } from "@/components/features/reports-charts"

export const metadata: Metadata = { title: "Reports" }

/** Build a YYYY-MM string for a given number of months ago (0 = current month). */
function monthAgo(n: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Return inclusive [start, end) Date bounds for a YYYY-MM string. */
function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
}

export default async function ReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  // ── Build 6-month windows ─────────────────────────────────────────────────
  const months = Array.from({ length: 6 }, (_, i) => monthAgo(5 - i)) // oldest → newest
  const firstStart = monthBounds(months[0]).start
  const lastEnd = monthBounds(months[months.length - 1]).end

  // ── Aggregate income/expense per month ────────────────────────────────────
  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`,
      type: transactions.type,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, household.id),
        gte(transactions.transactionDate, firstStart),
        lt(transactions.transactionDate, lastEnd)
      )
    )
    .groupBy(
      sql`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`,
      transactions.type
    )

  const monthlyData = months.map((month) => {
    const incomeRow = rows.find((r) => r.month === month && r.type === "income")
    const expenseRow = rows.find((r) => r.month === month && r.type === "expense")
    return {
      month,
      income: parseFloat(incomeRow?.total ?? "0"),
      expenses: parseFloat(expenseRow?.total ?? "0"),
    }
  })

  // ── Category breakdown for current month ──────────────────────────────────
  const currentMonth = monthAgo(0)
  const { start: cmStart, end: cmEnd } = monthBounds(currentMonth)

  const categoryRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, household.id),
        eq(transactions.type, "expense"),
        gte(transactions.transactionDate, cmStart),
        lt(transactions.transactionDate, cmEnd)
      )
    )
    .groupBy(transactions.category)
    .orderBy(sql`SUM(${transactions.amount}) DESC`)

  const categoryData = categoryRows.map((r) => ({
    category: r.category,
    amount: parseFloat(r.total),
  }))

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalSaved = monthlyData.reduce((s, m) => s + (m.income - m.expenses), 0)
  const avgMonthlyExpense =
    monthlyData.reduce((s, m) => s + m.expenses, 0) / monthlyData.length
  const biggestCategory = categoryData[0]?.category ?? "—"

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              6-Month Net Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${totalSaved >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {formatCurrency(totalSaved)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(avgMonthlyExpense)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Category (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-2xl font-bold">{biggestCategory}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts (client component) ──────────────────────────────────────── */}
      <ReportsCharts monthlyData={monthlyData} categoryData={categoryData} />
    </div>
  )
}
