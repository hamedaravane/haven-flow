"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { upsertBudget } from "@/lib/actions/budgets"
import { getCurrentMonthInput, parseMonthInput, type CalendarSystem } from "@/lib/date-utils"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format"),
  /** Top-level category UUID (budgets track at the top-level for easy rollups). */
  categoryId: z.string().uuid("Please select a category"),
  plannedAmount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive"),
})

type FormValues = z.output<typeof schema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopLevelCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
}

interface BudgetFormProps {
  /** Top-level categories from the DB */
  topLevelCategories: TopLevelCategory[]
  /** Calendar system preference for the household */
  calendarSystem?: CalendarSystem
  onSuccess?: () => void
  /** Pre-fill with an existing budget for editing */
  defaultValues?: Partial<FormValues>
}

/**
 * Form for creating or updating a monthly budget.
 * Budgets are linked to top-level categories for convenient rollup views.
 * Uses upsertBudget server action (creates or replaces by month+categoryId).
 */
export function BudgetForm({ topLevelCategories, calendarSystem = "gregorian", onSuccess, defaultValues }: BudgetFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isJalali = calendarSystem === "jalali"
  // Use the calendar-aware default month for the input field
  const defaultMonth = getCurrentMonthInput(calendarSystem)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      month: defaultMonth,
      categoryId: "",
      plannedAmount: undefined,
      ...defaultValues,
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      // Convert the month input to Gregorian YYYY-MM for storage
      const gregorianMonth = parseMonthInput(values.month, calendarSystem) ?? values.month
      const result = await upsertBudget({ ...values, month: gregorianMonth })
      if (result.error) {
        setServerError(result.error)
      } else {
        form.reset({ month: defaultMonth, categoryId: "", plannedAmount: undefined })
        toast("Budget saved", { variant: "success" })
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
                  {isJalali ? (
                    <Input
                      type="text"
                      placeholder="۱۴۰۵-۰۲"
                      dir="ltr"
                      {...field}
                    />
                  ) : (
                    <Input type="month" {...field} />
                  )}
                </FormControl>
                {isJalali && (
                  <p className="text-xs text-muted-foreground">Format: YYYY-MM (Jalali)</p>
                )}
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

        {/* Category — top-level only for budgets */}
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {topLevelCategories.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No categories yet. Add some in Categories settings.
                    </div>
                  ) : (
                    <SelectGroup>
                      <SelectLabel>Top-level categories</SelectLabel>
                      {topLevelCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.icon ? `${c.icon} ` : ""}
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Budgets track at the top-level; subcategory spending rolls up automatically.
              </p>
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

