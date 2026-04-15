import { headers } from "next/headers"
import { and, eq, gte, lt, sql } from "drizzle-orm"
import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { budgets, transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency } from "@/lib/constants"
import { formatStoredMonth, getCurrentMonth, monthBounds as calAwareMonthBounds, type CalendarSystem } from "@/lib/date-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BudgetForm } from "@/components/features/budget-form"
import { DeleteBudgetButton } from "@/components/features/delete-buttons"

export const metadata: Metadata = { title: "Budgets" }

export default async function BudgetsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)
  const calendarSystem = (household.calendarSystem as CalendarSystem) ?? "jalali"
  const month = getCurrentMonth(calendarSystem)
  const { start, end } = calAwareMonthBounds(month)

  // Load top-level categories for the budget form
  const topLevelCategories = await db.query.categories.findMany({
    where: (c, { and, isNull }) =>
      and(eq(c.householdId, household.id), isNull(c.parentId)),
    orderBy: (c, { asc }) => [asc(c.name)],
  })

  // All budgets for this household (with category relations)
  const allBudgets = await db.query.budgets.findMany({
    where: eq(budgets.householdId, household.id),
    with: { category: true },
    orderBy: (b, { desc }) => [desc(b.month)],
  })

  // All subcategory IDs grouped by top-level category
  // We need this to roll up subcategory spending into parent budgets
  const allSubcategories = await db.query.categories.findMany({
    where: (c, { and, isNotNull }) =>
      and(eq(c.householdId, household.id), isNotNull(c.parentId)),
  })

  // Build a map: parentId → [subcategoryId, ...]
  const subsByParent = allSubcategories.reduce<Record<string, string[]>>((acc, sub) => {
    if (sub.parentId) {
      acc[sub.parentId] = [...(acc[sub.parentId] ?? []), sub.id]
    }
    return acc
  }, {})

  // Fetch all current-month expense transactions with their category IDs
  const expenseRows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, household.id),
        eq(transactions.type, "expense"),
        gte(transactions.transactionDate, start),
        lt(transactions.transactionDate, end)
      )
    )
    .groupBy(transactions.categoryId)

  // Build a spending map: categoryId → amount
  const spentMap = Object.fromEntries(
    expenseRows.map((r) => [r.categoryId ?? "null", parseFloat(r.total)])
  )

  /**
   * Calculate total spending for a category, including all its subcategories.
   * This gives the "rollup" view for top-level budgets.
   */
  function getSpentForCategory(categoryId: string): number {
    const direct = spentMap[categoryId] ?? 0
    const subs = subsByParent[categoryId] ?? []
    const subTotal = subs.reduce((sum, subId) => sum + (spentMap[subId] ?? 0), 0)
    return direct + subTotal
  }

  // Enrich budgets with spent amount (rolled up from subcategories)
  const currentBudgets = allBudgets
    .filter((b) => b.month === month)
    .map((b) => {
      const planned = parseFloat(b.plannedAmount)
      const spent = b.categoryId ? getSpentForCategory(b.categoryId) : 0
      const pct = planned > 0 ? Math.round((spent / planned) * 100) : 0
      const categoryLabel = b.category
        ? `${b.category.icon ?? ""} ${b.category.name}`.trim()
        : b.category ?? "Unknown"
      return { ...b, planned, spent, pct, categoryLabel }
    })

  const pastBudgets = allBudgets
    .filter((b) => b.month !== month)
    .map((b) => ({
      ...b,
      categoryLabel: b.category
        ? `${b.category.icon ?? ""} ${b.category.name}`.trim()
        : b.category ?? "Unknown",
    }))

  const topLevelForForm = topLevelCategories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Budgets</h1>
        <p className="text-sm text-muted-foreground">Plan and track your monthly spending</p>
      </div>

      {/* Current month progress */}
      {currentBudgets.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {formatStoredMonth(month, calendarSystem)}
          </h2>

          {currentBudgets.map((b) => (
            <Card key={b.id} size="sm">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm font-medium">{b.categoryLabel}</span>
                    {b.pct >= 90 && (
                      <Badge variant="danger" className="shrink-0">
                        <AlertTriangle className="mr-1 size-3" />
                        Over 90%
                      </Badge>
                    )}
                    {b.pct >= 70 && b.pct < 90 && (
                      <Badge variant="warning" className="shrink-0">
                        <AlertTriangle className="mr-1 size-3" />
                        Over 70%
                      </Badge>
                    )}
                  </div>
                  <DeleteBudgetButton budgetId={b.id} />
                </div>

                <Progress value={b.pct} className="mt-2" />

                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(b.spent, household.defaultCurrency)} spent</span>
                  <span>
                    {formatCurrency(Math.max(0, b.planned - b.spent), household.defaultCurrency)} left of{" "}
                    {formatCurrency(b.planned, household.defaultCurrency)}
                  </span>
                </div>

                {/* Show subcategory breakdown if this top-level has subcategories */}
                {b.categoryId && (subsByParent[b.categoryId] ?? []).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Subcategory breakdown
                    </summary>
                    <div className="mt-2 flex flex-col gap-1 pl-2 border-l-2 border-border">
                      {(subsByParent[b.categoryId] ?? []).map((subId) => {
                        const sub = allSubcategories.find((s) => s.id === subId)
                        const subSpent = spentMap[subId] ?? 0
                        if (!sub || subSpent === 0) return null
                        return (
                          <div key={subId} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {sub.icon ?? "·"} {sub.name}
                            </span>
                            <span className="tabular-nums">{formatCurrency(subSpent, household.defaultCurrency)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Set budget form */}
      <Card>
        <CardHeader>
          <CardTitle>Set a budget</CardTitle>
        </CardHeader>
        <CardContent>
          <BudgetForm topLevelCategories={topLevelForForm} calendarSystem={calendarSystem} />
        </CardContent>
      </Card>

      {/* Past budgets */}
      {pastBudgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past budgets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {pastBudgets.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{b.categoryLabel}</span>
                    <span className="text-xs text-muted-foreground">{formatStoredMonth(b.month, calendarSystem)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">
                      {formatCurrency(b.plannedAmount, household.defaultCurrency)}
                    </span>
                    <DeleteBudgetButton budgetId={b.id} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {allBudgets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-3xl" aria-hidden>🎯</span>
            <div>
              <p className="font-medium text-foreground">No budgets yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Set your first monthly budget above to start tracking spending.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
