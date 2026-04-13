import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { households, householdMembers } from "@/lib/db/schema"

/**
 * Return the household that the user belongs to, or null if they have none.
 */
export async function getUserHousehold(userId: string) {
  const membership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, userId),
    with: { household: true },
  })
  return membership?.household ?? null
}

/**
 * Return the user's household, auto-creating one if this is their first visit.
 * For HavenFlow's 2-person household model, the second user joins via the
 * household setup flow (Phase 4). Until then, each user gets their own household.
 */
export async function getOrCreateHousehold(userId: string) {
  const existing = await getUserHousehold(userId)
  if (existing) return existing

  // Auto-create a household and make the user the owner
  const [household] = await db
    .insert(households)
    .values({ name: "Our Home" })
    .returning()

  await db.insert(householdMembers).values({
    userId,
    householdId: household.id,
    role: "owner",
  })

  return household
}
