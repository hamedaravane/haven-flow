"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"

import { deleteTransaction } from "@/lib/actions/transactions"
import { deleteBudget } from "@/lib/actions/budgets"
import { deleteInventoryItem } from "@/lib/actions/inventory"
import { deleteShoppingItem, clearCheckedItems } from "@/lib/actions/shopping-list"
import { deleteCategory } from "@/lib/actions/categories"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

interface DeleteTransactionButtonProps {
  transactionId: string
}

export function DeleteTransactionButton({ transactionId }: DeleteTransactionButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteTransaction(transactionId)
          if (result.error) toast(result.error, { variant: "error" })
        })
      }
      aria-label="Delete transaction"
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}

interface DeleteBudgetButtonProps {
  budgetId: string
}

export function DeleteBudgetButton({ budgetId }: DeleteBudgetButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteBudget(budgetId)
          if (result.error) toast(result.error, { variant: "error" })
        })
      }
      aria-label="Delete budget"
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}

interface DeleteInventoryButtonProps {
  itemId: string
}

export function DeleteInventoryButton({ itemId }: DeleteInventoryButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteInventoryItem(itemId)
          if (result.error) toast(result.error, { variant: "error" })
        })
      }
      aria-label="Delete inventory item"
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}

interface DeleteShoppingItemButtonProps {
  itemId: string
}

export function DeleteShoppingItemButton({ itemId }: DeleteShoppingItemButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteShoppingItem(itemId)
          if (result.error) toast(result.error, { variant: "error" })
        })
      }
      aria-label="Remove from shopping list"
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}

/** Button to wipe all checked items from the shopping list */
export function ClearCheckedButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await clearCheckedItems()
          if (result.error) {
            toast(result.error, { variant: "error" })
          } else {
            toast("Checked items cleared", { variant: "success" })
          }
        })
      }
    >
      {isPending ? "Clearing…" : "Clear checked"}
    </Button>
  )
}

interface DeleteCategoryButtonProps {
  categoryId: string
  categoryName: string
}

export function DeleteCategoryButton({ categoryId, categoryName }: DeleteCategoryButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${categoryName}"? This cannot be undone.`)) return
        startTransition(async () => {
          const result = await deleteCategory(categoryId)
          if (result.error) {
            toast(result.error, { variant: "error" })
          } else {
            toast(`"${categoryName}" deleted`, { variant: "success" })
          }
        })
      }}
      aria-label={`Delete category ${categoryName}`}
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}

