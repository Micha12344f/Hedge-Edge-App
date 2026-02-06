/**
 * Mock Trading Accounts for Front-End Testing
 * ============================================
 * Prop firm trading accounts for Dashboard UI testing.
 * These represent actual trading accounts that users manage.
 * 
 * Usage:
 *   import { mockTradingAccountPresets, loadMockTradingAccounts } from '@/mocks/trading-accounts';
 *   loadMockTradingAccounts('active_trader'); // Loads preset to localStorage
 */

import type { TradingAccount } from '@/hooks/useTradingAccounts';

// ============================================================================
// Constants
// ============================================================================

const LOCAL_ACCOUNTS_KEY = 'hedge_edge_demo_accounts';
const NOW = new Date().toISOString();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Prop Firm Configurations (matches AddAccountModal.tsx)
// ============================================================================

const PROP_FIRMS = {
  FTMO: { name: 'FTMO', profitTarget: 10, maxLoss: 10, maxDailyLoss: 5, minDays: 4 },
  FUNDED_NEXT: { name: 'Funded Next', profitTarget: 10, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  THE_FUNDED_TRADER: { name: 'The Funded Trader', profitTarget: 10, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  MY_FUNDED_FX: { name: 'MyFundedFX', profitTarget: 8, maxLoss: 8, maxDailyLoss: 5, minDays: 5 },
  TRUE_FOREX_FUNDS: { name: 'True Forex Funds', profitTarget: 8, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  ALPHA_CAPITAL: { name: 'Alpha Capital', profitTarget: 8, maxLoss: 10, maxDailyLoss: 5, minDays: 0 },
  TOPSTEP: { name: 'TopStep', profitTarget: 6, maxLoss: 4, maxDailyLoss: 2, minDays: 0 },
};

// ============================================================================
// Mock Trading Account Data
// ============================================================================

/**
 * Generate a unique ID
 */
const generateId = () => crypto.randomUUID();

/**
 * Calculate PnL percent from account size and PnL
 */
const calcPnlPercent = (pnl: number, accountSize: number): number => {
  return accountSize > 0 ? (pnl / accountSize) * 100 : 0;
};

/**
 * Create a mock trading account
 */
function createAccount(params: {
  name: string;
  propFirm: string;
  accountSize: number;
  phase: 'evaluation' | 'funded' | 'live';
  pnl: number;
  platform?: string;
  server?: string;
  login?: string;
  profitTarget?: number;
  maxLoss?: number;
  maxDailyLoss?: number;
  minTradingDays?: number;
  tradingDaysCompleted?: number;
  evaluationPhase?: number;
  evaluationFee?: number;
  isArchived?: boolean;
  previousAccountId?: string;
  daysAgo?: number;
}): TradingAccount {
  const id = generateId();
  const accountSize = params.accountSize;
  const pnl = params.pnl;
  const currentBalance = accountSize + pnl;
  const pnlPercent = calcPnlPercent(pnl, accountSize);
  const createdAt = new Date(Date.now() - (params.daysAgo || 30) * ONE_DAY_MS).toISOString();

  return {
    id,
    user_id: 'demo',
    account_name: params.name,
    prop_firm: params.propFirm,
    account_size: accountSize,
    current_balance: currentBalance,
    phase: params.phase,
    platform: params.platform || 'MT5',
    server: params.server || null,
    login: params.login || null,
    metaapi_account_id: null,
    profit_target: params.profitTarget ?? null,
    max_loss: params.maxLoss ?? null,
    max_daily_loss: params.maxDailyLoss ?? null,
    min_trading_days: params.minTradingDays ?? null,
    trading_days_completed: params.tradingDaysCompleted ?? 0,
    pnl,
    pnl_percent: pnlPercent,
    is_active: true,
    is_archived: params.isArchived || false,
    evaluation_fee: params.evaluationFee ?? null,
    evaluation_phase: params.evaluationPhase ?? null,
    previous_account_id: params.previousAccountId ?? null,
    last_sync_at: NOW,
    created_at: createdAt,
    updated_at: NOW,
  };
}

// ============================================================================
// Preset Configurations
// ============================================================================

export type MockPresetType = 
  | 'new_user'           // Empty state - no accounts
  | 'beginner'           // 1-2 small evaluation accounts
  | 'active_trader'      // 3-5 mixed accounts (realistic)
  | 'power_user'         // 10+ accounts across multiple firms
  | 'funded_success'     // Multiple funded accounts doing well
  | 'struggling'         // Accounts with losses
  | 'mixed_portfolio';   // Variety of states for comprehensive testing

/**
 * New User - Empty state for onboarding testing
 */
const newUserAccounts: TradingAccount[] = [];

/**
 * Beginner - Just starting out with 1-2 small accounts
 */
const beginnerAccounts: TradingAccount[] = [
  createAccount({
    name: 'FTMO Challenge',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 10000,
    phase: 'evaluation',
    pnl: 250,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    minTradingDays: PROP_FIRMS.FTMO.minDays,
    tradingDaysCompleted: 2,
    evaluationPhase: 1,
    evaluationFee: 155,
    platform: 'MT5',
    server: 'FTMO-Server',
    login: '5001234',
    daysAgo: 7,
  }),
  createAccount({
    name: 'Funded Next Trial',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 25000,
    phase: 'evaluation',
    pnl: -125,
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    evaluationPhase: 1,
    evaluationFee: 229,
    platform: 'MT5',
    daysAgo: 14,
  }),
];

/**
 * Active Trader - Realistic portfolio with 4-5 accounts
 */
const activeTraderAccounts: TradingAccount[] = [
  // Funded account doing well
  createAccount({
    name: 'FTMO Funded 100K',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: 4250,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    platform: 'MT5',
    server: 'FTMO-Server3',
    login: '6001234',
    daysAgo: 45,
  }),
  // Evaluation Phase 2
  createAccount({
    name: 'FTMO Verification',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: 1875,
    profitTarget: 5, // Phase 2 has lower target
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    minTradingDays: PROP_FIRMS.FTMO.minDays,
    tradingDaysCompleted: 3,
    evaluationPhase: 2,
    platform: 'MT5',
    login: '5005678',
    daysAgo: 21,
  }),
  // New challenge
  createAccount({
    name: 'Funded Next 50K',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: 750,
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    evaluationPhase: 1,
    evaluationFee: 299,
    platform: 'MT5',
    daysAgo: 10,
  }),
  // Hedge account (live personal)
  createAccount({
    name: 'IC Markets Live',
    propFirm: 'IC Markets',
    accountSize: 5000,
    phase: 'live',
    pnl: 325,
    platform: 'MT5',
    server: 'ICMarkets-Live05',
    login: '12345678',
    daysAgo: 90,
  }),
];

/**
 * Power User - Many accounts for stress testing
 */
const powerUserAccounts: TradingAccount[] = [
  // FTMO accounts
  createAccount({
    name: 'FTMO Funded 200K #1',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 200000,
    phase: 'funded',
    pnl: 8750,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 60,
  }),
  createAccount({
    name: 'FTMO Funded 200K #2',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 200000,
    phase: 'funded',
    pnl: 3200,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 45,
  }),
  createAccount({
    name: 'FTMO Challenge 100K',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 100000,
    phase: 'evaluation',
    pnl: 2100,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    evaluationPhase: 1,
    tradingDaysCompleted: 3,
    platform: 'MT5',
    daysAgo: 12,
  }),
  // Funded Next accounts
  createAccount({
    name: 'Funded Next 100K',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: 5500,
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 30,
  }),
  createAccount({
    name: 'Funded Next 50K Eval',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: 1250,
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    evaluationPhase: 1,
    platform: 'MT5',
    daysAgo: 8,
  }),
  // The Funded Trader
  createAccount({
    name: 'TFT Royal 200K',
    propFirm: PROP_FIRMS.THE_FUNDED_TRADER.name,
    accountSize: 200000,
    phase: 'funded',
    pnl: 12000,
    profitTarget: PROP_FIRMS.THE_FUNDED_TRADER.profitTarget,
    maxLoss: PROP_FIRMS.THE_FUNDED_TRADER.maxLoss,
    maxDailyLoss: PROP_FIRMS.THE_FUNDED_TRADER.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 75,
  }),
  // MyFundedFX
  createAccount({
    name: 'MFFX 100K',
    propFirm: PROP_FIRMS.MY_FUNDED_FX.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: 2800,
    profitTarget: PROP_FIRMS.MY_FUNDED_FX.profitTarget,
    maxLoss: PROP_FIRMS.MY_FUNDED_FX.maxLoss,
    maxDailyLoss: PROP_FIRMS.MY_FUNDED_FX.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 40,
  }),
  // Alpha Capital
  createAccount({
    name: 'Alpha Capital 50K',
    propFirm: PROP_FIRMS.ALPHA_CAPITAL.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: 850,
    profitTarget: PROP_FIRMS.ALPHA_CAPITAL.profitTarget,
    maxLoss: PROP_FIRMS.ALPHA_CAPITAL.maxLoss,
    maxDailyLoss: PROP_FIRMS.ALPHA_CAPITAL.maxDailyLoss,
    evaluationPhase: 1,
    platform: 'cTrader',
    daysAgo: 5,
  }),
  // Hedge accounts
  createAccount({
    name: 'Pepperstone Live',
    propFirm: 'Pepperstone',
    accountSize: 25000,
    phase: 'live',
    pnl: 1875,
    platform: 'MT5',
    server: 'Pepperstone-MT5-Live01',
    login: '87654321',
    daysAgo: 120,
  }),
  createAccount({
    name: 'IC Markets Hedge',
    propFirm: 'IC Markets',
    accountSize: 15000,
    phase: 'live',
    pnl: 425,
    platform: 'MT5',
    server: 'ICMarkets-Live05',
    login: '12345679',
    daysAgo: 90,
  }),
];

/**
 * Funded Success - Multiple winning funded accounts
 */
const fundedSuccessAccounts: TradingAccount[] = [
  createAccount({
    name: 'FTMO 200K Winner',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 200000,
    phase: 'funded',
    pnl: 15600,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 90,
  }),
  createAccount({
    name: 'Funded Next 100K Star',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: 8200,
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 60,
  }),
  createAccount({
    name: 'TFT 100K Consistent',
    propFirm: PROP_FIRMS.THE_FUNDED_TRADER.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: 6500,
    profitTarget: PROP_FIRMS.THE_FUNDED_TRADER.profitTarget,
    maxLoss: PROP_FIRMS.THE_FUNDED_TRADER.maxLoss,
    maxDailyLoss: PROP_FIRMS.THE_FUNDED_TRADER.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 45,
  }),
];

/**
 * Struggling - Accounts with losses for testing negative states
 */
const strugglingAccounts: TradingAccount[] = [
  createAccount({
    name: 'FTMO Challenge Losing',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: -3500, // -7% (approaching max loss)
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    evaluationPhase: 1,
    tradingDaysCompleted: 8,
    evaluationFee: 299,
    platform: 'MT5',
    daysAgo: 25,
  }),
  createAccount({
    name: 'Funded Under Pressure',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: -6200, // -6.2% (risky zone)
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 30,
  }),
  createAccount({
    name: 'Recovery Mode',
    propFirm: PROP_FIRMS.MY_FUNDED_FX.name,
    accountSize: 25000,
    phase: 'evaluation',
    pnl: -1200, // -4.8%
    profitTarget: PROP_FIRMS.MY_FUNDED_FX.profitTarget,
    maxLoss: PROP_FIRMS.MY_FUNDED_FX.maxLoss,
    maxDailyLoss: PROP_FIRMS.MY_FUNDED_FX.maxDailyLoss,
    evaluationPhase: 1,
    evaluationFee: 175,
    platform: 'MT5',
    daysAgo: 15,
  }),
];

/**
 * Mixed Portfolio - Comprehensive variety for thorough UI testing
 */
const mixedPortfolioAccounts: TradingAccount[] = [
  // Winning funded
  createAccount({
    name: 'FTMO Funded 100K',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 100000,
    phase: 'funded',
    pnl: 5200,
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 60,
  }),
  // Losing funded (careful zone)
  createAccount({
    name: 'Funded Next 50K',
    propFirm: PROP_FIRMS.FUNDED_NEXT.name,
    accountSize: 50000,
    phase: 'funded',
    pnl: -2100,
    profitTarget: PROP_FIRMS.FUNDED_NEXT.profitTarget,
    maxLoss: PROP_FIRMS.FUNDED_NEXT.maxLoss,
    maxDailyLoss: PROP_FIRMS.FUNDED_NEXT.maxDailyLoss,
    platform: 'MT5',
    daysAgo: 25,
  }),
  // Eval Phase 1 - good progress
  createAccount({
    name: 'FTMO Challenge 50K',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: 3200, // 6.4% (almost at target)
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    evaluationPhase: 1,
    tradingDaysCompleted: 5,
    evaluationFee: 299,
    platform: 'MT5',
    daysAgo: 18,
  }),
  // Eval Phase 2 - verification
  createAccount({
    name: 'TFT Verification 100K',
    propFirm: PROP_FIRMS.THE_FUNDED_TRADER.name,
    accountSize: 100000,
    phase: 'evaluation',
    pnl: 2800,
    profitTarget: 5, // Phase 2
    maxLoss: PROP_FIRMS.THE_FUNDED_TRADER.maxLoss,
    maxDailyLoss: PROP_FIRMS.THE_FUNDED_TRADER.maxDailyLoss,
    evaluationPhase: 2,
    tradingDaysCompleted: 2,
    platform: 'MT5',
    daysAgo: 8,
  }),
  // Fresh evaluation
  createAccount({
    name: 'Alpha Capital 25K',
    propFirm: PROP_FIRMS.ALPHA_CAPITAL.name,
    accountSize: 25000,
    phase: 'evaluation',
    pnl: 125,
    profitTarget: PROP_FIRMS.ALPHA_CAPITAL.profitTarget,
    maxLoss: PROP_FIRMS.ALPHA_CAPITAL.maxLoss,
    maxDailyLoss: PROP_FIRMS.ALPHA_CAPITAL.maxDailyLoss,
    evaluationPhase: 1,
    tradingDaysCompleted: 1,
    evaluationFee: 199,
    platform: 'cTrader',
    daysAgo: 3,
  }),
  // Hedge/Live account
  createAccount({
    name: 'IC Markets Personal',
    propFirm: 'IC Markets',
    accountSize: 10000,
    phase: 'live',
    pnl: 780,
    platform: 'MT5',
    server: 'ICMarkets-Live05',
    login: '99887766',
    daysAgo: 180,
  }),
  // Archived account (for progression testing)
  createAccount({
    name: 'FTMO Challenge 50K (Passed)',
    propFirm: PROP_FIRMS.FTMO.name,
    accountSize: 50000,
    phase: 'evaluation',
    pnl: 5100, // Passed!
    profitTarget: PROP_FIRMS.FTMO.profitTarget,
    maxLoss: PROP_FIRMS.FTMO.maxLoss,
    maxDailyLoss: PROP_FIRMS.FTMO.maxDailyLoss,
    evaluationPhase: 1,
    tradingDaysCompleted: 6,
    evaluationFee: 299,
    isArchived: true,
    platform: 'MT5',
    daysAgo: 90,
  }),
];

// ============================================================================
// Preset Map
// ============================================================================

export const mockTradingAccountPresets: Record<MockPresetType, TradingAccount[]> = {
  new_user: newUserAccounts,
  beginner: beginnerAccounts,
  active_trader: activeTraderAccounts,
  power_user: powerUserAccounts,
  funded_success: fundedSuccessAccounts,
  struggling: strugglingAccounts,
  mixed_portfolio: mixedPortfolioAccounts,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load a mock preset into localStorage (for demo mode)
 */
export function loadMockTradingAccounts(preset: MockPresetType): TradingAccount[] {
  const accounts = mockTradingAccountPresets[preset];
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  console.log(`[Mock] Loaded ${accounts.length} trading accounts (preset: ${preset})`);
  return accounts;
}

/**
 * Clear all mock trading accounts
 */
export function clearMockTradingAccounts(): void {
  localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
  console.log('[Mock] Cleared all trading accounts');
}

/**
 * Get currently loaded mock accounts
 */
export function getCurrentMockAccounts(): TradingAccount[] {
  try {
    const stored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a single mock account to existing ones
 */
export function addMockAccount(account: Partial<TradingAccount> & { 
  account_name: string;
  account_size: number;
  phase: 'evaluation' | 'funded' | 'live';
}): TradingAccount {
  const newAccount = createAccount({
    name: account.account_name,
    propFirm: account.prop_firm || 'Unknown',
    accountSize: account.account_size,
    phase: account.phase,
    pnl: account.pnl || 0,
    platform: account.platform || 'MT5',
    profitTarget: account.profit_target ?? undefined,
    maxLoss: account.max_loss ?? undefined,
    maxDailyLoss: account.max_daily_loss ?? undefined,
    minTradingDays: account.min_trading_days ?? undefined,
    evaluationPhase: account.evaluation_phase ?? undefined,
    evaluationFee: account.evaluation_fee ?? undefined,
  });
  
  const current = getCurrentMockAccounts();
  const updated = [newAccount, ...current];
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(updated));
  
  return newAccount;
}

/**
 * Get preset summary for debugging
 */
export function getPresetSummary(preset: MockPresetType): {
  totalAccounts: number;
  totalValue: number;
  totalPnL: number;
  avgReturn: number;
  byPhase: Record<string, number>;
  byFirm: Record<string, number>;
} {
  const accounts = mockTradingAccountPresets[preset];
  const activeAccounts = accounts.filter(a => !a.is_archived);
  
  const totalValue = activeAccounts.reduce((sum, a) => sum + a.account_size, 0);
  const totalPnL = activeAccounts.reduce((sum, a) => sum + a.pnl, 0);
  
  return {
    totalAccounts: accounts.length,
    totalValue,
    totalPnL,
    avgReturn: totalValue > 0 ? (totalPnL / totalValue) * 100 : 0,
    byPhase: activeAccounts.reduce((acc, a) => {
      acc[a.phase] = (acc[a.phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byFirm: activeAccounts.reduce((acc, a) => {
      const firm = a.prop_firm || 'Unknown';
      acc[firm] = (acc[firm] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  presets: mockTradingAccountPresets,
  load: loadMockTradingAccounts,
  clear: clearMockTradingAccounts,
  getCurrent: getCurrentMockAccounts,
  add: addMockAccount,
  getSummary: getPresetSummary,
};
