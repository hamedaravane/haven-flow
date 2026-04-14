"use client"

import { useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LogOut, User, Globe, Palette, Home, UserPlus, Crown, UserMinus } from "lucide-react"

import {
  updateUserName,
  updateHouseholdCurrency,
  updateHouseholdName,
  inviteMember,
  removeMember,
} from "@/lib/actions/settings"
import { CURRENCIES, CURRENCY_LABELS, type Currency } from "@/lib/constants"
import { signOut } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

// ─── Profile section ─────────────────────────────────────────────────────────

const nameSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(80, "Name is too long"),
})
type NameValues = z.output<typeof nameSchema>

interface ProfileSectionProps {
  initialName: string
  email: string
}

export function ProfileSection({ initialName, email }: ProfileSectionProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema) as Resolver<NameValues>,
    defaultValues: { name: initialName },
  })

  function onSubmit(values: NameValues) {
    startTransition(async () => {
      const result = await updateUserName(values)
      if (result.error) {
        toast(result.error, { variant: "error" })
      } else {
        toast("Display name updated", { variant: "success" })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Email — read-only */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <span className="rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {email}
          </span>
        </div>

        {/* Name — editable */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Saving…" : "Save name"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ─── Currency section ─────────────────────────────────────────────────────────

interface CurrencySectionProps {
  defaultCurrency: string
}

export function CurrencySection({ defaultCurrency }: CurrencySectionProps) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState(defaultCurrency)

  function handleSave() {
    startTransition(async () => {
      const result = await updateHouseholdCurrency({ currency: selected })
      if (result.error) {
        toast(result.error, { variant: "error" })
      } else {
        toast("Default currency updated", { variant: "success" })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4" />
          Currency Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          The default currency used when adding new transactions. You can still override
          it per transaction.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="currency-select">
              Default currency
            </label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="currency-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CURRENCY_LABELS[c as Currency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={isPending || selected === defaultCurrency} className="sm:w-auto">
            {isPending ? "Saving…" : "Save currency"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Appearance section ───────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: "light", label: "☀️ Light" },
  { value: "dark", label: "🌙 Dark" },
  { value: "system", label: "💻 System" },
]

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4" />
          Appearance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Choose how HavenFlow looks on your device.
        </p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-1 flex-col items-center rounded-2xl border px-3 py-3 text-sm transition-colors ${
                theme === opt.value
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Account section ──────────────────────────────────────────────────────────

export function AccountSection() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(() => {
      void signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login")
          },
        },
      })
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogOut className="size-4" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign out</p>
            <p className="text-xs text-muted-foreground">
              You will be redirected to the login page.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout} disabled={isPending}>
            {isPending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Household section ────────────────────────────────────────────────────────

/** Shape of a member passed from the server page. */
export interface HouseholdMember {
  id: string
  role: "owner" | "member"
  joinedAt: Date
  user: { id: string; name: string; email: string }
}

interface HouseholdSectionProps {
  householdId: string
  householdName: string
  members: HouseholdMember[]
  /** The currently signed-in user's id — used to identify "you" in the list. */
  currentUserId: string
}

const householdNameSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(80, "Name is too long"),
})
type HouseholdNameValues = z.output<typeof householdNameSchema>

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})
type InviteValues = z.output<typeof inviteSchema>

export function HouseholdSection({
  householdId,
  householdName,
  members,
  currentUserId,
}: HouseholdSectionProps) {
  const [isPendingName, startNameTransition] = useTransition()
  const [isPendingInvite, startInviteTransition] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  /** Message shown after an invite attempt for a non-existent user. */
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)

  const nameForm = useForm<HouseholdNameValues>({
    resolver: zodResolver(householdNameSchema) as Resolver<HouseholdNameValues>,
    defaultValues: { name: householdName },
  })

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema) as Resolver<InviteValues>,
    defaultValues: { email: "" },
  })

  function onRenameSubmit(values: HouseholdNameValues) {
    startNameTransition(async () => {
      const result = await updateHouseholdName(values)
      if (result.error) {
        toast(result.error, { variant: "error" })
      } else {
        toast("Household name updated", { variant: "success" })
      }
    })
  }

  function onInviteSubmit(values: InviteValues) {
    setInviteMessage(null)
    startInviteTransition(async () => {
      const result = await inviteMember(values)
      if (result.error) {
        toast(result.error, { variant: "error" })
      } else if ("notFound" in result && result.notFound) {
        setInviteMessage(result.message ?? "User not found.")
        inviteForm.reset()
      } else {
        toast(
          `${"addedName" in result && result.addedName ? result.addedName : "Member"} added to the household 🎉`,
          { variant: "success" }
        )
        inviteForm.reset()
      }
    })
  }

  function handleRemove(memberId: string) {
    setRemovingId(memberId)
    startNameTransition(async () => {
      const result = await removeMember({ memberId })
      setRemovingId(null)
      if (result.error) {
        toast(result.error, { variant: "error" })
      } else {
        toast("Member removed from household", { variant: "success" })
      }
    })
  }

  const isOwner = members.find((m) => m.user.id === currentUserId)?.role === "owner"
  const householdFull = members.length >= 2

  // Silence unused variable warning — householdId is available for future use
  void householdId

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="size-4" />
          Household
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* ── Rename ─────────────────────────────────────────────────── */}
        {isOwner ? (
          <Form {...nameForm}>
            <form
              onSubmit={nameForm.handleSubmit(onRenameSubmit)}
              className="flex flex-col gap-3"
            >
              <FormField
                control={nameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Household name</FormLabel>
                    <FormControl>
                      <Input placeholder="Our Home" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isPendingName}
                className="w-full sm:w-auto"
              >
                {isPendingName ? "Saving…" : "Rename household"}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Household name</span>
            <span className="rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              {householdName}
            </span>
          </div>
        )}

        <Separator />

        {/* ── Members list ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Members
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({members.length}/2)
            </span>
          </p>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {members.map((m) => {
              const isCurrentUser = m.user.id === currentUserId
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {m.user.name}
                        {isCurrentUser && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </span>
                      {m.role === "owner" && (
                        <Crown className="size-3.5 shrink-0 text-amber-500" aria-label="owner" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={m.role === "owner" ? "income" : "outline"}>
                      {m.role}
                    </Badge>
                    {/* Owner can remove non-owner members; any member can remove themselves */}
                    {m.role !== "owner" && (isOwner || isCurrentUser) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={removingId === m.id}
                        onClick={() => handleRemove(m.id)}
                        aria-label={`Remove ${m.user.name} from household`}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Invite ─────────────────────────────────────────────────── */}
        {householdFull ? (
          <p className="text-sm text-muted-foreground">
            Your household already has 2 members — no more can be added.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="size-4" />
              Add second member
            </p>
            <p className="text-xs text-muted-foreground">
              Enter their email address. They must already have a HavenFlow account.
            </p>
            <Form {...inviteForm}>
              <form
                onSubmit={inviteForm.handleSubmit(onInviteSubmit)}
                className="flex flex-col gap-2 sm:flex-row sm:items-start"
              >
                <FormField
                  control={inviteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="partner@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPendingInvite} className="sm:w-auto">
                  {isPendingInvite ? "Adding…" : "Add member"}
                </Button>
              </form>
            </Form>
            {inviteMessage && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                {inviteMessage}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
