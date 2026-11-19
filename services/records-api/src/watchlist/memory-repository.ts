import type { WatchlistRepository, WatchlistTicker } from './repository.js';

export class MemoryWatchlistRepository implements WatchlistRepository {
  private readonly tickers = new Map<string, WatchlistTicker>();

  async list(): Promise<WatchlistTicker[]> {
    return [...this.tickers.values()];
  }

  async add(symbol: string): Promise<'added' | 'duplicate'> {
    if (this.tickers.has(symbol)) return 'duplicate';
    this.tickers.set(symbol, { symbol, createdAt: new Date().toISOString() });
    return 'added';
  }
}
