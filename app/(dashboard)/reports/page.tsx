import { headers } from "next/headers"
import { and, eq, gte, lt, sql } from "drizzle-orm"
import type { Metadata } from "next"
import { Users } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions, categories, householdMembers } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency } from "@/lib/constants"
import {
  formatStoredMonth,
  getCurrentCalendarMonthBounds,
  getCalendarMonths,
  getCalendarMonthKey,
  type CalendarSystem,
} from "@/lib/date-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ReportsCharts } from "@/components/features/reports-charts"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)
  const defaultCurrency = household.defaultCurrency
  const calendarSystem = (household.calendarSystem as CalendarSystem) ?? "jalali"

  // ── Build 6 calendar-aware month windows ──────────────────────────────────
  // For Jalali: each window covers the true Gregorian span of the Jalali month
  // (e.g., Farvardin = March 21–April 21), so transactions that fall within a
  // Jalali month but cross a Gregorian month boundary are not missed.
  const calMonths = getCalendarMonths(calendarSystem, 6) // oldest → newest
  const firstStart = calMonths[0].start
  const lastEnd = calMonths[calMonths.length - 1].end

  // ── Aggregate income/expense per calendar month ────────────────────────────
  // Fetch all rows in the 6-month range and group them by calendar month in JS.
  // This handles Jalali months correctly (they don't align with Gregorian months).
  const allTxRows = await db
    .select({
      transactionDate: transactions.transactionDate,
      type: transactions.type,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, household.id),
        gte(transactions.transactionDate, firstStart),
        lt(transactions.transactionDate, lastEnd)
      )
    )

  // Build a per-month accumulator seeded with the 6 calendar months
  const monthlyAcc: Record<string, { income: number; expenses: number }> = {}
  for (const cm of calMonths) {
    monthlyAcc[cm.month] = { income: 0, expenses: 0 }
  }
  for (const row of allTxRows) {
    const key = getCalendarMonthKey(new Date(row.transactionDate), calendarSystem)
    if (monthlyAcc[key]) {
      const amount = parseFloat(row.amount)
      if (row.type === "income") monthlyAcc[key].income += amount
      else monthlyAcc[key].expenses += amount
    }
  }

  const monthlyData = calMonths.map((cm) => ({
    month: cm.month,
    monthLabel: formatStoredMonth(cm.month, calendarSystem),
    income: monthlyAcc[cm.month]?.income ?? 0,
    expenses: monthlyAcc[cm.month]?.expenses ?? 0,
  }))

  // ── Category breakdown for current calendar month ──────────────────────────
  const { start: cmStart, end: cmEnd, month: currentMonth } =
    getCurrentCalendarMonthBounds(calendarSystem)

  // Load all categories so we can roll subcategory spending up to top-level
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.householdId, household.id),
    with: { parent: true },
  })
  const categoryMap = Object.fromEntries(allCategories.map((c) => [c.id, c]))

  const rawCategoryRows = await db
    .select({
      categoryId: transactions.categoryId,
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
    .groupBy(transactions.categoryId)
    .orderBy(sql`SUM(${transactions.amount}) DESC`)

  // Roll up subcategory spending to top-level categories.
  // Transactions with no category are shown as "Uncategorized" so they are
  // not silently excluded from the breakdown.
  const rollup: Record<string, { name: string; amount: number; icon: string | null }> = {}
  for (const row of rawCategoryRows) {
    const cat = row.categoryId ? categoryMap[row.categoryId] : undefined
    const topLevel = cat?.parent ?? cat
    if (!topLevel) {
      // null / orphaned categoryId → bucket as "Uncategorized"
      rollup["__uncategorized__"] = {
        name: "Uncategorized",
        icon: null,
        amount: (rollup["__uncategorized__"]?.amount ?? 0) + parseFloat(row.total),
      }
      continue
    }
    const key = topLevel.id
    rollup[key] = {
      name: topLevel.name,
      icon: topLevel.icon,
      amount: (rollup[key]?.amount ?? 0) + parseFloat(row.total),
    }
  }

  const categoryData = Object.values(rollup)
    .sort((a, b) => b.amount - a.amount)
    .map((r) => ({
      category: r.icon ? `${r.icon} ${r.name}` : r.name,
      amount: r.amount,
    }))

  // ── Per-member spending for current calendar month ─────────────────────────
  const members = await db.query.householdMembers.findMany({
    where: eq(householdMembers.householdId, household.id),
    with: { user: true },
    orderBy: (m, { asc }) => [asc(m.joinedAt)],
  })

  const perUserRows = await db
    .select({
      userId: transactions.userId,
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
    .groupBy(transactions.userId)

  // Per-member top category (by spend) for the current calendar month
  const perUserCategoryRows = await db
    .select({
      userId: transactions.userId,
      categoryId: transactions.categoryId,
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
    .groupBy(transactions.userId, transactions.categoryId)
    .orderBy(sql`SUM(${transactions.amount}) DESC`)

  function topCategoryForUser(userId: string): string | null {
    const userRows = perUserCategoryRows.filter((r) => r.userId === userId)
    const rollupMap: Record<string, { name: string; icon: string | null; amount: number }> = {}
    for (const r of userRows) {
      const cat = r.categoryId ? categoryMap[r.categoryId] : undefined
      const top = cat?.parent ?? cat
      if (!top) continue
      rollupMap[top.id] = {
        name: top.name,
        icon: top.icon,
        amount: (rollupMap[top.id]?.amount ?? 0) + parseFloat(r.total),
      }
    }
    const sorted = Object.values(rollupMap).sort((a, b) => b.amount - a.amount)
    const top = sorted[0]
    if (!top) return null
    return top.icon ? `${top.icon} ${top.name}` : top.name
  }

  const memberSpending = members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    role: m.role,
    isCurrentUser: m.userId === session.user.id,
    total: parseFloat(perUserRows.find((r) => r.userId === m.userId)?.total ?? "0"),
    topCategory: topCategoryForUser(m.userId),
  }))

  const totalMemberSpend = memberSpending.reduce((s, m) => s + m.total, 0)

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
              {formatCurrency(totalSaved, defaultCurrency)}
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
            <p className="text-2xl font-bold">{formatCurrency(avgMonthlyExpense, defaultCurrency)}</p>
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

      {/* ── Spending by Member (this month) ───────────────────────────────── */}
      {memberSpending.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Spending by Member —{" "}
              {formatStoredMonth(currentMonth, calendarSystem)}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {memberSpending.map((m) => {
              const pct =
                totalMemberSpend > 0
                  ? Math.round((m.total / totalMemberSpend) * 100)
                  : 0

              return (
                <Card key={m.userId}>
                  <CardContent className="flex flex-col gap-3 pt-5">
                    {/* Name + role */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium">
                          {m.name}
                          {m.isCurrentUser && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </span>
                        <Badge variant={m.role === "owner" ? "income" : "outline"} className="shrink-0">
                          {m.role}
                        </Badge>
                      </div>
                      {totalMemberSpend > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {pct}%
                        </span>
                      )}
                    </div>

                    {/* Total spent */}
                    <p className="text-2xl font-bold tabular-nums">
                      {m.total > 0
                        ? formatCurrency(m.total, defaultCurrency)
                        : <span className="text-muted-foreground text-base font-normal">No expenses yet</span>
                      }
                    </p>

                    {/* Top category */}
                    {m.topCategory && (
                      <p className="text-xs text-muted-foreground">
                        Top category: <span className="font-medium text-foreground">{m.topCategory}</span>
                      </p>
                    )}

                    {/* Proportion bar */}
                    {totalMemberSpend > 0 && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Charts (client component) ──────────────────────────────────────── */}
      <ReportsCharts monthlyData={monthlyData} categoryData={categoryData} defaultCurrency={defaultCurrency} calendarSystem={calendarSystem} />
    </div>
  )
}
