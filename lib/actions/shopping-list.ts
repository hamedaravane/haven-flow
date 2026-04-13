"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { shoppingListItems, inventory } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"

// ─── Validation Schema ────────────────────────────────────────────────────────

const shoppingItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  quantity: z.coerce
    .number({ error: "Quantity must be a number" })
    .positive("Quantity must be positive"),
  unit: z
    .string()
    .optional()
    .transform((v) => v || null),
})

export type ShoppingItemInput = z.infer<typeof shoppingItemSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function addShoppingItem(input: ShoppingItemInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = shoppingItemSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, quantity, unit } = parsed.data

  await db.insert(shoppingListItems).values({
    householdId: household.id,
    addedBy: session.user.id,
    name,
    quantity: String(quantity),
    unit: unit ?? undefined,
    isChecked: false,
  })

  revalidatePath("/shopping-list")

  return { success: true }
}

export async function toggleShoppingItem(itemId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const existing = await db.query.shoppingListItems.findFirst({
    where: and(
      eq(shoppingListItems.id, itemId),
      eq(shoppingListItems.householdId, household.id)
    ),
  })
  if (!existing) return { error: "Item not found" }

  await db
    .update(shoppingListItems)
    .set({ isChecked: !existing.isChecked })
    .where(eq(shoppingListItems.id, itemId))

  revalidatePath("/shopping-list")

  return { success: true }
}

export async function deleteShoppingItem(itemId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const existing = await db.query.shoppingListItems.findFirst({
    where: and(
      eq(shoppingListItems.id, itemId),
      eq(shoppingListItems.householdId, household.id)
    ),
  })
  if (!existing) return { error: "Item not found" }

  await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId))

  revalidatePath("/shopping-list")

  return { success: true }
}

/**
 * Move an inventory item to the shopping list.
 * Adds it with the same name/quantity/unit as the inventory item.
 */
export async function addInventoryItemToShoppingList(inventoryItemId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const item = await db.query.inventory.findFirst({
    where: and(
      eq(inventory.id, inventoryItemId),
      eq(inventory.householdId, household.id)
    ),
  })
  if (!item) return { error: "Inventory item not found" }

  // Check if already on the shopping list (by name)
  const existingShoppingItem = await db.query.shoppingListItems.findFirst({
    where: and(
      eq(shoppingListItems.householdId, household.id),
      eq(shoppingListItems.name, item.name)
    ),
  })

  if (existingShoppingItem) {
    return { error: "Already on shopping list" }
  }

  await db.insert(shoppingListItems).values({
    householdId: household.id,
    addedBy: session.user.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit ?? undefined,
    isChecked: false,
  })

  revalidatePath("/shopping-list")
  revalidatePath("/inventory")

  return { success: true }
}

/**
 * Clear all checked items from the shopping list (post-shop cleanup).
 */
export async function clearCheckedItems() {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  await db
    .delete(shoppingListItems)
    .where(
      and(
        eq(shoppingListItems.householdId, household.id),
        eq(shoppingListItems.isChecked, true)
      )
    )

  revalidatePath("/shopping-list")

  return { success: true }
}
