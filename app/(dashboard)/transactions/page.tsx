import { headers } from "next/headers"
import { and, desc, eq } from "drizzle-orm"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions, wallets } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency } from "@/lib/constants"
import { formatDate, type CalendarSystem } from "@/lib/date-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TransactionForm } from "@/components/features/transaction-form"
import { DeleteTransactionButton } from "@/components/features/delete-buttons"

export const metadata: Metadata = { title: "Transactions" }

export default async function TransactionsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)
  const calendarSystem = (household.calendarSystem as CalendarSystem) ?? "jalali"

  // Load top-level categories (with their subcategories) for the form
  const topLevelCategories = await db.query.categories.findMany({
    where: (c, { and, isNull }) =>
      and(eq(c.householdId, household.id), isNull(c.parentId)),
    with: { subcategories: { orderBy: (c, { asc }) => [asc(c.name)] } },
    orderBy: (c, { asc }) => [asc(c.name)],
  })

  // Load wallets for the current user (used in the transaction form dropdown)
  const userWallets = await db.query.wallets.findMany({
    where: and(
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
    orderBy: (w, { asc }) => [asc(w.createdAt)],
  })

  const allTransactions = await db.query.transactions.findMany({
    where: eq(transactions.householdId, household.id),
    with: {
      user: true,
      // Resolve the category (and its parent) for display
      category: { with: { parent: true } },
      wallet: true,
    },
    orderBy: [desc(transactions.transactionDate)],
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          {allTransactions.length} transaction{allTransactions.length !== 1 ? "s" : ""} recorded
        </p>
      </div>

      {/* Add transaction form */}
      <Card>
        <CardHeader>
          <CardTitle>Add transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm categories={topLevelCategories} wallets={userWallets} defaultCurrency={household.defaultCurrency} calendarSystem={calendarSystem} />
        </CardContent>
      </Card>

      {/* Transactions list */}
      <Card>
        <CardHeader>
          <CardTitle>All transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allTransactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="text-3xl" aria-hidden>🧾</span>
              <div>
                <p className="font-medium text-foreground">No transactions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first one above to start tracking.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((tx) => {
                  // Build the display label: "Parent › Sub" or just the name
                  // tx.category is the JOIN result (CategoryType | null) from the `with` clause.
                  // Old transactions without a categoryId will have null here; show "—" as fallback.
                  const cat = tx.category
                  const categoryLabel = cat
                    ? cat.parent
                      ? `${cat.parent.icon ?? ""} ${cat.parent.name} › ${cat.icon ?? ""} ${cat.name}`.trim()
                      : `${cat.icon ?? ""} ${cat.name}`.trim()
                    : "—"

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(new Date(tx.transactionDate), calendarSystem)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={tx.type === "income" ? "income" : "expense"}>
                            {tx.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{categoryLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {tx.wallet ? tx.wallet.name : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {tx.description ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        <span
                          className={
                            tx.type === "income" ? "text-emerald-600" : "text-foreground"
                          }
                        >
                          {tx.type === "income" ? "+" : "−"}
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DeleteTransactionButton transactionId={tx.id} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
