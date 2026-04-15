"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"

import { type WalletType, WALLET_TYPES } from "@/lib/wallet-constants"
import { CURRENCIES, type Currency } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { WalletForm } from "@/components/features/wallet-form"

interface EditWalletSheetProps {
  walletId: string
  initialValues: {
    name: string
    type: WalletType
    currency: Currency
    description?: string
  }
  defaultCurrency?: string
}

/**
 * A Sheet (slide-in panel) that wraps WalletForm in edit mode.
 * Used on the /wallets page for inline editing without a page navigation.
 */
export function EditWalletSheet({ walletId, initialValues, defaultCurrency }: EditWalletSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Edit wallet">
          <Pencil className="size-3.5 text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Edit wallet</SheetTitle>
        </SheetHeader>
        <WalletForm
          walletId={walletId}
          initialValues={initialValues}
          defaultCurrency={defaultCurrency}
          onSuccess={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
