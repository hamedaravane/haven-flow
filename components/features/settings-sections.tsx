"use client"

import { useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LogOut, User, Globe, Palette } from "lucide-react"

import { updateUserName, updateHouseholdCurrency } from "@/lib/actions/settings"
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
