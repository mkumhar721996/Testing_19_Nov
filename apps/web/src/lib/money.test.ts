import { formatMoney } from './money'

describe('formatMoney', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(12000, 'USD')).toBe('$120.00')
    expect(formatMoney(4000, 'USD')).toBe('$40.00')
    expect(formatMoney(2499, 'USD')).toBe('$24.99')
  })
})
