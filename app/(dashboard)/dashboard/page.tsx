import { headers } from "next/headers"
import { and, desc, eq, gte, lt, sql } from "drizzle-orm"
import { AlertTriangle, DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { budgets, transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency, currentMonth, monthBounds } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TransactionForm } from "@/components/features/transaction-form"
import { DeleteTransactionButton } from "@/components/features/delete-buttons"

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)
  const month = currentMonth()
  const { start, end } = monthBounds(month)

  const monthWhere = and(
    eq(transactions.householdId, household.id),
    gte(transactions.transactionDate, start),
    lt(transactions.transactionDate, end)
  )

  // ── Current-month income / expenses ─────────────────────────────────────────
  const [totals] = await db
    .select({
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), '0')`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), '0')`,
    })
    .from(transactions)
    .where(monthWhere)

  const totalIncome = parseFloat(totals?.income ?? "0")
  const totalExpenses = parseFloat(totals?.expenses ?? "0")
  const balance = totalIncome - totalExpenses

  // ── Recent transactions ──────────────────────────────────────────────────────
  const recentTransactions = await db.query.transactions.findMany({
    where: eq(transactions.householdId, household.id),
    orderBy: [desc(transactions.transactionDate)],
    limit: 5,
  })

  // ── Budget progress for current month ────────────────────────────────────────
  const currentBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.householdId, household.id), eq(budgets.month, month)),
    orderBy: (b, { asc }) => [asc(b.category)],
  })

  const spentRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(and(monthWhere, eq(transactions.type, "expense")))
    .groupBy(transactions.category)

  const spentMap = Object.fromEntries(spentRows.map((r) => [r.category, parseFloat(r.total)]))

  const enrichedBudgets = currentBudgets.map((b) => {
    const planned = parseFloat(b.plannedAmount)
    const spent = spentMap[b.category] ?? 0
    const pct = planned > 0 ? Math.round((spent / planned) * 100) : 0
    return { ...b, planned, spent, pct }
  })

  // Budget warnings (≥70%)
  const warnings = enrichedBudgets.filter((b) => b.pct >= 70)

  const monthLabel = new Date(month + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  })()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium">
          {greeting}, {session.user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">{monthLabel} overview</p>
      </div>

      {/* Budget warnings banner */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((w) => (
            <div
              key={w.id}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${
                w.pct >= 90
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
              }`}
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>{w.category}</strong>: {w.pct}% of budget used (
                {formatCurrency(w.spent)} / {formatCurrency(w.planned)})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-4 text-emerald-500" />
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-emerald-600 tabular-nums">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="size-4 text-rose-500" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-rose-600 tabular-nums">
              {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm" className="col-span-2 md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="size-4" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-xl font-semibold tabular-nums ${
                balance >= 0 ? "text-foreground" : "text-destructive"
              }`}
            >
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget progress */}
      {enrichedBudgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {enrichedBudgets.map((b) => (
              <div key={b.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{b.category}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(b.spent)} / {formatCurrency(b.planned)}
                  </span>
                </div>
                <Progress value={b.pct} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick-add transaction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-4" />
            Quick add
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm />
        </CardContent>
      </Card>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y divide-border">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={tx.type === "income" ? "income" : "expense"}>
                        {tx.type}
                      </Badge>
                      <span className="truncate text-sm font-medium">{tx.category}</span>
                    </div>
                    {tx.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {tx.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        tx.type === "income" ? "text-emerald-600" : "text-foreground"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "−"}
                      {formatCurrency(tx.amount)}
                    </span>
                    <DeleteTransactionButton transactionId={tx.id} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentTransactions.length === 0 && enrichedBudgets.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Add your first transaction or budget to get started.
        </p>
      )}
    </div>
  )
}
