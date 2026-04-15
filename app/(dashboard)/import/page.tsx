import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { wallets } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CsvImportForm } from "@/components/features/csv-import-form"

export const metadata: Metadata = { title: "Import CSV" }

export default async function ImportPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  // Load the current user's wallets so the import form can assign transactions to an account
  const userWallets = await db.query.wallets.findMany({
    where: and(
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
    orderBy: (w, { asc }) => [asc(w.createdAt)],
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Import transactions from your Iranian bank export (Mellat, Saman, etc.).
        </p>
      </div>

      {userWallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-3xl" aria-hidden>💳</span>
            <div>
              <p className="font-medium text-foreground">No wallets yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You need at least one wallet/account before importing transactions.{" "}
                <Link href="/wallets" className="text-primary underline underline-offset-2">
                  Add a wallet
                </Link>
                {" "}first.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upload bank statement</CardTitle>
          </CardHeader>
          <CardContent>
            <CsvImportForm wallets={userWallets} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
