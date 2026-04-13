import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<"div"> {
  /** 0–100 */
  value: number
}

/**
 * Simple horizontal progress bar.
 * Color changes based on value: green → amber (70%) → red (90%).
 */
function Progress({ value, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))

  const fillClass =
    clamped >= 90
      ? "bg-destructive"
      : clamped >= 70
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300", fillClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress }
