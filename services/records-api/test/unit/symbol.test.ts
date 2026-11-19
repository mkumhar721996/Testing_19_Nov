import { describe, expect, it } from 'vitest';
import { normalizeSymbol, validateSymbol } from '../../src/watchlist/symbol.js';

describe('symbol rules', () => {
  it('accepts class-share symbols', () => {
    expect(validateSymbol('BRK.B')).toBe(true);
    expect(validateSymbol('AAPL')).toBe(true);
  });
  it('rejects empty, too long and malformed symbols', () => {
    expect(validateSymbol('')).toBe(false);
    expect(validateSymbol('TOOLONGX')).toBe(false);
    expect(validateSymbol('12$')).toBe(false);
  });
  it('trims and uppercases', () => {
    expect(normalizeSymbol(' aapl ')).toBe('AAPL');
  });
});
