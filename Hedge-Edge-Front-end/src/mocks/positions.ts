/**
 * Mock Trading Positions for Front-End Testing
 * =============================================
 * Simulated trading positions and account data for UI testing.
 */

import type { ConnectionPosition, ConnectionMetrics } from '@/types/connections';

// ============================================================================
// Mock Positions Data
// ============================================================================

const NOW = Date.now();
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Generate realistic mock positions
 */
export const mockPositions: ConnectionPosition[] = [
  {
    ticket: 100001,
    symbol: 'EURUSD',
    type: 'buy',
    volume: 1.0,
    openPrice: 1.08450,
    currentPrice: 1.08520,
    profit: 70.00,
    stopLoss: 1.08200,
    takeProfit: 1.08800,
    openTime: new Date(NOW - 4 * ONE_HOUR_MS).toISOString(),
    magic: 12345,
    comment: 'Hedge position',
  },
  {
    ticket: 100002,
    symbol: 'EURUSD',
    type: 'sell',
    volume: 0.5,
    openPrice: 1.08480,
    currentPrice: 1.08520,
    profit: -20.00,
    stopLoss: 1.08700,
    takeProfit: 1.08100,
    openTime: new Date(NOW - 2 * ONE_HOUR_MS).toISOString(),
    magic: 12345,
    comment: 'Hedge counter',
  },
  {
    ticket: 100003,
    symbol: 'GBPUSD',
    type: 'buy',
    volume: 0.75,
    openPrice: 1.26800,
    currentPrice: 1.26950,
    profit: 112.50,
    stopLoss: 1.26500,
    takeProfit: 1.27300,
    openTime: new Date(NOW - 8 * ONE_HOUR_MS).toISOString(),
    magic: 0,
    comment: '',
  },
  {
    ticket: 100004,
    symbol: 'USDJPY',
    type: 'sell',
    volume: 2.0,
    openPrice: 149.250,
    currentPrice: 149.180,
    profit: 93.80,
    stopLoss: 149.500,
    takeProfit: 148.800,
    openTime: new Date(NOW - 1 * ONE_HOUR_MS).toISOString(),
    magic: 67890,
    comment: 'Scalp trade',
  },
  {
    ticket: 100005,
    symbol: 'XAUUSD',
    type: 'buy',
    volume: 0.1,
    openPrice: 2025.50,
    currentPrice: 2028.75,
    profit: 32.50,
    openTime: new Date(NOW - 24 * ONE_HOUR_MS).toISOString(),
    magic: 0,
    comment: 'Gold long',
  },
];

// ============================================================================
// Mock Account Metrics
// ============================================================================

export const mockMetrics: Record<string, ConnectionMetrics> = {
  // Small account
  small: {
    balance: 1000.00,
    equity: 1045.50,
    profit: 45.50,
    positionCount: 2,
    margin: 125.00,
    freeMargin: 920.50,
    marginLevel: 836.40,
  },
  
  // Medium account
  medium: {
    balance: 10000.00,
    equity: 10288.80,
    profit: 288.80,
    positionCount: 5,
    margin: 1250.00,
    freeMargin: 9038.80,
    marginLevel: 823.10,
  },
  
  // Large account (power user)
  large: {
    balance: 100000.00,
    equity: 103450.25,
    profit: 3450.25,
    positionCount: 25,
    margin: 15000.00,
    freeMargin: 88450.25,
    marginLevel: 689.67,
  },
  
  // Account with loss
  losing: {
    balance: 5000.00,
    equity: 4750.00,
    profit: -250.00,
    positionCount: 3,
    margin: 500.00,
    freeMargin: 4250.00,
    marginLevel: 950.00,
  },
  
  // Empty account (new user)
  empty: {
    balance: 10000.00,
    equity: 10000.00,
    profit: 0,
    positionCount: 0,
    margin: 0,
    freeMargin: 10000.00,
    marginLevel: 0,
  },
  
  // Margin call warning
  marginWarning: {
    balance: 2000.00,
    equity: 850.00,
    profit: -1150.00,
    positionCount: 8,
    margin: 700.00,
    freeMargin: 150.00,
    marginLevel: 121.43,
  },
};

// ============================================================================
// Position Generators
// ============================================================================

/**
 * Generate random positions for stress testing
 */
export function generateRandomPositions(count: number): ConnectionPosition[] {
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'XAUUSD', 'BTCUSD'];
  const positions: ConnectionPosition[] = [];
  
  for (let i = 0; i < count; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const type = Math.random() > 0.5 ? 'buy' : 'sell';
    const volume = Math.round((Math.random() * 2 + 0.01) * 100) / 100;
    const openPrice = getBasePrice(symbol);
    const priceDelta = (Math.random() - 0.5) * 0.01 * openPrice;
    const currentPrice = openPrice + priceDelta;
    const profit = type === 'buy' 
      ? (currentPrice - openPrice) * volume * getMultiplier(symbol)
      : (openPrice - currentPrice) * volume * getMultiplier(symbol);
    
    positions.push({
      ticket: 100000 + i,
      symbol,
      type,
      volume,
      openPrice: Math.round(openPrice * 100000) / 100000,
      currentPrice: Math.round(currentPrice * 100000) / 100000,
      profit: Math.round(profit * 100) / 100,
      openTime: new Date(NOW - Math.random() * 48 * ONE_HOUR_MS).toISOString(),
      magic: Math.random() > 0.5 ? Math.floor(Math.random() * 100000) : 0,
      comment: Math.random() > 0.7 ? 'Auto trade' : '',
    });
  }
  
  return positions;
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    EURUSD: 1.085,
    GBPUSD: 1.269,
    USDJPY: 149.2,
    AUDUSD: 0.655,
    USDCAD: 1.345,
    XAUUSD: 2025,
    BTCUSD: 43500,
  };
  return prices[symbol] || 1.0;
}

function getMultiplier(symbol: string): number {
  if (symbol === 'USDJPY') return 100000 / 149.2;
  if (symbol === 'XAUUSD') return 100;
  if (symbol === 'BTCUSD') return 1;
  return 100000;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get positions filtered by symbol
 */
export function getPositionsBySymbol(symbol: string): ConnectionPosition[] {
  return mockPositions.filter(p => p.symbol === symbol);
}

/**
 * Get positions filtered by type
 */
export function getPositionsByType(type: 'buy' | 'sell'): ConnectionPosition[] {
  return mockPositions.filter(p => p.type === type);
}

/**
 * Calculate total profit from positions
 */
export function calculateTotalProfit(positions: ConnectionPosition[]): number {
  return positions.reduce((sum, p) => sum + p.profit, 0);
}

/**
 * Calculate net exposure for a symbol
 */
export function calculateNetExposure(positions: ConnectionPosition[], symbol: string): number {
  return positions
    .filter(p => p.symbol === symbol)
    .reduce((net, p) => {
      return net + (p.type === 'buy' ? p.volume : -p.volume);
    }, 0);
}

/**
 * Group positions by symbol
 */
export function groupPositionsBySymbol(
  positions: ConnectionPosition[]
): Record<string, ConnectionPosition[]> {
  return positions.reduce((groups, position) => {
    const symbol = position.symbol;
    if (!groups[symbol]) {
      groups[symbol] = [];
    }
    groups[symbol].push(position);
    return groups;
  }, {} as Record<string, ConnectionPosition[]>);
}
