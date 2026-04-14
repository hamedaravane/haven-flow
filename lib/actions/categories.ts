"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, isNull, count } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { categories, transactions, budgets } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"

// ─── Validation Schemas ───────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  parentId: z.string().uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #f59e0b")
    .nullable()
    .optional(),
  icon: z.string().max(10, "Icon is too long").nullable().optional(),
})

export type CategoryInput = z.infer<typeof categorySchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

function revalidateAll() {
  revalidatePath("/categories")
  revalidatePath("/transactions")
  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Return all categories for the given household, structured as a flat list
 * with top-level categories first, then their subcategories.
 * Each top-level entry includes its `subcategories` array for convenient UI rendering.
 */
export async function getHouseholdCategories(householdId: string) {
  const topLevel = await db.query.categories.findMany({
    where: and(eq(categories.householdId, householdId), isNull(categories.parentId)),
    with: { subcategories: { orderBy: (c, { asc }) => [asc(c.name)] } },
    orderBy: (c, { asc }) => [asc(c.name)],
  })
  return topLevel
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createCategory(input: CategoryInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, parentId, color, icon } = parsed.data

  // ── Depth guard: a subcategory cannot be a parent ──────────────────────────
  if (parentId) {
    const parent = await db.query.categories.findFirst({
      where: and(eq(categories.id, parentId), eq(categories.householdId, household.id)),
    })
    if (!parent) return { error: "Parent category not found" }
    if (parent.parentId !== null) {
      return { error: "Cannot create a category under a subcategory (max depth is 2)" }
    }
  }

  // ── Unique name check per household (case-insensitive) ────────────────────
  const allCats = await db.query.categories.findMany({
    where: eq(categories.householdId, household.id),
  })
  const nameLower = name.toLowerCase()
  const exists = allCats.some((c) => c.name.toLowerCase() === nameLower)
  if (exists) {
    return { error: `A category named "${name}" already exists` }
  }

  await db.insert(categories).values({
    householdId: household.id,
    name: name.trim(),
    parentId: parentId ?? null,
    color: color ?? null,
    icon: icon ?? null,
  })

  revalidateAll()
  return { success: true }
}

export async function updateCategory(categoryId: string, input: CategoryInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Verify ownership
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.householdId, household.id)),
  })
  if (!existing) return { error: "Category not found" }

  const { name, parentId, color, icon } = parsed.data

  // ── Depth guard ────────────────────────────────────────────────────────────
  if (parentId) {
    const parent = await db.query.categories.findFirst({
      where: and(eq(categories.id, parentId), eq(categories.householdId, household.id)),
    })
    if (!parent) return { error: "Parent category not found" }
    if (parent.parentId !== null) {
      return { error: "Cannot nest beyond 2 levels" }
    }
    // Can't set a top-level category as its own child (would create a cycle)
    if (parentId === categoryId) {
      return { error: "A category cannot be its own parent" }
    }
  }

  // ── Unique name check (exclude self) ──────────────────────────────────────
  const allCats = await db.query.categories.findMany({
    where: eq(categories.householdId, household.id),
  })
  const nameLower = name.toLowerCase()
  const duplicate = allCats.find(
    (c) => c.name.toLowerCase() === nameLower && c.id !== categoryId
  )
  if (duplicate) {
    return { error: `A category named "${name}" already exists` }
  }

  await db
    .update(categories)
    .set({
      name: name.trim(),
      parentId: parentId ?? null,
      color: color ?? null,
      icon: icon ?? null,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId))

  revalidateAll()
  return { success: true }
}

export async function deleteCategory(categoryId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  // Verify ownership
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.householdId, household.id)),
    with: { subcategories: true },
  })
  if (!existing) return { error: "Category not found" }

  // Prevent deletion if any transactions reference this category
  const [txCount] = await db
    .select({ value: count() })
    .from(transactions)
    .where(eq(transactions.categoryId, categoryId))

  if ((txCount?.value ?? 0) > 0) {
    const n = txCount!.value
    return {
      error: `Cannot delete: ${n} ${n === 1 ? "transaction" : "transactions"} use this category. Reassign them first.`,
    }
  }

  // Also check subcategories for transactions
  if (existing.subcategories.length > 0) {
    const subIds = existing.subcategories.map((s) => s.id)
    for (const subId of subIds) {
      const [subTxCount] = await db
        .select({ value: count() })
        .from(transactions)
        .where(eq(transactions.categoryId, subId))
      if ((subTxCount?.value ?? 0) > 0) {
        return {
          error: `Cannot delete: subcategory "${existing.subcategories.find((s) => s.id === subId)?.name}" has transactions. Reassign them first.`,
        }
      }
    }
  }

  // Also check budgets
  const [budgetCount] = await db
    .select({ value: count() })
    .from(budgets)
    .where(eq(budgets.categoryId, categoryId))

  if ((budgetCount?.value ?? 0) > 0) {
    const n = budgetCount!.value
    return {
      error: `Cannot delete: ${n} ${n === 1 ? "budget" : "budgets"} use this category. Delete them first.`,
    }
  }

  await db.delete(categories).where(eq(categories.id, categoryId))

  revalidateAll()
  return { success: true }
}
