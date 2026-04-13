"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { createTransaction } from "@/lib/actions/transactions"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
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
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Please select a category"),
  description: z.string().optional(),
  isHouseholdExpense: z.coerce.boolean(),
  transactionDate: z.string().min(1, "Please pick a date"),
})

// Use z.output to get the post-transformation type for react-hook-form
type FormValues = z.output<typeof schema>

interface TransactionFormProps {
  /** Called when the transaction is successfully saved */
  onSuccess?: () => void
  /** Pre-fill the date; defaults to today */
  defaultDate?: string
}

/**
 * Controlled client form for creating a new transaction.
 * Calls the `createTransaction` server action on submit.
 */
export function TransactionForm({ onSuccess, defaultDate }: TransactionFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const todayISO = defaultDate ?? new Date().toISOString().split("T")[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      amount: undefined,
      type: "expense",
      category: "",
      description: "",
      isHouseholdExpense: true,
      transactionDate: todayISO,
    },
  })

  const transactionType = form.watch("type")
  const categories = transactionType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

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
          category: "",
          description: "",
          isHouseholdExpense: true,
          transactionDate: todayISO,
        })
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
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        field.onChange(t)
                        form.setValue("category", "")
                      }}
                      className={`flex-1 py-1.5 text-sm font-medium capitalize transition-colors ${
                        field.value === t
                          ? t === "expense"
                            ? "bg-rose-500 text-white"
                            : "bg-emerald-500 text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
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

        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Select {...field}>
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-muted-foreground">Household expense (shared)</span>
              </label>
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
