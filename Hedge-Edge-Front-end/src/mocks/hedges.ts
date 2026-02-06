/**
 * Mock Hedge Mappings for Front-End Testing
 * ==========================================
 * Simulated hedge relationships between positions and accounts.
 */

// ============================================================================
// Types
// ============================================================================

export interface HedgeMapping {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  legs: HedgeLeg[];
  netExposure: number;
  totalVolume: number;
  totalProfit: number;
  status: HedgeStatus;
}

export interface HedgeLeg {
  id: string;
  accountId: string;
  accountName: string;
  platform: 'mt5' | 'mt4' | 'ctrader';
  positionTicket: number;
  symbol: string;
  direction: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  contribution: number; // percentage contribution to hedge
}

export type HedgeStatus = 
  | 'balanced'      // Net exposure near zero
  | 'imbalanced'    // Significant net exposure
  | 'partial'       // Some legs closed
  | 'closed'        // All legs closed
  | 'error';        // Data sync issue

// ============================================================================
// Mock Data
// ============================================================================

const NOW = new Date().toISOString();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const mockHedges: HedgeMapping[] = [
  {
    id: 'hedge-001',
    name: 'EURUSD Hedge #1',
    description: 'Cross-broker EUR/USD hedge for arbitrage',
    createdAt: new Date(Date.now() - 7 * ONE_DAY_MS).toISOString(),
    updatedAt: NOW,
    isActive: true,
    status: 'balanced',
    netExposure: 0.05,
    totalVolume: 2.0,
    totalProfit: 125.50,
    legs: [
      {
        id: 'leg-001-a',
        accountId: 'acc-001',
        accountName: 'Primary MT5',
        platform: 'mt5',
        positionTicket: 100001,
        symbol: 'EURUSD',
        direction: 'buy',
        volume: 1.0,
        openPrice: 1.08450,
        currentPrice: 1.08520,
        profit: 70.00,
        contribution: 50,
      },
      {
        id: 'leg-001-b',
        accountId: 'acc-002',
        accountName: 'Hedge MT5',
        platform: 'mt5',
        positionTicket: 200001,
        symbol: 'EURUSD',
        direction: 'sell',
        volume: 0.95,
        openPrice: 1.08500,
        currentPrice: 1.08520,
        profit: 55.50,
        contribution: 50,
      },
    ],
  },
  {
    id: 'hedge-002',
    name: 'Gold Hedge',
    description: 'XAUUSD multi-account hedge',
    createdAt: new Date(Date.now() - 3 * ONE_DAY_MS).toISOString(),
    updatedAt: NOW,
    isActive: true,
    status: 'imbalanced',
    netExposure: 0.15,
    totalVolume: 0.5,
    totalProfit: -45.00,
    legs: [
      {
        id: 'leg-002-a',
        accountId: 'acc-001',
        accountName: 'Primary MT5',
        platform: 'mt5',
        positionTicket: 100005,
        symbol: 'XAUUSD',
        direction: 'buy',
        volume: 0.3,
        openPrice: 2025.50,
        currentPrice: 2028.75,
        profit: 32.50,
        contribution: 60,
      },
      {
        id: 'leg-002-b',
        accountId: 'acc-003',
        accountName: 'cTrader Account',
        platform: 'ctrader',
        positionTicket: 300001,
        symbol: 'XAUUSD',
        direction: 'sell',
        volume: 0.15,
        openPrice: 2020.00,
        currentPrice: 2028.75,
        profit: -77.50,
        contribution: 40,
      },
    ],
  },
  {
    id: 'hedge-003',
    name: 'JPY Pairs Hedge',
    description: 'Correlated JPY pair hedge strategy',
    createdAt: new Date(Date.now() - 14 * ONE_DAY_MS).toISOString(),
    updatedAt: new Date(Date.now() - 2 * ONE_DAY_MS).toISOString(),
    isActive: false,
    status: 'closed',
    netExposure: 0,
    totalVolume: 0,
    totalProfit: 450.00,
    legs: [],
  },
  {
    id: 'hedge-004',
    name: 'GBP Cross Hedge',
    description: 'GBPUSD and EURGBP correlation hedge',
    createdAt: new Date(Date.now() - 1 * ONE_DAY_MS).toISOString(),
    updatedAt: NOW,
    isActive: true,
    status: 'partial',
    netExposure: 0.75,
    totalVolume: 1.5,
    totalProfit: 89.25,
    legs: [
      {
        id: 'leg-004-a',
        accountId: 'acc-001',
        accountName: 'Primary MT5',
        platform: 'mt5',
        positionTicket: 100003,
        symbol: 'GBPUSD',
        direction: 'buy',
        volume: 0.75,
        openPrice: 1.26800,
        currentPrice: 1.26950,
        profit: 112.50,
        contribution: 50,
      },
      {
        id: 'leg-004-b',
        accountId: 'acc-002',
        accountName: 'Hedge MT5',
        platform: 'mt5',
        positionTicket: 200003,
        symbol: 'EURGBP',
        direction: 'buy',
        volume: 0.75,
        openPrice: 0.85500,
        currentPrice: 0.85470,
        profit: -23.25,
        contribution: 50,
      },
    ],
  },
];

// ============================================================================
// Empty State Data
// ============================================================================

export const emptyHedges: HedgeMapping[] = [];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get hedge by ID
 */
export function getHedgeById(id: string): HedgeMapping | undefined {
  return mockHedges.find(h => h.id === id);
}

/**
 * Get active hedges only
 */
export function getActiveHedges(): HedgeMapping[] {
  return mockHedges.filter(h => h.isActive);
}

/**
 * Get hedges by status
 */
export function getHedgesByStatus(status: HedgeStatus): HedgeMapping[] {
  return mockHedges.filter(h => h.status === status);
}

/**
 * Get hedges involving a specific account
 */
export function getHedgesByAccount(accountId: string): HedgeMapping[] {
  return mockHedges.filter(h => 
    h.legs.some(leg => leg.accountId === accountId)
  );
}

/**
 * Get hedges involving a specific symbol
 */
export function getHedgesBySymbol(symbol: string): HedgeMapping[] {
  return mockHedges.filter(h =>
    h.legs.some(leg => leg.symbol === symbol)
  );
}

/**
 * Calculate hedge balance ratio (0 = perfectly balanced, 1 = fully one-sided)
 */
export function calculateHedgeRatio(hedge: HedgeMapping): number {
  const buyVolume = hedge.legs
    .filter(l => l.direction === 'buy')
    .reduce((sum, l) => sum + l.volume, 0);
  const sellVolume = hedge.legs
    .filter(l => l.direction === 'sell')
    .reduce((sum, l) => sum + l.volume, 0);
  
  const total = buyVolume + sellVolume;
  if (total === 0) return 0;
  
  return Math.abs(buyVolume - sellVolume) / total;
}

/**
 * Get summary statistics for all hedges
 */
export function getHedgeSummary(): {
  total: number;
  active: number;
  balanced: number;
  totalProfit: number;
  totalVolume: number;
} {
  return {
    total: mockHedges.length,
    active: mockHedges.filter(h => h.isActive).length,
    balanced: mockHedges.filter(h => h.status === 'balanced').length,
    totalProfit: mockHedges.reduce((sum, h) => sum + h.totalProfit, 0),
    totalVolume: mockHedges.reduce((sum, h) => sum + h.totalVolume, 0),
  };
}

/**
 * Generate a new hedge ID
 */
export function generateHedgeId(): string {
  return `hedge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
