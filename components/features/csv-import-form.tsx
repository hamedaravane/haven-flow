"use client"

import { useState, useTransition, useRef, useCallback } from "react"
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react"
import Link from "next/link"

import { parseCsvContent, type ParsedTransaction } from "@/lib/csv-parser"
import { importTransactions, type ImportResult } from "@/lib/actions/csv-import"
import { WALLET_TYPE_LABELS, type WalletType } from "@/lib/wallet-constants"
import { PREVIEW_ROW_COUNT } from "@/lib/csv-constants"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Wallet {
  id: string
  name: string
  type: string
  currency: string
}

interface CsvImportFormProps {
  wallets: Wallet[]
}

// ─── Import state machine ────────────────────────────────────────────────────

type ImportStep = "upload" | "preview" | "success"

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Full CSV import flow:
 *  1. Upload step  — drag & drop or file picker
 *  2. Preview step — show parsed rows, select wallet, toggle skip-duplicates
 *  3. Success step — show import summary with link to transactions
 */
export function CsvImportForm({ wallets }: CsvImportFormProps) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const [parsed, setParsed] = useState<ParsedTransaction[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [skippedByParser, setSkippedByParser] = useState(0)
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id ?? "")
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File processing ───────────────────────────────────────────────────────

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast("Please upload a .csv file", { variant: "error" })
      return
    }
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parseResult = parseCsvContent(text)
      setParsed(parseResult.transactions)
      setParseErrors(parseResult.errors)
      setSkippedByParser(parseResult.skippedCount)

      if (parseResult.transactions.length === 0) {
        toast(parseResult.errors[0] ?? "No valid transactions found in this file.", { variant: "error" })
        return
      }

      setStep("preview")
    }
    reader.readAsText(file, "UTF-8")
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragOver(false), [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ""
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleImport() {
    if (!selectedWalletId) {
      toast("Please select a wallet first", { variant: "error" })
      return
    }
    startTransition(async () => {
      const res = await importTransactions({
        walletId: selectedWalletId,
        skipDuplicates,
        rows: parsed.map((p) => ({
          amount: p.amount,
          type: p.type,
          transactionDate: p.transactionDate,
          description: p.description,
        })),
      })
      setResult(res)
      if (res.error) {
        toast(res.error, { variant: "error" })
      } else {
        setStep("success")
        toast(`${res.inserted} transactions imported`, { variant: "success" })
      }
    })
  }

  function handleReset() {
    setStep("upload")
    setFileName("")
    setParsed([])
    setParseErrors([])
    setSkippedByParser(0)
    setResult(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === "success" && result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-12 text-emerald-500" />
          <div>
            <p className="text-lg font-semibold">Import complete!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{result.inserted}</span> transactions added
              {result.skipped > 0 && (
                <>, <span className="font-medium">{result.skipped}</span> duplicates skipped</>
              )}
              .
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/transactions">View transactions</Link>
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === "preview") {
    const wallet = wallets.find((w) => w.id === selectedWalletId)
    const previewRows = parsed.slice(0, PREVIEW_ROW_COUNT)

    return (
      <div className="flex flex-col gap-4">
        {/* File info */}
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <FileText className="size-5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {parsed.length.toLocaleString()} valid rows parsed
                {skippedByParser > 0 && `, ${skippedByParser} skipped (invalid)`}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleReset} aria-label="Remove file">
              <X className="size-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">Some rows could not be parsed:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Configuration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Import settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Wallet selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Target account</label>
              {wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No wallets found.{" "}
                  <Link href="/wallets" className="text-primary underline underline-offset-2">
                    Add a wallet first
                  </Link>
                  .
                </p>
              ) : (
                <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet…" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {WALLET_TYPE_LABELS[w.type as WalletType].split(" ")[0]} {w.name}
                        <span className="ml-1.5 text-xs text-muted-foreground">{w.currency}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {wallet && (
                <p className="text-xs text-muted-foreground">
                  All imported transactions will be linked to <strong>{wallet.name}</strong> ({wallet.currency}).
                </p>
              )}
            </div>

            {/* Skip duplicates toggle */}
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="skip-dupes"
                checked={skipDuplicates}
                onCheckedChange={(v) => setSkipDuplicates(!!v)}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="skip-dupes" className="cursor-pointer text-sm font-medium">
                  Skip duplicate transactions
                </label>
                <p className="text-xs text-muted-foreground">
                  Skips rows where the same date + amount already exists for the selected account.
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <strong>Warning:</strong> This will add {parsed.length.toLocaleString()} transactions to{" "}
              <strong>{wallet?.name ?? "the selected account"}</strong>. This action cannot be undone in bulk.
            </div>
          </CardContent>
        </Card>

        {/* Preview table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Preview{" "}
              <span className="font-normal text-muted-foreground">
                (first {Math.min(PREVIEW_ROW_COUNT, parsed.length)} of {parsed.length.toLocaleString()} rows)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.rawDate}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.type === "income" ? "income" : "expense"}>
                          {row.rawType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-sm">
                        {row.rawAmount}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {row.description || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            className="flex-1"
            disabled={isPending || !selectedWalletId || wallets.length === 0}
            onClick={handleImport}
          >
            {isPending
              ? `Importing ${parsed.length.toLocaleString()} rows…`
              : `Import ${parsed.length.toLocaleString()} transactions`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Upload step ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={handleFileInput}
        aria-label="Upload CSV file"
      />

      {/* Drag and drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop CSV file here or click to browse"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <Upload className={cn("size-8", isDragOver ? "text-primary" : "text-muted-foreground")} />
        <div>
          <p className="font-medium">Drop your bank CSV here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse — supports Mellat, Saman, and other Iranian bank exports
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <span>Browse file</span>
        </Button>
      </div>

      {/* Format info */}
      <Card>
        <CardContent className="py-4">
          <p className="mb-2 text-sm font-medium">Supported CSV format</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The file should contain columns: <strong>Date</strong>, <strong>Amount</strong>, <strong>Type</strong> (DEBIT/CREDIT), and optionally Description, Channel, Extra Info.
            Metadata rows at the top are automatically skipped. Amounts with comma thousand separators (e.g. 3,580,000) are handled automatically.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Dates can be in Jalali (Persian) format <code className="rounded bg-muted px-1">YYYY/MM/DD</code> or Gregorian <code className="rounded bg-muted px-1">YYYY-MM-DD</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
