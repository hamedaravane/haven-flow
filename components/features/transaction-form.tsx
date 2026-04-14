"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { createTransaction } from "@/lib/actions/transactions"
import { cn } from "@/lib/utils"
import { CURRENCIES, CURRENCY_LABELS, type Currency } from "@/lib/constants"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive"),
  type: z.enum(["income", "expense"]),
  /** The category UUID sent to the server (either top-level or subcategory). */
  categoryId: z.string().uuid("Please select a category"),
  currency: z.enum([...CURRENCIES] as [Currency, ...Currency[]]),
  description: z.string().optional(),
  isHouseholdExpense: z.coerce.boolean(),
  transactionDate: z.string().min(1, "Please pick a date"),
})

type FormValues = z.output<typeof schema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subcategory {
  id: string
  name: string
  icon: string | null
}

interface TopLevelCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
  subcategories: Subcategory[]
}

interface TransactionFormProps {
  /** Top-level categories (with their subcategories) from the DB */
  categories: TopLevelCategory[]
  /** Default currency from household settings */
  defaultCurrency?: string
  /** Called when the transaction is successfully saved */
  onSuccess?: () => void
  /** Pre-fill the date; defaults to today */
  defaultDate?: string
}

/**
 * Transaction form with two-level dependent category selects.
 *
 * Category selection logic:
 * 1. User picks a top-level category from the first Select.
 * 2. If that category has subcategories, a second Select appears.
 *    The transaction is saved against the chosen subcategory's ID.
 * 3. If no subcategories exist, the top-level category ID is used directly.
 */
export function TransactionForm({ categories, defaultCurrency = "IRR", onSuccess, defaultDate }: TransactionFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  /** The currently selected top-level category ID (drives the subcategory select). */
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)

  const todayISO = defaultDate ?? new Date().toISOString().split("T")[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      amount: undefined,
      type: "expense",
      categoryId: "",
      currency: (CURRENCIES.includes(defaultCurrency as Currency) ? defaultCurrency : "IRR") as Currency,
      description: "",
      isHouseholdExpense: true,
      transactionDate: todayISO,
    },
  })

  // Find the selected top-level category to know if subcategories exist
  const selectedParent = categories.find((c) => c.id === selectedParentId)
  const hasSubcategories = (selectedParent?.subcategories.length ?? 0) > 0

  function handleParentChange(parentId: string) {
    setSelectedParentId(parentId)
    const parent = categories.find((c) => c.id === parentId)
    // If no subcategories, use the top-level ID directly; otherwise clear until sub is chosen
    if (!parent || parent.subcategories.length === 0) {
      form.setValue("categoryId", parentId, { shouldValidate: true })
    } else {
      form.setValue("categoryId", "", { shouldValidate: false })
    }
  }

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createTransaction({
        ...values,
        description: values.description || undefined,
      })
      if (result.error) {
        setServerError(result.error)
      } else {
        form.reset({
          amount: undefined,
          type: "expense",
          categoryId: "",
          currency: (CURRENCIES.includes(defaultCurrency as Currency) ? defaultCurrency : "IRR") as Currency,
          description: "",
          isHouseholdExpense: true,
          transactionDate: todayISO,
        })
        setSelectedParentId(null)
        toast("Transaction saved", { variant: "success" })
        onSuccess?.()
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Type toggle */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <div className="flex overflow-hidden rounded-2xl border border-input">
                  {(["expense", "income"] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        field.onChange(t)
                        form.setValue("categoryId", "")
                        setSelectedParentId(null)
                      }}
                      className={cn(
                        "flex-1 rounded-none capitalize transition-colors first:rounded-l-2xl last:rounded-r-2xl",
                        field.value === t && t === "expense" && "bg-rose-500 text-white hover:bg-rose-500/90",
                        field.value === t && t === "income" && "bg-emerald-500 text-white hover:bg-emerald-500/90"
                      )}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount + Date row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="transactionDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Currency selector */}
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

        {/* ── Two-level category selects ──────────────────────────────────── */}

        {/* Step 1: Top-level category */}
        <FormItem>
          <FormLabel>Category</FormLabel>
          <Select
            onValueChange={handleParentChange}
            value={selectedParentId ?? ""}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category…" />
            </SelectTrigger>
            <SelectContent>
              {categories.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No categories yet — add some in Settings → Categories.
                </div>
              ) : (
                <SelectGroup>
                  <SelectLabel>Categories</SelectLabel>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                      {c.subcategories.length > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({c.subcategories.length})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </FormItem>

        {/* Step 2: Subcategory (only shown when the chosen parent has subcategories) */}
        {hasSubcategories && selectedParent && (
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Subcategory{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    under {selectedParent.icon ?? ""} {selectedParent.name}
                  </span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcategory…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* Allow using the parent directly if user doesn't need more specificity */}
                    <SelectItem value={selectedParent.id}>
                      — {selectedParent.name} (general)
                    </SelectItem>
                    {selectedParent.subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.icon ? `${sub.icon} ` : ""}
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Hidden field validation message for categoryId when no subcategory select shown */}
        {!hasSubcategories && (
          <FormField
            control={form.control}
            name="categoryId"
            render={() => (
              <FormItem className="hidden">
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="What was this for?" rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Household expense toggle */}
        <FormField
          control={form.control}
          name="isHouseholdExpense"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal text-muted-foreground">
                  Household expense (shared)
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        {serverError && <p className="text-xs text-destructive">{serverError}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : "Add transaction"}
        </Button>
      </form>
    </Form>
  )
}
