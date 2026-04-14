"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { createCategory, updateCategory } from "@/lib/actions/categories"
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

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  parentId: z.string().uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #f59e0b")
    .nullable()
    .optional()
    .or(z.literal("")),
  icon: z.string().max(10, "Icon too long").nullable().optional(),
})

type FormValues = z.output<typeof schema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopLevelCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
}

interface CategoryFormProps {
  /** All top-level categories for the parent dropdown */
  topLevelCategories: TopLevelCategory[]
  /** When provided, the form edits this category instead of creating a new one */
  editId?: string
  defaultValues?: Partial<FormValues>
  onSuccess?: () => void
}

// ─── Common emoji suggestions for the icon field ─────────────────────────────
const ICON_SUGGESTIONS = [
  "🛒", "🍽️", "🚗", "🏠", "💡", "❤️", "🎬", "🛍️",
  "🧴", "📚", "🎁", "🐷", "💰", "📦", "☕", "✈️",
  "🏋️", "🎮", "🐶", "🌿", "💊", "📈", "🎓", "🔧",
]

/** Fallback hex color for the native color picker when no color has been chosen. */
const DEFAULT_CATEGORY_COLOR = "#6b7280"

/**
 * Form for creating or editing a household category.
 * Enforces the two-level hierarchy: only top-level categories appear in the
 * parent dropdown, and the current category cannot be its own parent.
 */
export function CategoryForm({
  topLevelCategories,
  editId,
  defaultValues,
  onSuccess,
}: CategoryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      parentId: null,
      color: "",
      icon: "",
      ...defaultValues,
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const input = {
        name: values.name,
        parentId: values.parentId ?? null,
        color: values.color || null,
        icon: values.icon || null,
      }

      const result = editId
        ? await updateCategory(editId, input)
        : await createCategory(input)

      if (result.error) {
        setServerError(result.error)
      } else {
        toast(editId ? "Category updated" : "Category created", { variant: "success" })
        form.reset({ name: "", parentId: null, color: "", icon: "" })
        onSuccess?.()
      }
    })
  }

  // Filter out the category being edited from the parent list (can't self-parent)
  const parentOptions = topLevelCategories.filter((c) => c.id !== editId)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Dining Out" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Parent category (makes this a subcategory) */}
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Parent category{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                value={field.value ?? "__none__"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Top-level category (no parent)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {/* Explicit "none" option */}
                  <SelectItem value="__none__">— Top-level (no parent)</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave empty to create a top-level category; choose a parent to create a
                subcategory (max depth 2).
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Color + Icon row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Color{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <div className="flex items-center gap-2">
                  {/* Native color picker */}
                  <input
                    type="color"
                    value={field.value || DEFAULT_CATEGORY_COLOR}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                    aria-label="Pick a color"
                  />
                  <FormControl>
                    <Input
                      placeholder="#6b7280"
                      {...field}
                      value={field.value ?? ""}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Icon{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="🍽️"
                    {...field}
                    value={field.value ?? ""}
                    className="text-lg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Quick emoji picker */}
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Quick icons:</p>
          <div className="flex flex-wrap gap-1.5">
            {ICON_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => form.setValue("icon", emoji)}
                className="rounded-lg border border-input px-2 py-1 text-lg leading-none transition-colors hover:bg-muted"
                aria-label={`Use ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {serverError && <p className="text-xs text-destructive">{serverError}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : editId ? "Update category" : "Create category"}
        </Button>
      </form>
    </Form>
  )
}
