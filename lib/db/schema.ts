import {
  pgTable,
  text,
  boolean,
  timestamp,
  decimal,
  pgEnum,
  uuid
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"])

export const inventoryLocationEnum = pgEnum("inventory_location", ["fridge", "pantry", "freezer"])

export const householdRoleEnum = pgEnum("household_role", ["owner", "member"])

// ─── Better Auth Tables ────────────────────────────────────────────────────────
// These exact column names are required by the Better Auth Drizzle adapter.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").$defaultFn(() => false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
})

// ─── HavenFlow Application Tables ─────────────────────────────────────────────

/**
 * A single household shared by up to two users.
 * All application data is scoped to one household.
 */
export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default("Our Home"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** Timestamp of the last push-notification batch sent for this household (for cooldown). */
  notificationsSentAt: timestamp("notifications_sent_at"),
})

/**
 * Links users to the household with an optional role.
 */
export const householdMembers = pgTable("household_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  role: householdRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
})

/**
 * Income and expense transactions.
 * isHouseholdExpense distinguishes shared costs from personal spending.
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  isHouseholdExpense: boolean("is_household_expense").notNull().default(true),
  transactionDate: timestamp("transaction_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * Monthly budget targets per category.
 * Actual spending is calculated from transactions.
 */
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  /** Format: YYYY-MM (e.g. "2025-01") */
  month: text("month").notNull(),
  category: text("category").notNull(),
  plannedAmount: decimal("planned_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * Optional product catalog to speed up inventory / shopping-list entry.
 */
export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  defaultUnit: text("default_unit"),
  defaultCategory: text("default_category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * Pantry / fridge / freezer inventory with expiration tracking.
 */
export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit: text("unit"),
  expiresAt: timestamp("expires_at"),
  location: inventoryLocationEnum("location").notNull().default("pantry"),
  addedBy: text("added_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * Collaborative shopping list — items can be checked off as purchased.
 */
export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit: text("unit"),
  isChecked: boolean("is_checked").notNull().default(false),
  addedBy: text("added_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * Browser push-notification subscriptions (one per device per user).
 * Stored so the server can send Web Push messages at any time.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  /** The push endpoint URL provided by the browser */
  endpoint: text("endpoint").notNull().unique(),
  /** Public key (base64url) for message encryption */
  p256dh: text("p256dh").notNull(),
  /** Auth secret (base64url) for message encryption */
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  householdMemberships: many(householdMembers),
  transactions: many(transactions),
  inventoryItems: many(inventory),
  shoppingListItems: many(shoppingListItems),
  pushSubscriptions: many(pushSubscriptions),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const householdRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  transactions: many(transactions),
  budgets: many(budgets),
  items: many(items),
  inventory: many(inventory),
  shoppingListItems: many(shoppingListItems),
  pushSubscriptions: many(pushSubscriptions),
}))

export const householdMemberRelations = relations(householdMembers, ({ one }) => ({
  user: one(user, { fields: [householdMembers.userId], references: [user.id] }),
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
}))

export const transactionRelations = relations(transactions, ({ one }) => ({
  household: one(households, {
    fields: [transactions.householdId],
    references: [households.id],
  }),
  user: one(user, { fields: [transactions.userId], references: [user.id] }),
}))

export const budgetRelations = relations(budgets, ({ one }) => ({
  household: one(households, {
    fields: [budgets.householdId],
    references: [households.id],
  }),
}))

export const itemRelations = relations(items, ({ one }) => ({
  household: one(households, { fields: [items.householdId], references: [households.id] }),
}))

export const inventoryRelations = relations(inventory, ({ one }) => ({
  household: one(households, {
    fields: [inventory.householdId],
    references: [households.id],
  }),
  addedByUser: one(user, { fields: [inventory.addedBy], references: [user.id] }),
}))

export const shoppingListItemRelations = relations(shoppingListItems, ({ one }) => ({
  household: one(households, {
    fields: [shoppingListItems.householdId],
    references: [households.id],
  }),
  addedByUser: one(user, { fields: [shoppingListItems.addedBy], references: [user.id] }),
}))

export const pushSubscriptionRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(user, { fields: [pushSubscriptions.userId], references: [user.id] }),
  household: one(households, {
    fields: [pushSubscriptions.householdId],
    references: [households.id],
  }),
}))
