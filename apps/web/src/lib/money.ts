/** Formats integer minor units (cents) as currency, e.g. 12000 USD -> "$120.00". */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100)
}
