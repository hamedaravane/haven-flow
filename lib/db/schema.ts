import {
  pgTable,
  text,
  boolean,
  timestamp,
  decimal,
  pgEnum,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"])

export const inventoryLocationEnum = pgEnum("inventory_location", ["fridge", "pantry", "freezer"])

export const householdRoleEnum = pgEnum("household_role", ["owner", "member"])

/**
 * Wallet / account types supported by HavenFlow.
 * bank    — traditional bank account (e.g. Mellat, Tejarat)
 * card    — debit/credit card linked to a bank account
 * crypto  — cryptocurrency wallet (Binance, Trust Wallet, etc.)
 * cash    — physical cash on hand
 * other   — anything that doesn't fit the above
 */
export const walletTypeEnum = pgEnum("wallet_type", ["bank", "card", "crypto", "cash", "other"])

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
 * User-defined spending/income categories per household.
 * Supports a two-level hierarchy: top-level categories and subcategories.
 * parentId IS NULL  → top-level category (e.g. "Dining Out")
 * parentId IS SET   → subcategory (e.g. "Office Lunch" under "Dining Out")
 * Max depth enforced in code: a subcategory cannot have children.
 */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Null for top-level; points to a top-level category for subcategories. */
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "cascade",
  }),
  /** Optional hex color for UI swatches (e.g. "#f59e0b"). */
  color: text("color"),
  /** Optional emoji or lucide icon name for visual cues (e.g. "🍕" or "utensils"). */
  icon: text("icon"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

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
  /** Default currency for all household transactions (e.g. 'IRR', 'USD', 'USDT'). */
  defaultCurrency: text("default_currency").notNull().default("IRR"),

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
 * Financial accounts / wallets owned by individual users.
 * Each user manages their own set of accounts; all are scoped to the household.
 * type   — bank | card | crypto | cash | other
 * currency — e.g. 'IRR', 'USD', 'USDT'
 */
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: walletTypeEnum("type").notNull().default("bank"),
  /** ISO currency code or crypto ticker (e.g. 'IRR', 'USD', 'USDT'). */
  currency: text("currency").notNull().default("IRR"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

/**
 * Income and expense transactions.
 * isHouseholdExpense distinguishes shared costs from personal spending.
 * categoryId references the categories table (leaf level — subcategory if available).
 * category (text) is kept for backward-compatibility with any data entered before
 * categories were introduced; new transactions always populate categoryId.
 * walletId references the wallets table — the account used for this transaction.
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** The wallet/account this transaction was made from. Nullable for legacy records. */
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  /** Currency code for this transaction (e.g. 'IRR', 'USD', 'USDT'). */
  currency: text("currency").notNull().default("IRR"),
  type: transactionTypeEnum("type").notNull(),
  /** Legacy text category — kept for data entered before the categories table existed. */
  category: text("category"),
  /** FK to the categories table — used for all new transactions. */
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  description: text("description"),
  isHouseholdExpense: boolean("is_household_expense").notNull().default(true),
  transactionDate: timestamp("transaction_date").notNull().defaultNow(),
  /**
   * Origin of this transaction:
   * null  → manually entered via the UI
   * 'csv' → imported from a CSV bank statement
   */
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * Monthly budget targets per category.
 * Actual spending is calculated from transactions.
 * Budgets are linked to top-level categories for an easy rollup view.
 * categoryId is preferred; the legacy category text is kept for backward compat.
 */
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  /** Format: YYYY-MM (e.g. "2025-01") */
  month: text("month").notNull(),
  /** Legacy text category — kept for data entered before the categories table existed. */
  category: text("category"),
  /** FK to the categories table — used for all new budgets. */
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
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

export const categoryRelations = relations(categories, ({ one, many }) => ({
  household: one(households, {
    fields: [categories.householdId],
    references: [households.id],
  }),
  /** The parent top-level category (null for top-level categories). */
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parentChild",
  }),
  /** Subcategories that belong to this top-level category. */
  subcategories: many(categories, { relationName: "parentChild" }),
  transactions: many(transactions),
  budgets: many(budgets),
}))

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  householdMemberships: many(householdMembers),
  transactions: many(transactions),
  inventoryItems: many(inventory),
  shoppingListItems: many(shoppingListItems),
  pushSubscriptions: many(pushSubscriptions),
  wallets: many(wallets),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const householdRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  items: many(items),
  inventory: many(inventory),
  shoppingListItems: many(shoppingListItems),
  pushSubscriptions: many(pushSubscriptions),
  wallets: many(wallets),
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
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
}))

export const budgetRelations = relations(budgets, ({ one }) => ({
  household: one(households, {
    fields: [budgets.householdId],
    references: [households.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
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

export const walletRelations = relations(wallets, ({ one, many }) => ({
  household: one(households, {
    fields: [wallets.householdId],
    references: [households.id],
  }),
  user: one(user, { fields: [wallets.userId], references: [user.id] }),
  transactions: many(transactions),
}))
