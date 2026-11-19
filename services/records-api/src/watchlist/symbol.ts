const SYMBOL_PATTERN = /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/;

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateSymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol);
}
