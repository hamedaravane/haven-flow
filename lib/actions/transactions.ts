"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"

// ─── Validation Schema ────────────────────────────────────────────────────────

const transactionSchema = z.object({
  amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
  type: z.enum(["income", "expense"]),
  /** UUID of the selected category (leaf level — subcategory or top-level). */
  categoryId: z.string().uuid("Please select a valid category"),
  /** Currency code for this transaction (defaults to household default). */
  currency: z.string().min(1).default("IRR"),
  description: z.string().optional(),
  isHouseholdExpense: z.coerce.boolean().default(true),
  /** ISO date string from <input type="date"> e.g. "2025-01-15" */
  transactionDate: z.string().min(1, "Please pick a date"),
  /** Optional wallet/account UUID — new transactions should always include this. */
  walletId: z.string().uuid().optional().nullable(),
})

export type TransactionInput = z.infer<typeof transactionSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createTransaction(input: TransactionInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { amount, type, categoryId, currency, description, isHouseholdExpense, transactionDate, walletId } =
    parsed.data

  await db.insert(transactions).values({
    householdId: household.id,
    userId: session.user.id,
    amount: String(amount),
    type,
    categoryId,
    currency,
    description: description || null,
    isHouseholdExpense,
    transactionDate: new Date(transactionDate),
    walletId: walletId ?? null,
  })

  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  revalidatePath("/budgets")

  return { success: true }
}

export async function deleteTransaction(transactionId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  // Verify the transaction belongs to this household (security check)
  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.id, transactionId),
      eq(transactions.householdId, household.id)
    ),
  })

  if (!existing) {
    return { error: "Transaction not found" }
  }

  await db.delete(transactions).where(eq(transactions.id, transactionId))

  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  revalidatePath("/budgets")

  return { success: true }
}

export async function updateTransaction(transactionId: string, input: TransactionInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Verify ownership
  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.id, transactionId),
      eq(transactions.householdId, household.id)
    ),
  })

  if (!existing) {
    return { error: "Transaction not found" }
  }

  const { amount, type, categoryId, currency, description, isHouseholdExpense, transactionDate, walletId } =
    parsed.data

  await db
    .update(transactions)
    .set({
      amount: String(amount),
      type,
      categoryId,
      currency,
      description: description || null,
      isHouseholdExpense,
      transactionDate: new Date(transactionDate),
      walletId: walletId ?? null,
    })
    .where(eq(transactions.id, transactionId))

  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  revalidatePath("/budgets")

  return { success: true }
}
