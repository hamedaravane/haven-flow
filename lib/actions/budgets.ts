"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { budgets } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"

// ─── Validation Schema ────────────────────────────────────────────────────────

const budgetSchema = z.object({
  /** YYYY-MM format, e.g. "2025-01" */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  category: z.string().min(1, "Please select a category"),
  plannedAmount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
})

export type BudgetInput = z.infer<typeof budgetSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function upsertBudget(input: BudgetInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = budgetSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { month, category, plannedAmount } = parsed.data

  // Check if a budget already exists for this household/month/category
  const existing = await db.query.budgets.findFirst({
    where: and(
      eq(budgets.householdId, household.id),
      eq(budgets.month, month),
      eq(budgets.category, category)
    ),
  })

  if (existing) {
    await db
      .update(budgets)
      .set({ plannedAmount: String(plannedAmount) })
      .where(eq(budgets.id, existing.id))
  } else {
    await db.insert(budgets).values({
      householdId: household.id,
      month,
      category,
      plannedAmount: String(plannedAmount),
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/budgets")

  return { success: true }
}

export async function deleteBudget(budgetId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  // Verify ownership
  const existing = await db.query.budgets.findFirst({
    where: and(
      eq(budgets.id, budgetId),
      eq(budgets.householdId, household.id)
    ),
  })

  if (!existing) {
    return { error: "Budget not found" }
  }

  await db.delete(budgets).where(eq(budgets.id, budgetId))

  revalidatePath("/dashboard")
  revalidatePath("/budgets")

  return { success: true }
}
