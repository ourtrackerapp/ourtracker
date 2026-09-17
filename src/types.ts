export interface PurchaseRecord {
  id?: string;
  date: number; // timestamp in ms
  shares: number;
  price?: number;
  priceEur?: number;
  currency?: string; // native currency at transaction (e.g. "USD", "EUR", "GBP")
  totalCostEur?: number; // total amount actually debited in EUR (if available)
  feeEur?: number; // broker fee or commission in EUR
}

export interface HoldingDoc {
  id: string;
  ticker: string;
  shares: number;
  createdAt: number;
  color?: string;
  purchases?: PurchaseRecord[];
}

export interface PortfolioPosition {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  currentPrice?: number; // in EUR (undefined if quote error)
  nativePrice?: number; // in native currency (e.g. USD)
  nativeCurrency?: string; // e.g. "USD", "EUR"
  fxRateToEur?: number;
  value?: number; // total position value in EUR (undefined if quote error)
  totalInvested: number; // total cost of currently held shares in EUR
  averagePrice: number; // weighted average cost per share in EUR
  profitEur?: number; // value - totalInvested in EUR (undefined if quote error)
  allocationPercent: number;
  changePercent?: number;
  changeEur?: number;
  weekReturnPercent?: number;
  weekReturnEur?: number;
  monthReturnPercent?: number;
  monthReturnEur?: number;
  threeMonthReturnPercent?: number;
  threeMonthReturnEur?: number;
  targetPrice?: number;
  totalReturnPercent?: number; // strictly derived in runtime: (profitEur / totalInvested) * 100
  firstPurchaseReturnPercent?: number; // return since the first purchase price
  firstPurchaseDate?: string; // ISO or date string of oldest valid purchase
  firstPurchaseTimestamp?: number; // timestamp in ms of oldest valid purchase
  color: string;
  isError?: boolean;
  quoteStatus?: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE';
  errorMessage?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalProfitEur: number;
  totalReturnPercent?: number;
  currencySymbol: string;
  positionsCount: number;
  unavailablePositionsCount: number;
  positions: PortfolioPosition[];
}

export interface PdfPortfolioPosition {
  id: string;
  name: string;
  ticker: string;
  category: string;
  volume: number;
  value: number;
  profit: number;
  openPrice?: number;
  currentPrice?: number;
  openDate?: string;
  isConfirmed?: boolean;
}

export interface PdfDepositItem {
  id: string;
  date: string;
  amount: number;
  comment?: string;
}

export interface PdfParseResponse {
  account?: string;
  currency: string;
  currencySymbol: string;
  deposits: PdfDepositItem[];
  openPositions: PdfPortfolioPosition[];
  summary: {
    totalDeposited: number;
    totalOpenValue: number;
    totalProfit: number;
    openPositionsCount: number;
  };
  rawTextPreview?: string;
}

export type TabType = 'home' | 'allocation' | 'goal' | 'settings';
