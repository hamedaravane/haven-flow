import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { householdMembers } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import {
  ProfileSection,
  CurrencySection,
  AppearanceSection,
  AccountSection,
  HouseholdSection,
  CalendarSection,
  type HouseholdMember,
} from "@/components/features/settings-sections"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  // Load all members with their user records for the household section
  const rawMembers = await db.query.householdMembers.findMany({
    where: eq(householdMembers.householdId, household.id),
    with: { user: true },
    orderBy: (m, { asc }) => [asc(m.joinedAt)],
  })

  const members: HouseholdMember[] = rawMembers.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.joinedAt,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    },
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, household, currency, and preferences.
        </p>
      </div>

      <ProfileSection initialName={session.user.name} email={session.user.email} />

      <HouseholdSection
        householdName={household.name}
        members={members}
        currentUserId={session.user.id}
      />

      <CurrencySection defaultCurrency={household.defaultCurrency} />

      <CalendarSection calendarSystem={(household.calendarSystem as "jalali" | "gregorian") ?? "jalali"} />

      <AppearanceSection />

      <AccountSection />
    </div>
  )
}
