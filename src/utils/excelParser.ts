export interface ParsedPositionItem {
  id: string;
  name: string;
  rawTicker?: string;
  ticker: string;
  category?: string;
  volume: number;
  value?: number;
  openPrice?: number;
  currentPrice?: number;
  isTickerIdentified?: boolean;
  possibleMatches?: Array<{
    symbol: string;
    shortname: string;
    exchange?: string;
  }>;
}
