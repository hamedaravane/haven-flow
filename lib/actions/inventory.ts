"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { inventory } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { INVENTORY_LOCATIONS } from "@/lib/constants"

// ─── Validation Schema ────────────────────────────────────────────────────────

const inventorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  quantity: z.coerce
    .number({ error: "Quantity must be a number" })
    .positive("Quantity must be positive"),
  unit: z
    .string()
    .optional()
    .transform((v) => v || null),
  /** ISO date string from <input type="date">, e.g. "2025-01-15" — optional */
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  location: z.enum(INVENTORY_LOCATIONS),
})

export type InventoryInput = z.infer<typeof inventorySchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createInventoryItem(input: InventoryInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = inventorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, quantity, unit, expiresAt, location } = parsed.data

  await db.insert(inventory).values({
    householdId: household.id,
    addedBy: session.user.id,
    name,
    quantity: String(quantity),
    unit: unit ?? undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    location,
  })

  revalidatePath("/inventory")
  revalidatePath("/shopping-list")
  revalidatePath("/dashboard")

  return { success: true }
}

export async function updateInventoryItem(itemId: string, input: InventoryInput) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const parsed = inventorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Verify ownership
  const existing = await db.query.inventory.findFirst({
    where: and(eq(inventory.id, itemId), eq(inventory.householdId, household.id)),
  })
  if (!existing) return { error: "Item not found" }

  const { name, quantity, unit, expiresAt, location } = parsed.data

  await db
    .update(inventory)
    .set({
      name,
      quantity: String(quantity),
      unit: unit ?? undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      location,
    })
    .where(eq(inventory.id, itemId))

  revalidatePath("/inventory")
  revalidatePath("/shopping-list")
  revalidatePath("/dashboard")

  return { success: true }
}

export async function deleteInventoryItem(itemId: string) {
  const session = await requireSession()
  const household = await getOrCreateHousehold(session.user.id)

  const existing = await db.query.inventory.findFirst({
    where: and(eq(inventory.id, itemId), eq(inventory.householdId, household.id)),
  })
  if (!existing) return { error: "Item not found" }

  await db.delete(inventory).where(eq(inventory.id, itemId))

  revalidatePath("/inventory")
  revalidatePath("/shopping-list")
  revalidatePath("/dashboard")

  return { success: true }
}
