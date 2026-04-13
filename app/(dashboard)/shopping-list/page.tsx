import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { Lightbulb, ShoppingCart } from "lucide-react"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { inventory, shoppingListItems } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { getExpiryStatus } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingItemForm } from "@/components/features/shopping-item-form"
import { ShoppingItemRow } from "@/components/features/shopping-item-row"
import { AddToListButton } from "@/components/features/add-to-list-button"
import { ClearCheckedButton } from "@/components/features/delete-buttons"

export const metadata: Metadata = { title: "Shopping List" }

export default async function ShoppingListPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  // ── Current shopping list ────────────────────────────────────────────────────
  const listItems = await db.query.shoppingListItems.findMany({
    where: eq(shoppingListItems.householdId, household.id),
    orderBy: (s, { asc, desc }) => [asc(s.isChecked), desc(s.createdAt)],
  })

  const checkedCount = listItems.filter((i) => i.isChecked).length

  // ── Smart suggestions ────────────────────────────────────────────────────────
  // Suggest inventory items that are:
  //   (a) expiring within 3 days (need to use or re-buy soon)
  //   (b) quantity <= 1 (running low)
  // Exclude items whose name is already on the shopping list
  const shoppingListNames = new Set(listItems.map((i) => i.name.toLowerCase()))

  const allInventory = await db.query.inventory.findMany({
    where: eq(inventory.householdId, household.id),
  })

  const suggestions = allInventory.filter((item) => {
    // Skip already on list
    if (shoppingListNames.has(item.name.toLowerCase())) return false

    const status = getExpiryStatus(item.expiresAt ?? undefined)
    const isExpiring = status === "warning" || status === "critical" || status === "expired"
    const isLowStock = parseFloat(item.quantity) <= 1

    return isExpiring || isLowStock
  })

  // Sort: expired first, then critical, then warning, then low stock
  const statusOrder = { expired: 0, critical: 1, warning: 2, ok: 3 }
  suggestions.sort((a, b) => {
    const sa = statusOrder[getExpiryStatus(a.expiresAt ?? undefined)]
    const sb = statusOrder[getExpiryStatus(b.expiresAt ?? undefined)]
    return sa - sb
  })

  const pendingItems = listItems.filter((i) => !i.isChecked)
  const checkedItems = listItems.filter((i) => i.isChecked)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Shopping list</h1>
        <p className="text-sm text-muted-foreground">
          {pendingItems.length} item{pendingItems.length !== 1 ? "s" : ""} to get
          {checkedCount > 0 && ` · ${checkedCount} checked`}
        </p>
      </div>

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y divide-border">
              {suggestions.map((item) => {
                const status = getExpiryStatus(item.expiresAt ?? undefined)
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {(status === "expired" || status === "critical") && (
                          <Badge variant="danger">Expired/expiring</Badge>
                        )}
                        {status === "warning" && <Badge variant="warning">Expiring soon</Badge>}
                        {parseFloat(item.quantity) <= 1 && (
                          <Badge variant="outline">Low stock ({item.quantity})</Badge>
                        )}
                      </div>
                    </div>
                    <AddToListButton inventoryItemId={item.id} />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add item form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Add item
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ShoppingItemForm />
        </CardContent>
      </Card>

      {/* Shopping list */}
      {listItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your list</CardTitle>
            {checkedCount > 0 && (
              <CardAction>
                <ClearCheckedButton />
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y divide-border">
              {/* Pending items first */}
              {pendingItems.map((item) => (
                <ShoppingItemRow key={item.id} item={item} />
              ))}
              {/* Checked items below */}
              {checkedItems.length > 0 && (
                <>
                  {pendingItems.length > 0 && (
                    <div className="px-4 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        In basket
                      </p>
                    </div>
                  )}
                  {checkedItems.map((item) => (
                    <ShoppingItemRow key={item.id} item={item} />
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Your shopping list is empty.
        </p>
      )}
    </div>
  )
}
