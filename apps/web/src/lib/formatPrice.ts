import type { ProviderOffering } from '../api/types'

export function formatPrice({ amount, unit }: ProviderOffering['price']): string {
  return `£${amount} ${unit}`
}
