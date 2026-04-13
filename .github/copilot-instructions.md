# HavenFlow — GitHub Copilot Agent Instructions

## Project Overview
HavenFlow is a private, self-hosted Progressive Web App (PWA) built for exactly two people — me and my spouse.  
It helps us manage:
- Shared household expenses and personal spending
- Monthly budgets with early warning alerts (no more mid-month money shortages)
- Smart pantry and inventory tracking with expiration dates (prevent spoiled fruit and duplicate supermarket buys)
- Intelligent shopping list that knows what we already have at home
- Simple insights and waste tracking

Goal: Create a calm, organized system for our home finances and daily household needs. The app should feel like a helpful companion we both open every day.

## Core Principles for All Generated Code
- Keep everything simple, clean, and focused on two users only.
- Use TypeScript with strict mode.
- Prefer Server Actions and React Server Components whenever possible.
- All forms must use Zod + react-hook-form + shadcn/ui components.
- Never introduce external paid or managed services.
- Code must be well-commented and easy for future iterations with Copilot agents.
- Make the UI mobile-first and delightful for daily phone use.

## App Name & Branding
- Name: HavenFlow
- Feel: Warm, calm, trustworthy, minimalist. 
- Use soft colors and clean layouts. No flashy elements.

## Tech Stack (Strict — Do Not Deviate)
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Better Auth (for authentication — email/password + sessions)
- PostgreSQL + Drizzle ORM
- Zod for validation
- Recharts for simple charts
- Web Push API for browser notifications (self-hosted with VAPID keys)
- Docker Compose for the entire stack

## Database
- Use Drizzle ORM with schema defined in `lib/db/schema.ts`
- All data must be scoped to the single household
- No receipt photo handling or file uploads in this version

## Authentication (Better Auth)
- Email + password login only for now
- Secure sessions stored in PostgreSQL
- Protected routes and middleware
- After login, users automatically belong to the single "HavenFlow" household

## Key Tables (High-level — implement exactly)
- users (from Better Auth)
- households (single household record)
- household_members (links users to household)
- transactions (amount, type: income/expense, category, description, isHouseholdExpense, transactionDate, added by user)
- budgets (month, category, plannedAmount — spent calculated from transactions)
- items (optional catalog for common products)
- inventory (name, quantity, unit, expiresAt, location: fridge/pantry/freezer, addedBy)
- shopping_list_items (name, quantity, unit, isChecked)

## Folder Structure (Follow Exactly)
```
haven-flow/
├── app/
│   ├── (auth)/          # login, register
│   ├── (dashboard)/     # protected pages: dashboard, transactions, budgets, inventory, shopping-list, reports
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/              # shadcn components
│   └── features/        # custom feature components
├── lib/
│   ├── db/              # schema.ts, index.ts, drizzle.config.ts
│   ├── auth.ts          # Better Auth configuration
│   └── utils.ts
├── public/              # manifest.json, icons for PWA
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── package.json
```

## Development & Deployment Requirements
- Provide a complete `docker-compose.yml` with `app` (Next.js) and `db` (PostgreSQL) services
- Persistent volume for PostgreSQL data
- Next.js built in standalone mode for Docker
- PWA support with manifest and service worker (offline viewing of key screens)
- Environment variables clearly documented in .env.example

## Implementation Order (Follow this sequence)
1. Project setup, dependencies, Better Auth integration, DB connection
2. Database schema + migrations
3. Authentication pages and protected routes
4. Household setup (single household for two users)
5. Transaction management (CRUD + household vs personal)
6. Budget system with real-time calculations and warnings
7. Main Dashboard (money overview, expiring items, budget status)
8. Inventory management with expiration dates and locations
9. Shopping list with smart suggestions from inventory
10. PWA configuration + basic offline support
11. Browser push notifications (expiring soon, budget alerts)
12. Basic monthly report view

## Coding Guidelines
- All mutations via Server Actions
- Queries must respect current user’s household
- Use shadcn/ui consistently for all forms, tables, cards, and buttons
- Make alerts and warnings prominent but not annoying
- Keep the app fast and responsive on mobile
