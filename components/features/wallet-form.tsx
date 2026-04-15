"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { createWallet, updateWallet, type WalletInput } from "@/lib/actions/wallets"
import { WALLET_TYPES, WALLET_TYPE_LABELS, type WalletType } from "@/lib/wallet-constants"
import { CURRENCIES, CURRENCY_LABELS, resolveDefaultCurrency, type Currency } from "@/lib/constants"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Name is too long"),
  type: z.enum([...WALLET_TYPES] as [WalletType, ...WalletType[]]),
  currency: z.enum([...CURRENCIES] as [Currency, ...Currency[]]),
  description: z.string().max(200).optional(),
})

type FormValues = z.output<typeof schema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface WalletFormProps {
  /** When provided, the form is in edit mode. */
  walletId?: string
  initialValues?: Partial<FormValues>
  defaultCurrency?: string
  /** Called when the wallet is successfully saved. */
  onSuccess?: () => void
}

/**
 * Reusable wallet add/edit form.
 * Used both on the /wallets page and in a sheet/dialog for quick edits.
 */
export function WalletForm({ walletId, initialValues, defaultCurrency = "IRR", onSuccess }: WalletFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEditing = !!walletId

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: initialValues?.name ?? "",
      type: initialValues?.type ?? "bank",
      currency: initialValues?.currency ?? resolveDefaultCurrency(defaultCurrency),
      description: initialValues?.description ?? "",
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = isEditing
        ? await updateWallet(walletId, values)
        : await createWallet(values)

      if (result.error) {
        setServerError(result.error)
      } else {
        if (!isEditing) {
          form.reset({
            name: "",
            type: "bank",
            currency: resolveDefaultCurrency(defaultCurrency),
            description: "",
          })
        }
        toast(isEditing ? "Wallet updated" : "Wallet added", { variant: "success" })
        onSuccess?.()
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Mellat Bank - Main" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type + Currency row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {WALLET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {WALLET_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CURRENCY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any notes about this account…" rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && <p className="text-xs text-destructive">{serverError}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Add wallet"}
        </Button>
      </form>
    </Form>
  )
}
