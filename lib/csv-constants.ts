/**
 * CSV Import constants for HavenFlow.
 *
 * Describes the column layout used by major Iranian banks (Mellat, Saman, etc.).
 * The CSV typically has several metadata rows at the top before the actual header row.
 * We detect the header row by looking for known column name patterns.
 */

/**
 * Known column header names in the Iranian bank CSV export format.
 * Both Persian and English variants are listed so we match either.
 */
export const KNOWN_COLUMN_HEADERS = {
  amount: ["amount", "مبلغ"],
  type: ["type", "نوع"],
  date: ["date", "تاریخ"],
  time: ["time", "ساعت", "زمان"],
  description: ["description", "شرح", "توضیحات", "شرح تراکنش"],
  extraInfo: ["extra info", "اطلاعات بیشتر", "info"],
  channel: ["channel", "کانال"],
  traceNo: ["trace no", "شماره پیگیری", "trace"],
  comment: ["comment", "یادداشت"],
  category: ["category", "دسته"],
  branch: ["branch", "شعبه"],
  balance: ["balance", "موجودی"],
  order: ["order", "ردیف", "شماره"],
} as const

/** Canonical column keys used internally after header detection */
export type CsvColumnKey = keyof typeof KNOWN_COLUMN_HEADERS

/** How many rows to skip scanning at the top before giving up on header detection */
export const MAX_HEADER_SCAN_ROWS = 30

/** Number of preview rows to show the user before confirming import */
export const PREVIEW_ROW_COUNT = 15

/** Maximum batch size for DB inserts (avoids overly long queries) */
export const IMPORT_BATCH_SIZE = 500

/**
 * Maps CSV "Type" values to our transaction type enum.
 * DEBIT means money left the account → expense.
 * CREDIT means money entered the account → income.
 */
export const CSV_TYPE_MAP: Record<string, "income" | "expense"> = {
  DEBIT: "expense",
  CREDIT: "income",
  debit: "expense",
  credit: "income",
  برداشت: "expense",
  واریز: "income",
}
