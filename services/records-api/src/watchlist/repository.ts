export interface WatchlistTicker {
  symbol: string;
  createdAt: string;
}

export interface WatchlistRepository {
  /** Oldest first. */
  list(): Promise<WatchlistTicker[]>;
  /** Atomic; unique on symbol. */
  add(symbol: string): Promise<'added' | 'duplicate'>;
}
