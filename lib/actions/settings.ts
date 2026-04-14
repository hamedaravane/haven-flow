"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, households, householdMembers } from "@/lib/db/schema"
import { CURRENCIES } from "@/lib/constants"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const updateNameSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(80, "Name is too long"),
})

const updateCurrencySchema = z.object({
  currency: z.enum([...CURRENCIES] as [string, ...string[]]),
})

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Update the current user's display name.
 */
export async function updateUserName(input: { name: string }) {
  const session = await requireSession()

  const parsed = updateNameSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await db.update(user).set({ name: parsed.data.name }).where(eq(user.id, session.user.id))

  revalidatePath("/settings")
  revalidatePath("/dashboard")

  return { success: true }
}

/**
 * Update the default currency for the current user's household.
 */
export async function updateHouseholdCurrency(input: { currency: string }) {
  const session = await requireSession()

  const parsed = updateCurrencySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Find the user's household membership
  const membership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, session.user.id),
  })

  if (!membership) {
    return { error: "No household found" }
  }

  await db
    .update(households)
    .set({ defaultCurrency: parsed.data.currency })
    .where(eq(households.id, membership.householdId))

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  revalidatePath("/reports")
  revalidatePath("/budgets")

  return { success: true }
}
