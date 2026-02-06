/**
 * Mock Data Loader - Development Utility
 * ======================================
 * Call this in browser console or import in development to load mock trading accounts.
 * 
 * Usage in browser console:
 *   window.loadMockAccounts('active_trader')
 *   window.clearMockAccounts()
 *   window.getMockPresets()
 */

import type { TradingAccount } from '@/hooks/useTradingAccounts';

const LOCAL_ACCOUNTS_KEY = 'hedge_edge_demo_accounts';

// ============================================================================
// Pre-built Account Data
// ============================================================================

const NOW = new Date().toISOString();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function generateId(): string {
  return crypto.randomUUID();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// ============================================================================
// Random Account Generator
// ============================================================================

const PROP_FIRMS = [
  { name: 'FTMO', profitTarget: 10, maxLoss: 10, maxDailyLoss: 5, minDays: 4 },
  { name: 'Funded Next', profitTarget: 10, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  { name: 'The Funded Trader', profitTarget: 10, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  { name: 'MyFundedFX', profitTarget: 8, maxLoss: 8, maxDailyLoss: 5, minDays: 5 },
  { name: 'True Forex Funds', profitTarget: 8, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  { name: 'Alpha Capital', profitTarget: 8, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  { name: 'TopStep', profitTarget: 6, maxLoss: 4, maxDailyLoss: 2, minDays: 0 },
  { name: 'Apex Trader', profitTarget: 6, maxLoss: 3, maxDailyLoss: 2, minDays: 0 },
];

const HEDGE_BROKERS = [
  { name: 'IC Markets', server: 'ICMarkets-Live05' },
  { name: 'Pepperstone', server: 'Pepperstone-MT5-Live01' },
  { name: 'FxPro', server: 'FxPro-MT5-01' },
  { name: 'XM', server: 'XMGlobal-MT5' },
];

const ACCOUNT_SIZES = [10000, 25000, 50000, 100000, 200000];
const PLATFORMS = ['MT5', 'MT5', 'MT5', 'cTrader']; // Weighted towards MT5

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomAccount(index: number): TradingAccount {
  // 70% prop firm, 30% hedge/live
  const isLive = Math.random() < 0.3;
  
  if (isLive) {
    const broker = randomChoice(HEDGE_BROKERS);
    const accountSize = randomChoice([5000, 10000, 15000, 25000]);
    const pnlPercent = (Math.random() * 20) - 5; // -5% to +15%
    const pnl = Math.round(accountSize * (pnlPercent / 100));
    
    return {
      id: generateId(),
      user_id: 'demo',
      account_name: `${broker.name} Live #${index}`,
      prop_firm: broker.name,
      account_size: accountSize,
      current_balance: accountSize + pnl,
      phase: 'live',
      platform: 'MT5',
      server: broker.server,
      login: String(randomBetween(10000000, 99999999)),
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl,
      pnl_percent: parseFloat(pnlPercent.toFixed(2)),
      is_active: true,
      is_archived: false,
      last_sync_at: NOW,
      created_at: daysAgo(randomBetween(30, 180)),
      updated_at: NOW,
    };
  }
  
  // Prop firm account
  const firm = randomChoice(PROP_FIRMS);
  const accountSize = randomChoice(ACCOUNT_SIZES);
  const phase = Math.random() < 0.4 ? 'funded' : 'evaluation';
  const evaluationPhase = phase === 'evaluation' ? (Math.random() < 0.7 ? 1 : 2) : undefined;
  const profitTarget = phase === 'evaluation' && evaluationPhase === 2 ? 5 : firm.profitTarget;
  
  // Generate realistic PnL
  let pnlPercent: number;
  if (phase === 'funded') {
    pnlPercent = (Math.random() * 16) - 6; // -6% to +10%
  } else {
    pnlPercent = (Math.random() * 14) - 4; // -4% to +10%
  }
  const pnl = Math.round(accountSize * (pnlPercent / 100));
  
  const tradingDays = randomBetween(1, 20);
  
  return {
    id: generateId(),
    user_id: 'demo',
    account_name: `${firm.name} ${phase === 'funded' ? 'Funded' : 'Challenge'} ${accountSize / 1000}K`,
    prop_firm: firm.name,
    account_size: accountSize,
    current_balance: accountSize + pnl,
    phase,
    platform: randomChoice(PLATFORMS),
    server: null,
    login: String(randomBetween(5000000, 9999999)),
    profit_target: profitTarget,
    max_loss: firm.maxLoss,
    max_daily_loss: firm.maxDailyLoss,
    min_trading_days: firm.minDays || null,
    trading_days_completed: tradingDays,
    pnl,
    pnl_percent: parseFloat(pnlPercent.toFixed(2)),
    is_active: true,
    is_archived: false,
    evaluation_phase: evaluationPhase,
    evaluation_fee: phase === 'evaluation' ? randomChoice([155, 199, 229, 299, 499]) : undefined,
    last_sync_at: NOW,
    created_at: daysAgo(randomBetween(5, 90)),
    updated_at: NOW,
  };
}

/**
 * Generate multiple random accounts
 */
export function generateRandomAccounts(count: number = 15): TradingAccount[] {
  const accounts: TradingAccount[] = [];
  for (let i = 1; i <= count; i++) {
    accounts.push(generateRandomAccount(i));
  }
  return accounts;
}

/**
 * Load random accounts into localStorage
 */
export function loadRandomAccounts(count: number = 15): void {
  const accounts = generateRandomAccounts(count);
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  
  const stats = {
    total: accounts.length,
    funded: accounts.filter(a => a.phase === 'funded').length,
    evaluation: accounts.filter(a => a.phase === 'evaluation').length,
    live: accounts.filter(a => a.phase === 'live').length,
    totalValue: accounts.reduce((sum, a) => sum + a.account_size, 0),
    totalPnL: accounts.reduce((sum, a) => sum + a.pnl, 0),
  };
  
  console.log(`[Mock] ✅ Generated ${count} random accounts`);
  console.table(stats);
  console.log('[Mock] Refresh the page to see changes');
}

// Active Trader Preset - 4 accounts with realistic data
const activeTraderAccounts: TradingAccount[] = [
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Funded 100K',
    prop_firm: 'FTMO',
    account_size: 100000,
    current_balance: 104250,
    phase: 'funded',
    platform: 'MT5',
    server: 'FTMO-Server3',
    login: '6001234',
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 12,
    pnl: 4250,
    pnl_percent: 4.25,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(45),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Verification',
    prop_firm: 'FTMO',
    account_size: 50000,
    current_balance: 51875,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: '5005678',
    profit_target: 5,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 3,
    pnl: 1875,
    pnl_percent: 3.75,
    is_active: true,
    is_archived: false,
    evaluation_phase: 2,
    last_sync_at: NOW,
    created_at: daysAgo(21),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Funded Next 50K',
    prop_firm: 'Funded Next',
    account_size: 50000,
    current_balance: 50750,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 4,
    pnl: 750,
    pnl_percent: 1.5,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    evaluation_fee: 299,
    last_sync_at: NOW,
    created_at: daysAgo(10),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'IC Markets Live',
    prop_firm: 'IC Markets',
    account_size: 5000,
    current_balance: 5325,
    phase: 'live',
    platform: 'MT5',
    server: 'ICMarkets-Live05',
    login: '12345678',
    profit_target: null,
    max_loss: null,
    max_daily_loss: null,
    min_trading_days: null,
    trading_days_completed: null,
    pnl: 325,
    pnl_percent: 6.5,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(90),
    updated_at: NOW,
  },
];

// Power User Preset - 10 accounts across multiple firms
const powerUserAccounts: TradingAccount[] = [
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Funded 200K #1',
    prop_firm: 'FTMO',
    account_size: 200000,
    current_balance: 208750,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 20,
    pnl: 8750,
    pnl_percent: 4.375,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(60),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Funded 200K #2',
    prop_firm: 'FTMO',
    account_size: 200000,
    current_balance: 203200,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 15,
    pnl: 3200,
    pnl_percent: 1.6,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(45),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Challenge 100K',
    prop_firm: 'FTMO',
    account_size: 100000,
    current_balance: 102100,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 3,
    pnl: 2100,
    pnl_percent: 2.1,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    last_sync_at: NOW,
    created_at: daysAgo(12),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Funded Next 100K',
    prop_firm: 'Funded Next',
    account_size: 100000,
    current_balance: 105500,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 18,
    pnl: 5500,
    pnl_percent: 5.5,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(30),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Funded Next 50K Eval',
    prop_firm: 'Funded Next',
    account_size: 50000,
    current_balance: 51250,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 5,
    pnl: 1250,
    pnl_percent: 2.5,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    last_sync_at: NOW,
    created_at: daysAgo(8),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'TFT Royal 200K',
    prop_firm: 'The Funded Trader',
    account_size: 200000,
    current_balance: 212000,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 25,
    pnl: 12000,
    pnl_percent: 6.0,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(75),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'MFFX 100K',
    prop_firm: 'MyFundedFX',
    account_size: 100000,
    current_balance: 102800,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 8,
    max_loss: 8,
    max_daily_loss: 5,
    min_trading_days: 5,
    trading_days_completed: 12,
    pnl: 2800,
    pnl_percent: 2.8,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(40),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Alpha Capital 50K',
    prop_firm: 'Alpha Capital',
    account_size: 50000,
    current_balance: 50850,
    phase: 'evaluation',
    platform: 'cTrader',
    server: null,
    login: null,
    profit_target: 8,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 2,
    pnl: 850,
    pnl_percent: 1.7,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    last_sync_at: NOW,
    created_at: daysAgo(5),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Pepperstone Live',
    prop_firm: 'Pepperstone',
    account_size: 25000,
    current_balance: 26875,
    phase: 'live',
    platform: 'MT5',
    server: 'Pepperstone-MT5-Live01',
    login: '87654321',
    profit_target: null,
    max_loss: null,
    max_daily_loss: null,
    min_trading_days: null,
    trading_days_completed: null,
    pnl: 1875,
    pnl_percent: 7.5,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(120),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'IC Markets Hedge',
    prop_firm: 'IC Markets',
    account_size: 15000,
    current_balance: 15425,
    phase: 'live',
    platform: 'MT5',
    server: 'ICMarkets-Live05',
    login: '12345679',
    profit_target: null,
    max_loss: null,
    max_daily_loss: null,
    min_trading_days: null,
    trading_days_completed: null,
    pnl: 425,
    pnl_percent: 2.83,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(90),
    updated_at: NOW,
  },
];

// Mixed Portfolio - variety of winning and losing accounts
const mixedPortfolioAccounts: TradingAccount[] = [
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Funded 100K',
    prop_firm: 'FTMO',
    account_size: 100000,
    current_balance: 105200,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 18,
    pnl: 5200,
    pnl_percent: 5.2,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(60),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Funded Next 50K',
    prop_firm: 'Funded Next',
    account_size: 50000,
    current_balance: 47900,
    phase: 'funded',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 12,
    pnl: -2100,
    pnl_percent: -4.2,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(25),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Challenge 50K',
    prop_firm: 'FTMO',
    account_size: 50000,
    current_balance: 53200,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 5,
    pnl: 3200,
    pnl_percent: 6.4,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    evaluation_fee: 299,
    last_sync_at: NOW,
    created_at: daysAgo(18),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'TFT Verification 100K',
    prop_firm: 'The Funded Trader',
    account_size: 100000,
    current_balance: 102800,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 5,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 2,
    pnl: 2800,
    pnl_percent: 2.8,
    is_active: true,
    is_archived: false,
    evaluation_phase: 2,
    last_sync_at: NOW,
    created_at: daysAgo(8),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Alpha Capital 25K',
    prop_firm: 'Alpha Capital',
    account_size: 25000,
    current_balance: 25125,
    phase: 'evaluation',
    platform: 'cTrader',
    server: null,
    login: null,
    profit_target: 8,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 1,
    pnl: 125,
    pnl_percent: 0.5,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    evaluation_fee: 199,
    last_sync_at: NOW,
    created_at: daysAgo(3),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'IC Markets Personal',
    prop_firm: 'IC Markets',
    account_size: 10000,
    current_balance: 10780,
    phase: 'live',
    platform: 'MT5',
    server: 'ICMarkets-Live05',
    login: '99887766',
    profit_target: null,
    max_loss: null,
    max_daily_loss: null,
    min_trading_days: null,
    trading_days_completed: null,
    pnl: 780,
    pnl_percent: 7.8,
    is_active: true,
    is_archived: false,
    last_sync_at: NOW,
    created_at: daysAgo(180),
    updated_at: NOW,
  },
];

// Beginner Preset - 2 small accounts
const beginnerAccounts: TradingAccount[] = [
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'FTMO Challenge',
    prop_firm: 'FTMO',
    account_size: 10000,
    current_balance: 10250,
    phase: 'evaluation',
    platform: 'MT5',
    server: 'FTMO-Server',
    login: '5001234',
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
    trading_days_completed: 2,
    pnl: 250,
    pnl_percent: 2.5,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    evaluation_fee: 155,
    last_sync_at: NOW,
    created_at: daysAgo(7),
    updated_at: NOW,
  },
  {
    id: generateId(),
    user_id: 'demo',
    account_name: 'Funded Next Trial',
    prop_firm: 'Funded Next',
    account_size: 25000,
    current_balance: 24875,
    phase: 'evaluation',
    platform: 'MT5',
    server: null,
    login: null,
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: null,
    trading_days_completed: 3,
    pnl: -125,
    pnl_percent: -0.5,
    is_active: true,
    is_archived: false,
    evaluation_phase: 1,
    evaluation_fee: 229,
    last_sync_at: NOW,
    created_at: daysAgo(14),
    updated_at: NOW,
  },
];

// ============================================================================
// Preset Map
// ============================================================================

const presets: Record<string, TradingAccount[]> = {
  new_user: [],
  beginner: beginnerAccounts,
  active_trader: activeTraderAccounts,
  power_user: powerUserAccounts,
  mixed_portfolio: mixedPortfolioAccounts,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Load mock accounts into localStorage
 */
export function loadMockAccounts(preset: keyof typeof presets = 'active_trader'): void {
  const accounts = presets[preset];
  if (!accounts) {
    console.error(`[Mock] Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}`);
    return;
  }
  
  // Regenerate IDs to ensure uniqueness
  const accountsWithNewIds = accounts.map(acc => ({
    ...acc,
    id: generateId(),
    created_at: acc.created_at,
    updated_at: NOW,
    last_sync_at: NOW,
  }));
  
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accountsWithNewIds));
  console.log(`[Mock] ✅ Loaded ${accountsWithNewIds.length} accounts (preset: ${preset})`);
  console.log('[Mock] Refresh the page to see changes');
}

