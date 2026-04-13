"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { createInventoryItem, updateInventoryItem } from "@/lib/actions/inventory"
import { INVENTORY_LOCATIONS, INVENTORY_LOCATION_LABELS, INVENTORY_UNITS } from "@/lib/constants"
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
  name: z.string().min(1, "Name is required").max(100),
  quantity: z.coerce.number({ error: "Quantity must be a number" }).positive("Must be positive"),
  unit: z.string().optional(),
  expiresAt: z.string().optional(),
  location: z.enum(["fridge", "pantry", "freezer"]),
})

type FormValues = z.output<typeof schema>

interface InventoryFormProps {
  /** If provided, the form will update the existing item instead of creating */
  itemId?: string
  defaultValues?: Partial<FormValues>
  onSuccess?: () => void
}

/**
 * Client form for adding or editing an inventory item.
 */
export function InventoryForm({ itemId, defaultValues, onSuccess }: InventoryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      quantity: undefined,
      unit: "",
      expiresAt: "",
      location: "pantry",
      ...defaultValues,
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const input = {
        name: values.name,
        quantity: values.quantity,
        unit: values.unit || null,
        expiresAt: values.expiresAt || null,
        location: values.location,
      }

      const result = itemId
        ? await updateInventoryItem(itemId, input)
        : await createInventoryItem(input)

      if (result.error) {
        setServerError(result.error)
      } else {
        form.reset({ name: "", quantity: undefined, unit: "", expiresAt: "", location: "pantry" })
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
              <FormLabel>Item name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Milk" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity + Unit row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1"
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
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl>
                  <Select {...field}>
                    <option value="">None</option>
                    {INVENTORY_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Location + Expiry row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Select {...field}>
                    {INVENTORY_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {INVENTORY_LOCATION_LABELS[loc]}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expires (optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {serverError && <p className="text-xs text-destructive">{serverError}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving…" : itemId ? "Save changes" : "Add to inventory"}
        </Button>
      </form>
    </Form>
  )
}
