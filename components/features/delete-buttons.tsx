"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"

import { deleteTransaction } from "@/lib/actions/transactions"
import { deleteBudget } from "@/lib/actions/budgets"
import { Button } from "@/components/ui/button"

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
      onClick={() => startTransition(async () => { await deleteTransaction(transactionId) })}
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
      onClick={() => startTransition(async () => { await deleteBudget(budgetId) })}
      aria-label="Delete budget"
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  )
}