/**
 * Clear all mock accounts
 */
export function clearMockAccounts(): void {
  localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
  console.log('[Mock] ✅ Cleared all accounts');
  console.log('[Mock] Refresh the page to see changes');
}

/**
 * Get available presets
 */
export function getMockPresets(): string[] {
  return Object.keys(presets);
}

/**
 * Get current accounts from localStorage
 */
export function getCurrentAccounts(): TradingAccount[] {
  try {
    const stored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get preset summary
 */
export function getPresetInfo(preset: keyof typeof presets): void {
  const accounts = presets[preset];
  if (!accounts) {
    console.error(`[Mock] Unknown preset: ${preset}`);
    return;
  }
  
  const active = accounts.filter(a => !a.is_archived);
  const totalValue = active.reduce((sum, a) => sum + a.account_size, 0);
  const totalPnL = active.reduce((sum, a) => sum + a.pnl, 0);
  
  console.group(`[Mock] Preset: ${preset}`);
  console.log('Accounts:', accounts.length);
  console.log('Total Value:', `$${totalValue.toLocaleString()}`);
  console.log('Total P&L:', `$${totalPnL.toLocaleString()}`);
  console.log('Avg Return:', `${(totalPnL / totalValue * 100).toFixed(2)}%`);
  console.log('By Phase:', {
    evaluation: active.filter(a => a.phase === 'evaluation').length,
    funded: active.filter(a => a.phase === 'funded').length,
    live: active.filter(a => a.phase === 'live').length,
  });
  console.groupEnd();
}

// ============================================================================
// Auto-attach to window for browser console access
// ============================================================================

if (typeof window !== 'undefined') {
  (window as any).loadMockAccounts = loadMockAccounts;
  (window as any).clearMockAccounts = clearMockAccounts;
  (window as any).getMockPresets = getMockPresets;
  (window as any).getCurrentAccounts = getCurrentAccounts;
  (window as any).getPresetInfo = getPresetInfo;
  (window as any).loadRandomAccounts = loadRandomAccounts;
  (window as any).generateRandomAccounts = generateRandomAccounts;
  
  console.log('[Mock] 🎮 Mock utilities available:');
  console.log('  loadMockAccounts(preset) - Load accounts (presets: new_user, beginner, active_trader, power_user, mixed_portfolio)');
  console.log('  loadRandomAccounts(count) - Generate random accounts (default: 15)');
  console.log('  clearMockAccounts() - Clear all accounts');
  console.log('  getMockPresets() - List available presets');
  console.log('  getPresetInfo(preset) - Show preset details');
  
  // Auto-load 15 random accounts on first run if no accounts exist
  const existing = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
  if (!existing || JSON.parse(existing).length === 0) {
    console.log('[Mock] 🚀 No accounts found, auto-loading 15 random accounts...');
    loadRandomAccounts(15);
  }
}

export default {
  load: loadMockAccounts,
  clear: clearMockAccounts,
  getPresets: getMockPresets,
  getCurrent: getCurrentAccounts,
  getInfo: getPresetInfo,
  loadRandom: loadRandomAccounts,
  generateRandom: generateRandomAccounts,
};
