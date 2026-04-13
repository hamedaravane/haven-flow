"use client"

import { useState, useTransition } from "react"
import { ShoppingCart, Check } from "lucide-react"

import { addInventoryItemToShoppingList } from "@/lib/actions/shopping-list"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

interface AddToListButtonProps {
  inventoryItemId: string
}

/**
 * One-tap button to add an inventory item to the shopping list.
 * Shows a brief "Added!" confirmation then resets.
 */
export function AddToListButton({ inventoryItemId }: AddToListButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)

  function handleClick() {
    startTransition(async () => {
      const result = await addInventoryItemToShoppingList(inventoryItemId)
      if (result.error) {
        // "Already on shopping list" is an expected non-critical state — no toast
        if (!result.alreadyExists) {
          toast(result.error, { variant: "error" })
        }
      } else {
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending || added}
      onClick={handleClick}
      aria-label="Add to shopping list"
    >
      {added ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <ShoppingCart className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  )
}
