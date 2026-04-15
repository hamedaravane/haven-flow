"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions, wallets, categories } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { IMPORT_BATCH_SIZE } from "@/lib/csv-constants"

// ─── Input Schema ─────────────────────────────────────────────────────────────

const importRowSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  transactionDate: z.string().min(1),
  description: z.string(),
})

const importInputSchema = z.object({
  walletId: z.string().uuid("Please select a valid wallet"),
  skipDuplicates: z.boolean().default(true),
  rows: z.array(importRowSchema).min(1, "No rows to import"),
})

export type ImportRow = z.infer<typeof importRowSchema>
export type ImportInput = z.infer<typeof importInputSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Action ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  inserted: number
  skipped: number
  error?: string
}

/**
 * Batch-import parsed CSV rows as transactions.
 *
 * - Verifies the selected wallet belongs to the current user.
 * - Finds the household "Other" top-level category as the default categoryId.
 * - If skipDuplicates is true, filters out rows that already exist
 *   (matched by walletId + transactionDate + amount).
 * - Inserts in batches of IMPORT_BATCH_SIZE to stay within DB query size limits.
 */
export async function importTransactions(input: ImportInput): Promise<ImportResult> {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  // Validate input
  const parsed = importInputSchema.safeParse(input)
  if (!parsed.success) {
    return { inserted: 0, skipped: 0, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { walletId, skipDuplicates, rows } = parsed.data

  // Verify wallet ownership (must belong to current user in current household)
  const wallet = await db.query.wallets.findFirst({
    where: and(
      eq(wallets.id, walletId),
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
  })

  if (!wallet) {
    return { inserted: 0, skipped: 0, error: "Wallet not found or not owned by you" }
  }

  // Find the "Other" top-level category as the fallback categoryId
  const allTopCategories = await db.query.categories.findMany({
    where: and(
      eq(categories.householdId, household.id),
      isNull(categories.parentId)
    ),
  })

  // Pick "Other" as fallback, or the first category available
  const fallbackCategory =
    allTopCategories.find((c) => c.name.toLowerCase() === "other") ??
    allTopCategories[0] ??
    null

  // ── Duplicate detection ───────────────────────────────────────────────────
  let rowsToInsert = rows
  let skipped = 0

  if (skipDuplicates && rows.length > 0) {
    // Load existing transactions for this wallet to build a dedup key set
    const existingTxs = await db.query.transactions.findMany({
      where: and(
        eq(transactions.householdId, household.id),
        eq(transactions.walletId, walletId)
      ),
      columns: { amount: true, transactionDate: true },
    })

    // "YYYY-MM-DD|amount.toFixed(2)" key for fast lookup
    const existingKeys = new Set(
      existingTxs.map((tx) => {
        const d = new Date(tx.transactionDate).toISOString().split("T")[0]
        return `${d}|${parseFloat(tx.amount).toFixed(2)}`
      })
    )

    const filtered: typeof rows = []
    for (const row of rows) {
      const key = `${row.transactionDate}|${row.amount.toFixed(2)}`
      if (existingKeys.has(key)) {
        skipped++
      } else {
        filtered.push(row)
        // Add to set so duplicates within the same CSV file are also deduplicated
        existingKeys.add(key)
      }
    }
    rowsToInsert = filtered
  }

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped }
  }

  // ── Batch insert ──────────────────────────────────────────────────────────
  let inserted = 0
  const currency = wallet.currency || household.defaultCurrency

  for (let i = 0; i < rowsToInsert.length; i += IMPORT_BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + IMPORT_BATCH_SIZE)
    await db.insert(transactions).values(
      batch.map((row) => ({
        householdId: household.id,
        userId: session.user.id,
        walletId,
        amount: String(row.amount),
        currency,
        type: row.type,
        categoryId: fallbackCategory?.id ?? null,
        description: row.description || null,
        isHouseholdExpense: true,
        transactionDate: new Date(row.transactionDate),
      }))
    )
    inserted += batch.length
  }

  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  revalidatePath("/budgets")

  return { inserted, skipped }
}
