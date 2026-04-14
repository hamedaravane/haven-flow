"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, CURRENCY_SYMBOLS, type Currency } from "@/lib/constants"

// ── Colour palette for pie chart slices ──────────────────────────────────────
const CHART_COLORS = [
  "oklch(0.828 0.111 230.318)",
  "oklch(0.685 0.169 237.323)",
  "oklch(0.588 0.158 241.966)",
  "oklch(0.5 0.134 242.749)",
  "oklch(0.443 0.11 240.79)",
  "oklch(0.742 0.157 260)",
  "oklch(0.65 0.2 300)",
  "oklch(0.7 0.18 170)",
]

interface MonthlyPoint {
  month: string
  income: number
  expenses: number
}

interface CategoryPoint {
  category: string
  amount: number
}

interface ReportsChartsProps {
  monthlyData: MonthlyPoint[]
  categoryData: CategoryPoint[]
  defaultCurrency?: string
}

/** Format YYYY-MM as a short month label e.g. "Jan" */
function shortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" })
}

/** Custom tooltip for the bar chart */
function BarTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; fill: string }>
  label?: string
  currency?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-sm shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {formatCurrency(p.value, currency)}
        </p>
      ))}
    </div>
  )
}

/** Custom tooltip for the pie chart */
function PieTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  currency?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-sm shadow-lg">
      <p className="font-medium">{payload[0].name}</p>
      <p>{formatCurrency(payload[0].value, currency)}</p>
    </div>
  )
}

export function ReportsCharts({ monthlyData, categoryData, defaultCurrency = "IRR" }: ReportsChartsProps) {
  const chartData = monthlyData.map((d) => ({
    ...d,
    month: shortMonth(d.month),
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Income vs Expenses bar chart ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income vs Expenses (6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "currentColor" }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(v: number) => {
                  const sym = CURRENCY_SYMBOLS[defaultCurrency as Currency] ?? defaultCurrency
                  return v >= 1000 ? `${sym}${Math.round(v / 1000)}k` : `${sym}${v}`
                }}
                tick={{ fontSize: 12, fill: "currentColor" }}
                className="text-muted-foreground"
                width={56}
              />
              <Tooltip content={<BarTooltip currency={defaultCurrency} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="oklch(0.685 0.169 237.323)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="oklch(0.704 0.191 22.216)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Category breakdown pie chart ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending by Category (This Month)</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="flex h-70 items-center justify-center text-sm text-muted-foreground">
              No expense data for this month yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {categoryData.map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip currency={defaultCurrency} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
