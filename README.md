# 🏡 HavenFlow

A private, self-hosted Progressive Web App for two people to manage shared household finances, budgets, pantry inventory, and shopping lists.

---

## Features

- **Transactions** — track income and expenses, categorised, with shared/personal flag
- **Budgets** — monthly spending targets with real-time progress bars and >80% alerts
- **Dashboard** — at-a-glance money overview, expiring items, and budget status
- **Inventory** — pantry / fridge / freezer with expiration date tracking
- **Shopping List** — collaborative checklist with smart suggestions from inventory
- **Reports** — 6-month income vs expense bar chart and category breakdown
- **PWA** — installable on mobile and desktop, offline viewing of key pages
- **Push Notifications** — browser push via Web Push API (VAPID) for expiry and budget alerts
- **Dark Mode** — system-aware with manual toggle (press `D` to cycle)
- **Auth** — email + password sessions via Better Auth

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Better Auth |
| Database | PostgreSQL 16 + Drizzle ORM |
| Validation | Zod v4 + React Hook Form |
| Charts | Recharts |
| Push Notifications | Web Push API (VAPID, self-hosted) |
| Deployment | Docker Compose |

---

## Local Development

### Prerequisites

- Node.js 22+
- PostgreSQL 16 (local or Docker)
- npm

### Setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/hamedaravane/haven-flow.git
cd haven-flow
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL and BETTER_AUTH_SECRET at minimum

# 3. Run database migrations
npm run db:migrate

# 4. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | ✅ | Session signing secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of the app (e.g. `http://localhost:3000`) |
| `VAPID_PUBLIC_KEY` | Optional | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key for push notifications |
| `VAPID_SUBJECT` | Optional | VAPID contact email (`mailto:...`) |

**Generate VAPID keys:**
```bash
npx web-push generate-vapid-keys
```

### Useful Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm run db:generate  # Generate Drizzle migrations from schema changes
npm run db:migrate   # Apply pending migrations
npm run db:studio    # Open Drizzle Studio (DB browser)
```

---

## Docker Compose (Production)

### Quick Start

```bash
# 1. Create your environment file
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET and NEXT_PUBLIC_APP_URL

# 2. Build and start all services
docker compose up --build

# App: http://localhost:3000
# Migrations run automatically on container start
```

### Services

| Service | Image | Description |
|---|---|---|
| `app` | Built from `Dockerfile` | Next.js standalone server |
| `db` | `postgres:16-alpine` | PostgreSQL with persistent volume |

### Production Notes

- The `app` service **waits for `db` to be healthy** before starting (via `depends_on: condition: service_healthy`)
- Database migrations run automatically via `docker-entrypoint.sh` before the server starts
- The PostgreSQL port is **not exposed to the host** by default — uncomment the `ports` in `docker-compose.yml` for direct DB access during development
- All security headers are set in `next.config.mjs` (X-Frame-Options, CSP, etc.)

### Stopping / resetting

```bash
# Stop services
docker compose down

# Stop and wipe all data (including the database volume)
docker compose down -v
```

---

## Testing Checklist

### Authentication
- [ ] Register a new account at `/register`
- [ ] Log in at `/login`
- [ ] Verify redirect to `/dashboard` after login
- [ ] Log out and confirm redirect to `/login`
- [ ] Verify that protected routes redirect unauthenticated users

### Transactions
- [ ] Add an income transaction and verify it appears in the list
- [ ] Add an expense transaction with a category
- [ ] Verify the dashboard totals update immediately
- [ ] Delete a transaction and confirm it's removed

### Budgets
- [ ] Create a budget for a category (e.g. "Food & Groceries")
- [ ] Add expenses in that category and verify progress bar updates
- [ ] Exceed 80% of the budget and confirm the warning badge appears
- [ ] Delete a budget

### Inventory
- [ ] Add a pantry item with an expiration date 1 day from now
- [ ] Verify it shows a red "Expires tomorrow" badge
- [ ] Add a freezer item with no expiration date
- [ ] Click the cart icon → item should appear on the shopping list
- [ ] Edit and delete an inventory item

### Shopping List
- [ ] Add an item manually
- [ ] Accept a smart suggestion from the inventory panel
- [ ] Check off an item → it moves to the "Checked" section
- [ ] Use "Clear checked" to remove all checked items
- [ ] Delete a single item

### PWA Install + Offline
- [ ] Open in Chrome → click "Install" in the address bar
- [ ] App opens in standalone window with the HavenFlow icon
- [ ] Visit `/dashboard`, `/inventory`, `/shopping-list` (caches the pages)
- [ ] Toggle DevTools → Network → Offline
- [ ] Reload `/dashboard` — page still loads from cache

### Push Notifications
- [ ] Generate VAPID keys and add to `.env.local`
- [ ] Click the 🔔 bell icon in the header and allow notification permission
- [ ] Add an inventory item expiring within 2 days
- [ ] On next dashboard load, receive a push notification for the expiring item
- [ ] Add expenses until a budget category hits 80% → receive a budget alert push
- [ ] Click the bell again to unsubscribe

### Reports
- [ ] Navigate to `/reports`
- [ ] Verify the 6-month bar chart shows income/expense data
- [ ] Verify the category pie chart shows current-month spending breakdown
- [ ] Check summary cards (Net Saved, Avg Monthly Spend, Top Category)

### Dark Mode
- [ ] Click the 🌙 moon icon in the header to toggle dark mode
- [ ] Refresh — theme persists (stored in localStorage via next-themes)
- [ ] Press `D` key to toggle (keyboard shortcut)

---

## Recommended Future Improvements

- **Household invite system** — shareable join code so a second user can join the same household (currently each user auto-creates their own)
- **Receipt scanning** — attach photos or parse text from receipts
- **Recurring transactions** — auto-add monthly subscriptions or income
- **Budget rollover** — carry over unspent budget to the next month
- **Export to CSV** — download transactions for external tools
- **Multiple currencies** — for international households
- **iOS/Android app** — wrap the PWA with Capacitor for App Store distribution
- **E2E tests** — Playwright test suite for the critical user journeys above
