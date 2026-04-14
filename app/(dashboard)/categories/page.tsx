import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { Tags } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CategoryForm } from "@/components/features/category-form"
import { DeleteCategoryButton } from "@/components/features/delete-buttons"

export const metadata: Metadata = { title: "Categories" }

export default async function CategoriesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const household = await getOrCreateHousehold(session.user.id)

  // Load all categories for this household, structured as top-level + subs
  const topLevelCategories = await db.query.categories.findMany({
    where: (c, { and, isNull }) =>
      and(eq(c.householdId, household.id), isNull(c.parentId)),
    with: {
      subcategories: {
        orderBy: (c, { asc }) => [asc(c.name)],
      },
    },
    orderBy: (c, { asc }) => [asc(c.name)],
  })

  // Flat list of top-level categories (for the parent dropdown in the form)
  const topLevelForForm = topLevelCategories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
  }))

  // Count total subcategories for the summary
  const totalSubcategories = topLevelCategories.reduce(
    (sum, c) => sum + c.subcategories.length,
    0
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Categories</h1>
        <p className="text-sm text-muted-foreground">
          {topLevelCategories.length} top-level · {totalSubcategories} subcategories
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Category tree ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {topLevelCategories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="text-3xl" aria-hidden>
                  🏷️
                </span>
                <div>
                  <p className="font-medium text-foreground">No categories yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first category using the form →
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            topLevelCategories.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="p-4">
                  {/* Top-level category row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Color swatch */}
                      <div
                        className="size-8 shrink-0 rounded-xl flex items-center justify-center text-base"
                        style={
                          cat.color
                            ? { backgroundColor: cat.color + "22", border: `2px solid ${cat.color}` }
                            : { backgroundColor: "#f3f4f6", border: "2px solid #e5e7eb" }
                        }
                        aria-hidden
                      >
                        {cat.icon ?? <Tags className="size-4 text-muted-foreground" />}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{cat.name}</p>
                        {cat.subcategories.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {cat.subcategories.length} subcategor
                            {cat.subcategories.length === 1 ? "y" : "ies"}
                          </p>
                        )}
                      </div>
                    </div>

                    <DeleteCategoryButton
                      categoryId={cat.id}
                      categoryName={cat.name}
                    />
                  </div>

                  {/* Subcategories (indented) */}
                  {cat.subcategories.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1 border-l-2 border-border pl-4 ml-4">
                      {cat.subcategories.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm" aria-hidden>
                              {sub.icon ?? "·"}
                            </span>
                            <span className="text-sm truncate">{sub.name}</span>
                          </div>
                          <DeleteCategoryButton
                            categoryId={sub.id}
                            categoryName={sub.name}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── Add category form ────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="size-4" />
                Add category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryForm topLevelCategories={topLevelForForm} />
            </CardContent>
          </Card>

          {/* Help text */}
          <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground text-sm">How categories work</p>
            <p>
              <strong>Top-level</strong> categories (e.g. Dining Out) are the broad buckets
              you&apos;ll use for budgets and overview charts.
            </p>
            <p>
              <strong>Subcategories</strong> (e.g. Office Lunch, Restaurant) give you precise
              tracking within a top-level. Max depth is 2 levels.
            </p>
            <p>
              When adding a transaction, you pick the subcategory — spending rolls up to the
              parent automatically in reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
