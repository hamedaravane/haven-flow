import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { categories, households, householdMembers } from "@/lib/db/schema"

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

  // Seed the household with a sensible set of default categories
  await seedDefaultCategories(household.id)

  return household
}

/**
 * Default two-level category tree seeded for every new household.
 * Top-level categories capture broad spending buckets; subcategories let users
 * drill into specifics (e.g. "Office Lunch" vs "Restaurant" under "Dining Out").
 */
const DEFAULT_CATEGORIES: Array<{
  name: string
  color: string
  icon: string
  subcategories: Array<{ name: string; icon: string }>
}> = [
  {
    name: "Food & Groceries",
    color: "#10b981",
    icon: "🛒",
    subcategories: [
      { name: "Regular Groceries", icon: "🥦" },
      { name: "Organic & Health", icon: "🌿" },
    ],
  },
  {
    name: "Dining Out",
    color: "#f59e0b",
    icon: "🍽️",
    subcategories: [
      { name: "Restaurant", icon: "🍷" },
      { name: "Office Lunch", icon: "🥗" },
      { name: "Coffee & Snacks", icon: "☕" },
    ],
  },
  {
    name: "Transport",
    color: "#3b82f6",
    icon: "🚗",
    subcategories: [
      { name: "Public Transit", icon: "🚌" },
      { name: "Fuel", icon: "⛽" },
      { name: "Parking & Tolls", icon: "🅿️" },
    ],
  },
  {
    name: "Housing",
    color: "#8b5cf6",
    icon: "🏠",
    subcategories: [
      { name: "Rent / Mortgage", icon: "🔑" },
      { name: "Maintenance", icon: "🔧" },
    ],
  },
  {
    name: "Utilities",
    color: "#06b6d4",
    icon: "💡",
    subcategories: [
      { name: "Electricity & Gas", icon: "⚡" },
      { name: "Internet & Phone", icon: "📡" },
    ],
  },
  {
    name: "Health",
    color: "#ef4444",
    icon: "❤️",
    subcategories: [
      { name: "Doctor & Pharmacy", icon: "💊" },
      { name: "Gym & Fitness", icon: "🏋️" },
    ],
  },
  {
    name: "Entertainment",
    color: "#ec4899",
    icon: "🎬",
    subcategories: [
      { name: "Streaming & Subscriptions", icon: "📺" },
      { name: "Events & Activities", icon: "🎭" },
    ],
  },
  {
    name: "Shopping",
    color: "#f97316",
    icon: "🛍️",
    subcategories: [
      { name: "Clothing", icon: "👕" },
      { name: "Electronics", icon: "💻" },
    ],
  },
  {
    name: "Personal Care",
    color: "#a855f7",
    icon: "🧴",
    subcategories: [],
  },
  {
    name: "Education",
    color: "#14b8a6",
    icon: "📚",
    subcategories: [],
  },
  {
    name: "Gifts",
    color: "#e879f9",
    icon: "🎁",
    subcategories: [],
  },
  {
    name: "Savings",
    color: "#22c55e",
    icon: "🐷",
    subcategories: [],
  },
  {
    name: "Income",
    color: "#16a34a",
    icon: "💰",
    subcategories: [
      { name: "Salary", icon: "💼" },
      { name: "Freelance", icon: "🖥️" },
      { name: "Investment", icon: "📈" },
      { name: "Refund", icon: "↩️" },
    ],
  },
  {
    name: "Other",
    color: "#6b7280",
    icon: "📦",
    subcategories: [],
  },
]

/**
 * Seed a new household with the default two-level category tree.
 * Called automatically when a household is first created.
 */
export async function seedDefaultCategories(householdId: string) {
  for (const topLevel of DEFAULT_CATEGORIES) {
    const [parent] = await db
      .insert(categories)
      .values({
        householdId,
        name: topLevel.name,
        color: topLevel.color,
        icon: topLevel.icon,
      })
      .returning()

    if (topLevel.subcategories.length > 0) {
      await db.insert(categories).values(
        topLevel.subcategories.map((sub) => ({
          householdId,
          name: sub.name,
          icon: sub.icon,
          parentId: parent.id,
        }))
      )
    }
  }
}
