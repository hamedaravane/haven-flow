import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { AlertTriangle, Refrigerator, ShoppingBasket, SnowflakeIcon } from "lucide-react"
import type { Metadata } from "next"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { inventory } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import {
  INVENTORY_LOCATION_LABELS,
  getExpiryStatus,
  formatExpiryLabel,
  type InventoryLocation,
} from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InventoryForm } from "@/components/features/inventory-form"
import { DeleteInventoryButton } from "@/components/features/delete-buttons"
import { AddToListButton } from "@/components/features/add-to-list-button"

export const metadata: Metadata = { title: "Inventory" }

const locationIcons: Record<InventoryLocation, typeof Refrigerator> = {
  fridge: Refrigerator,
  pantry: ShoppingBasket,
  freezer: SnowflakeIcon,
}

export default async function InventoryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  const allItems = await db.query.inventory.findMany({
    where: eq(inventory.householdId, household.id),
    orderBy: (inv, { asc }) => [asc(inv.name)],
  })

  // Group by location
  const byLocation = {
    fridge: allItems.filter((i) => i.location === "fridge"),
    pantry: allItems.filter((i) => i.location === "pantry"),
    freezer: allItems.filter((i) => i.location === "freezer"),
  } as Record<InventoryLocation, typeof allItems>

  const expiringCount = allItems.filter((i) => {
    const s = getExpiryStatus(i.expiresAt ?? undefined)
    return s === "warning" || s === "critical" || s === "expired"
  }).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          {allItems.length} item{allItems.length !== 1 ? "s" : ""} tracked
          {expiringCount > 0 && (
            <span className="ml-2 text-amber-600">
              · {expiringCount} expiring/expired soon
            </span>
          )}
        </p>
      </div>

      {/* Add item form */}
      <Card>
        <CardHeader>
          <CardTitle>Add item</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryForm />
        </CardContent>
      </Card>

      {/* Items grouped by location */}
      {(["fridge", "pantry", "freezer"] as InventoryLocation[]).map((loc) => {
        const items = byLocation[loc]
        if (items.length === 0) return null
        const Icon = locationIcons[loc]

        return (
          <Card key={loc}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4" />
                {INVENTORY_LOCATION_LABELS[loc]}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col divide-y divide-border">
                {items.map((item) => {
                  const status = getExpiryStatus(item.expiresAt ?? undefined)
                  const expiryLabel = formatExpiryLabel(item.expiresAt ?? undefined)

                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.quantity}
                            {item.unit ? ` ${item.unit}` : ""}
                          </span>
                          {status === "expired" && (
                            <Badge variant="danger" className="gap-1">
                              <AlertTriangle className="size-3" />
                              Expired
                            </Badge>
                          )}
                          {status === "critical" && (
                            <Badge variant="danger" className="gap-1">
                              <AlertTriangle className="size-3" />
                              Today/Tomorrow
                            </Badge>
                          )}
                          {status === "warning" && (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="size-3" />
                              Expiring soon
                            </Badge>
                          )}
                        </div>
                        {expiryLabel && (
                          <p
                            className={`mt-0.5 text-xs ${
                              status === "expired" || status === "critical"
                                ? "text-destructive"
                                : status === "warning"
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {expiryLabel}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <AddToListButton inventoryItemId={item.id} />
                        <DeleteInventoryButton itemId={item.id} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {allItems.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-3xl" aria-hidden>📦</span>
            <div>
              <p className="font-medium text-foreground">Inventory is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first item above to start tracking expiry dates.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
