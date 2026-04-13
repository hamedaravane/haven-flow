import { headers } from "next/headers"
import { desc, eq } from "drizzle-orm"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { formatCurrency } from "@/lib/constants"
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

  const allTransactions = await db.query.transactions.findMany({
    where: eq(transactions.householdId, household.id),
    with: { user: true },
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
          <TransactionForm />
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
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(tx.transactionDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={tx.type === "income" ? "income" : "expense"}>
                          {tx.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{tx.category}</span>
                      </div>
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
                        {formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DeleteTransactionButton transactionId={tx.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
