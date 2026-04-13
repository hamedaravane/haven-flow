"use client"

import { useTransition } from "react"

import { toggleShoppingItem } from "@/lib/actions/shopping-list"
import { Checkbox } from "@/components/ui/checkbox"
import { DeleteShoppingItemButton } from "@/components/features/delete-buttons"

interface ShoppingItemRowProps {
  item: {
    id: string
    name: string
    quantity: string
    unit: string | null
    isChecked: boolean
  }
}

/**
 * A single shopping list row with a checkbox to mark as purchased.
 * The checkbox immediately calls `toggleShoppingItem` as a server action.
 */
export function ShoppingItemRow({ item }: ShoppingItemRowProps) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleShoppingItem(item.id)
    })
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <Checkbox
        checked={item.isChecked}
        onCheckedChange={handleToggle}
        aria-label={`Mark "${item.name}" as ${item.isChecked ? "pending" : "purchased"}`}
        className="rounded-full data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
      />

      {/* Item details */}
      <div className="min-w-0 flex-1">
        <span
          className={`text-sm font-medium transition-colors ${
            item.isChecked ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {item.name}
        </span>
        {(parseFloat(item.quantity) !== 1 || item.unit) && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            {item.quantity}
            {item.unit ? ` ${item.unit}` : ""}
          </span>
        )}
      </div>

      <DeleteShoppingItemButton itemId={item.id} />
    </div>
  )
}
