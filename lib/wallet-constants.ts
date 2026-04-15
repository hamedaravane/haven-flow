/**
 * Wallet/account type constants shared across client and server components.
 * Kept separate from the "use server" actions file so they can be imported anywhere.
 */

export const WALLET_TYPES = ["bank", "card", "crypto", "cash", "other"] as const
export type WalletType = (typeof WALLET_TYPES)[number]

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  bank: "🏦 Bank Account",
  card: "💳 Debit / Credit Card",
  crypto: "🪙 Crypto Wallet",
  cash: "💵 Cash",
  other: "📁 Other",
}
