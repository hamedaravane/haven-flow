import { headers } from "next/headers"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { getOrCreateHousehold } from "@/lib/db/queries"
import {
  ProfileSection,
  CurrencySection,
  AppearanceSection,
  AccountSection,
} from "@/components/features/settings-sections"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, currency, and preferences.
        </p>
      </div>

      <ProfileSection initialName={session.user.name} email={session.user.email} />

      <CurrencySection defaultCurrency={household.defaultCurrency} />

      <AppearanceSection />

      <AccountSection />
    </div>
  )
}
