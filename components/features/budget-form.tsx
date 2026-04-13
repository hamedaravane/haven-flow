"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { upsertBudget } from "@/lib/actions/budgets"
import { EXPENSE_CATEGORIES, currentMonth } from "@/lib/constants"
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

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format"),
  category: z.string().min(1, "Please select a category"),
  plannedAmount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive"),
})

type FormValues = z.output<typeof schema>

interface BudgetFormProps {
  onSuccess?: () => void
  /** Pre-fill with an existing budget for editing */
  defaultValues?: Partial<FormValues>
}

/**
 * Form for creating or updating a monthly budget.
 * Uses upsertBudget server action (creates or replaces by month+category).
 */
export function BudgetForm({ onSuccess, defaultValues }: BudgetFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      month: currentMonth(),
      category: "",
      plannedAmount: undefined,
      ...defaultValues,
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await upsertBudget(values)
      if (result.error) {
        setServerError(result.error)
      } else {
        form.reset({ month: currentMonth(), category: "", plannedAmount: undefined })
        onSuccess?.()
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Month + Amount row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Month</FormLabel>
                <FormControl>
                  <Input type="month" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plannedAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget ($)</FormLabel>
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
                  {EXPENSE_CATEGORIES.map((c) => (
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

        {serverError && <p className="text-xs text-destructive">{serverError}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : "Set budget"}
        </Button>
      </form>
    </Form>
  )
}
