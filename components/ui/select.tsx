import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Native-styled select that matches the Input component visually.
 * Works perfectly with react-hook-form's Controller / register.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "flex h-9 w-full min-w-0 appearance-none rounded-2xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { Select }
