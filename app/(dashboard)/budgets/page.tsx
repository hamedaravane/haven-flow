import { headers } from "next/headers"
import { and, eq, gte, lt, sql } from "drizzle-orm"
import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { budgets, transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency, currentMonth, monthBounds } from "@/lib/constants"
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
  const month = currentMonth()
  const { start, end } = monthBounds(month)

  // All budgets for this household
  const allBudgets = await db.query.budgets.findMany({
    where: eq(budgets.householdId, household.id),
    orderBy: (b, { desc }) => [desc(b.month), b.category],
  })

  // Calculate spent per category for the current month
  const spentRows = await db
    .select({
      category: transactions.category,
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
    .groupBy(transactions.category)

  const spentMap = Object.fromEntries(spentRows.map((r) => [r.category, parseFloat(r.total)]))

  // Enrich budgets with spent amount
  const currentBudgets = allBudgets
    .filter((b) => b.month === month)
    .map((b) => {
      const planned = parseFloat(b.plannedAmount)
      const spent = spentMap[b.category] ?? 0
      const pct = planned > 0 ? Math.round((spent / planned) * 100) : 0
      return { ...b, planned, spent, pct }
    })

  const pastBudgets = allBudgets.filter((b) => b.month !== month)

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
            {new Date(month + "-01").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>

          {currentBudgets.map((b) => (
            <Card key={b.id} size="sm">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm font-medium">{b.category}</span>
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
                  <span>{formatCurrency(b.spent)} spent</span>
                  <span>
                    {formatCurrency(Math.max(0, b.planned - b.spent))} left of{" "}
                    {formatCurrency(b.planned)}
                  </span>
                </div>
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
          <BudgetForm />
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
                    <span className="text-sm font-medium">{b.category}</span>
                    <span className="text-xs text-muted-foreground">{b.month}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">
                      {formatCurrency(b.plannedAmount)}
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
        <p className="text-center text-sm text-muted-foreground">
          No budgets yet — set your first one above.
        </p>
      )}
    </div>
  )
}
