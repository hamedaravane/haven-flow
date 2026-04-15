"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, households, householdMembers } from "@/lib/db/schema"
import { CURRENCIES } from "@/lib/constants"
import type { CalendarSystem } from "@/lib/date-utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Unauthorized")
  return session
}

/** Return the current user's household membership, or throw. */
async function requireMembership(userId: string) {
  const membership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, userId),
  })
  if (!membership) throw new Error("No household found")
  return membership
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const updateNameSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(80, "Name is too long"),
})

const updateCurrencySchema = z.object({
  currency: z.enum([...CURRENCIES] as [string, ...string[]]),
})

const calendarSystemSchema = z.object({
  calendarSystem: z.enum(["jalali", "gregorian"]),
})

const householdNameSchema = z.object({
  name: z.string().min(1, "Household name cannot be empty").max(80, "Name is too long"),
})

const inviteEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
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

/**
 * Rename the household. Only the owner may do this.
 */
export async function updateHouseholdName(input: { name: string }) {
  const session = await requireSession()

  const parsed = householdNameSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const membership = await requireMembership(session.user.id)

  if (membership.role !== "owner") {
    return { error: "Only the household owner can rename it" }
  }

  await db
    .update(households)
    .set({ name: parsed.data.name })
    .where(eq(households.id, membership.householdId))

  revalidatePath("/settings")
  revalidatePath("/dashboard")

  return { success: true }
}

/**
 * Add a member to the household by email.
 *
 * MVP rules:
 * - A user with the given email must already be registered.
 * - They must not already belong to the inviting household.
 * - The household must have fewer than 2 members (2-person model).
 * - Any current member may invite (not just owner), keeping it approachable.
 */
export async function inviteMember(input: { email: string }) {
  const session = await requireSession()

  const parsed = inviteEmailSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  /** Normalised once — used for all comparisons and DB lookups. */
  const normalizedEmail = parsed.data.email.toLowerCase()

  const inviterMembership = await requireMembership(session.user.id)

  // Enforce 2-person limit
  const existingMembers = await db.query.householdMembers.findMany({
    where: eq(householdMembers.householdId, inviterMembership.householdId),
  })
  if (existingMembers.length >= 2) {
    return { error: "This household already has 2 members — no more can be added" }
  }

  // Cannot invite yourself
  if (normalizedEmail === session.user.email.toLowerCase()) {
    return { error: "You are already a member of this household" }
  }

  // Look up the target user — use a case-insensitive DB comparison
  const targetUser = await db.query.user.findFirst({
    where: sql`lower(${user.email}) = ${normalizedEmail}`,
  })

  if (!targetUser) {
    return {
      notFound: true,
      message:
        "No account found for that email. Ask them to register at HavenFlow first, then invite them.",
    }
  }

  // Check if they are already in ANY household — we require they be in none
  // (since each user should belong to exactly one household)
  const targetMembership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, targetUser.id),
  })

  if (targetMembership) {
    if (targetMembership.householdId === inviterMembership.householdId) {
      return { error: `${targetUser.name} is already a member of this household` }
    }
    return {
      error: `${targetUser.name} already belongs to another household and cannot be added`,
    }
  }

  // Add them as a member
  await db.insert(householdMembers).values({
    userId: targetUser.id,
    householdId: inviterMembership.householdId,
    role: "member",
  })

  revalidatePath("/settings")

  return { success: true, addedName: targetUser.name }
}

/**
 * Remove a member from the household. Only the owner can remove others;
 * any member can remove themselves (leave).
 */
export async function removeMember(input: { memberId: string }) {
  const session = await requireSession()

  const callerMembership = await requireMembership(session.user.id)

  // Find the membership to remove
  const target = await db.query.householdMembers.findFirst({
    where: and(
      eq(householdMembers.id, input.memberId),
      eq(householdMembers.householdId, callerMembership.householdId)
    ),
  })

  if (!target) {
    return { error: "Member not found in this household" }
  }

  // Owner cannot be removed (they would need to transfer ownership first)
  if (target.role === "owner") {
    return { error: "The household owner cannot be removed" }
  }

  // Non-owners can only remove themselves
  if (callerMembership.role !== "owner" && target.userId !== session.user.id) {
    return { error: "Only the owner can remove other members" }
  }

  await db.delete(householdMembers).where(eq(householdMembers.id, input.memberId))

  revalidatePath("/settings")

  return { success: true }
}

/**
 * Update the calendar system preference for the household.
 * This affects how all dates are displayed across the app.
 */
export async function updateCalendarSystem(input: { calendarSystem: CalendarSystem }) {
  const session = await requireSession()

  const parsed = calendarSystemSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const membership = await requireMembership(session.user.id)

  await db
    .update(households)
    .set({ calendarSystem: parsed.data.calendarSystem })
    .where(eq(households.id, membership.householdId))

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  revalidatePath("/budgets")
  revalidatePath("/reports")
  revalidatePath("/inventory")

  return { success: true }
}
