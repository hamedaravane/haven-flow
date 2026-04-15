import { headers } from "next/headers"
import { and, count, eq, desc } from "drizzle-orm"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { wallets, transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { WALLET_TYPE_LABELS, type WalletType } from "@/lib/wallet-constants"
import { resolveDefaultCurrency } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WalletForm } from "@/components/features/wallet-form"
import { DeleteWalletButton } from "@/components/features/delete-buttons"
import { EditWalletSheet } from "@/components/features/edit-wallet-sheet"

export const metadata: Metadata = { title: "Wallets" }

export default async function WalletsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  // Load wallets for the current user only
  const userWallets = await db.query.wallets.findMany({
    where: and(
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
    orderBy: [desc(wallets.createdAt)],
  })

  // Fetch transaction counts per wallet in a single grouped query (avoids N+1)
  const txCountRows = await db
    .select({ walletId: transactions.walletId, txCount: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, household.id),
      )
    )
    .groupBy(transactions.walletId)

  const txCounts: Record<string, number> = {}
  for (const row of txCountRows) {
    if (row.walletId) txCounts[row.walletId] = row.txCount
  }

  // Group wallets by type for display
  const grouped: Record<WalletType, typeof userWallets> = {
    bank: [],
    card: [],
    crypto: [],
    cash: [],
    other: [],
  }
  for (const w of userWallets) {
    grouped[w.type as WalletType].push(w)
  }

  const TYPE_ORDER: WalletType[] = ["bank", "card", "crypto", "cash", "other"]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">My Wallets</h1>
        <p className="text-sm text-muted-foreground">
          Manage your financial accounts. Select one when recording a transaction.
        </p>
      </div>

      {/* Add wallet form */}
      <Card>
        <CardHeader>
          <CardTitle>Add a new wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <WalletForm defaultCurrency={household.defaultCurrency} />
        </CardContent>
      </Card>

      {/* Wallet list grouped by type */}
      {userWallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-3xl" aria-hidden>💳</span>
            <div>
              <p className="font-medium text-foreground">No wallets yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first wallet above to start linking transactions to accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        TYPE_ORDER.filter((type) => grouped[type].length > 0).map((type) => (
          <div key={type}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {WALLET_TYPE_LABELS[type]}
            </h2>
            <div className="flex flex-col gap-3">
              {grouped[type].map((w) => (
                <Card key={w.id}>
                  <CardContent className="flex items-center gap-3 py-3">
                    {/* Icon based on type */}
                    <span className="text-2xl" aria-hidden>
                      {WALLET_TYPE_LABELS[w.type as WalletType].split(" ")[0]}
                    </span>

                    {/* Main info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{w.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {w.currency}
                        </Badge>
                        {txCounts[w.id] > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {txCounts[w.id]} transaction{txCounts[w.id] !== 1 ? "s" : ""}
                          </span>
                        )}
                        {w.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {w.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <EditWalletSheet
                        walletId={w.id}
                        initialValues={{
                          name: w.name,
                          type: w.type as WalletType,
                          currency: resolveDefaultCurrency(w.currency),
                          description: w.description ?? "",
                        }}
                        defaultCurrency={household.defaultCurrency}
                      />
                      <DeleteWalletButton walletId={w.id} walletName={w.name} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
