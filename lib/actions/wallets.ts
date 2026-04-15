"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { wallets } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { WALLET_TYPES } from "@/lib/wallet-constants"

// ─── Validation Schema ────────────────────────────────────────────────────────

const walletSchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Name is too long"),
  type: z.enum(WALLET_TYPES),
  currency: z.string().min(1, "Currency is required").max(10),
  description: z.string().max(200).optional(),
})

export type WalletInput = z.infer<typeof walletSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Return all wallets belonging to the current user (within their household). */
export async function getUserWallets() {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  return db.query.wallets.findMany({
    where: and(
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
    orderBy: (w, { asc }) => [asc(w.createdAt)],
  })
}

export async function createWallet(input: WalletInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = walletSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, type, currency, description } = parsed.data

  await db.insert(wallets).values({
    householdId: household.id,
    userId: session.user.id,
    name,
    type,
    currency,
    description: description || null,
  })

  revalidatePath("/wallets")
  revalidatePath("/transactions")

  return { success: true }
}

export async function updateWallet(walletId: string, input: WalletInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = walletSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Verify ownership: wallet must belong to this user in this household
  const existing = await db.query.wallets.findFirst({
    where: and(
      eq(wallets.id, walletId),
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
  })

  if (!existing) {
    return { error: "Wallet not found" }
  }

  const { name, type, currency, description } = parsed.data

  await db
    .update(wallets)
    .set({
      name,
      type,
      currency,
      description: description || null,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))

  revalidatePath("/wallets")
  revalidatePath("/transactions")

  return { success: true }
}

export async function deleteWallet(walletId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  // Verify ownership
  const existing = await db.query.wallets.findFirst({
    where: and(
      eq(wallets.id, walletId),
      eq(wallets.householdId, household.id),
      eq(wallets.userId, session.user.id)
    ),
  })

  if (!existing) {
    return { error: "Wallet not found" }
  }

  await db.delete(wallets).where(eq(wallets.id, walletId))

  revalidatePath("/wallets")
  revalidatePath("/transactions")

  return { success: true }
}
