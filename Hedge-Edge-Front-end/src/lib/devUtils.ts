/**
 * Dev Utils - Demo Account Population
 * 
 * Provides functions to populate demo accounts for testing.
 * These functions are exposed on window.__devUtils in development mode.
 * 
 * Usage in DevTools Console:
 *   __devUtils.populateAccounts()           // Default 3 accounts
 *   __devUtils.populateAccounts('power')    // 7+ accounts
 *   __devUtils.populateAccounts('hedge')    // Hedge pair with relationship
 *   __devUtils.clearAccounts()              // Clear all demo data
 *   __devUtils.listAccounts()               // List current accounts
 */

import type { TradingAccount } from '@/hooks/useTradingAccounts';

// localStorage keys
const LOCAL_ACCOUNTS_KEY = 'hedge_edge_demo_accounts';
const HEDGE_MAP_ACCOUNTS_KEY = 'hedge_edge_map_accounts';
const RELATIONSHIPS_KEY = 'hedge_edge_relationships';
const NODE_POSITIONS_KEY = 'hedge_edge_node_positions';

// Hedge relationship interface
interface HedgeRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  offsetPercentage: number;
  logic: 'mirror' | 'partial' | 'inverse';
  isActive: boolean;
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Generate ISO date string
function nowIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// ============================================================================
// Account Presets
// ============================================================================

function getDefaultAccounts(): TradingAccount[] {
  return [
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'FTMO Challenge Phase 1',
      prop_firm: 'FTMO',
      account_size: 100000,
      current_balance: 102500,
      phase: 'evaluation',
      platform: 'MT5',
      server: 'FTMO-Demo',
      login: '12345678',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 4,
      trading_days_completed: 8,
      pnl: 2500,
      pnl_percent: 2.5,
      is_active: true,
      is_archived: false,
      evaluation_fee: 540,
      evaluation_phase: 1,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(15),
      updated_at: nowIso(),
    },
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'Funded Next $50K',
      prop_firm: 'Funded Next',
      account_size: 50000,
      current_balance: 53200,
      phase: 'funded',
      platform: 'MT5',
      server: 'FundedNext-Live',
      login: '87654321',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 22,
      pnl: 3200,
      pnl_percent: 6.4,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(45),
      updated_at: nowIso(),
    },
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'Hedge Account - IC Markets',
      prop_firm: null,
      account_size: 10000,
      current_balance: 9850,
      phase: 'live',
      platform: 'MT5',
      server: 'ICMarkets-Live',
      login: '11223344',
      metaapi_account_id: null,
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl: -150,
      pnl_percent: -1.5,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(60),
      updated_at: nowIso(),
    },
  ];
}

function getPowerUserAccounts(): TradingAccount[] {
  const accounts = getDefaultAccounts();
  
  accounts.push(
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'TFT $200K Funded',
      prop_firm: 'The Funded Trader',
      account_size: 200000,
      current_balance: 215000,
      phase: 'funded',
      platform: 'MT5',
      server: 'TFT-Live',
      login: '99887766',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 8,
      max_daily_loss: 4,
      min_trading_days: 0,
      trading_days_completed: 35,
      pnl: 15000,
      pnl_percent: 7.5,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(90),
      updated_at: nowIso(),
    },
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'FTMO Phase 2',
      prop_firm: 'FTMO',
      account_size: 100000,
      current_balance: 104000,
      phase: 'evaluation',
      platform: 'MT5',
      server: 'FTMO-Demo2',
      login: '55566677',
      metaapi_account_id: null,
      profit_target: 5,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 4,
      trading_days_completed: 6,
      pnl: 4000,
      pnl_percent: 4.0,
      is_active: true,
      is_archived: false,
      evaluation_fee: 540,
      evaluation_phase: 2,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(10),
      updated_at: nowIso(),
    },
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'Hedge - Pepperstone',
      prop_firm: null,
      account_size: 25000,
      current_balance: 24200,
      phase: 'live',
      platform: 'cTrader',
      server: 'Pepperstone-cTrader',
      login: 'CT123456',
      metaapi_account_id: null,
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl: -800,
      pnl_percent: -3.2,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(30),
      updated_at: nowIso(),
    },
    {
      id: generateId(),
      user_id: 'demo',
      account_name: 'MFF $100K',
      prop_firm: 'My Forex Funds',
      account_size: 100000,
      current_balance: 98500,
      phase: 'funded',
      platform: 'MT5',
      server: 'MFF-Live',
      login: 'MFF99999',
      metaapi_account_id: null,
      profit_target: 12,
      max_loss: 12,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 18,
      pnl: -1500,
      pnl_percent: -1.5,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(25),
      updated_at: nowIso(),
    }
  );
  
  return accounts;
}

function getHedgePairAccounts(): { accounts: TradingAccount[]; relationships: HedgeRelationship[] } {
  const propId = generateId();
  const hedgeId = generateId();
  
  const accounts: TradingAccount[] = [
    {
      id: propId,
      user_id: 'demo',
      account_name: 'FTMO $100K Funded',
      prop_firm: 'FTMO',
      account_size: 100000,
      current_balance: 105000,
      phase: 'funded',
      platform: 'MT5',
      server: 'FTMO-Live',
      login: 'FTMO001',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 30,
      pnl: 5000,
      pnl_percent: 5.0,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(60),
      updated_at: nowIso(),
    },
    {
      id: hedgeId,
      user_id: 'demo',
      account_name: 'Hedge - Personal Broker',
      prop_firm: null,
      account_size: 15000,
      current_balance: 10200,
      phase: 'live',
      platform: 'MT5',
      server: 'PersonalBroker-Live',
      login: 'HEDGE001',
      metaapi_account_id: null,
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl: -4800,
      pnl_percent: -32.0,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(60),
      updated_at: nowIso(),
    },
  ];
  
  const relationships: HedgeRelationship[] = [
    {
      id: generateId(),
      sourceId: propId,
      targetId: hedgeId,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
  ];
  
  return { accounts, relationships };
}

function getManyAccountsWithRelationships(): { accounts: TradingAccount[]; relationships: HedgeRelationship[] } {
  // Use actual prop firms from the app's PROP_FIRMS list
  const VALID_PROP_FIRMS = [
    'FTMO', 'FundedNext', 'Funding Pips', 'The5ers', 'Alpha Capital',
    'Blueberry Funded', 'E8 Markets', 'Goat Funded Trader', 'Blue Guardian',
    'BrightFunded', 'AquaFunded', 'Funded Trading Plus', 'FXIFY'
  ];
  
  // Brokers for hedge accounts (live phase)
  const BROKERS = ['IC Markets', 'Pepperstone', 'OANDA', 'XM', 'FxPro'];
  
  // Pre-generate IDs so we can create relationships
  const accountIds = {
    // Funded accounts (6)
    ftmo200k: generateId(),
    fundedNext100k: generateId(),
    fundingPips50k: generateId(),
    the5ers100k: generateId(),
    e8Markets200k: generateId(),
    goatFunded100k: generateId(),
    // Evaluation accounts (4)
    ftmo100kEval: generateId(),
    alphaCapital50kEval: generateId(),
    blueGuardian25kEval: generateId(),
    brightFunded50kEval: generateId(),
    // Hedge/Live accounts (3)
    icMarketsHedge: generateId(),
    pepperstoneHedge: generateId(),
    oandaHedge: generateId(),
  };

  const accounts: TradingAccount[] = [
    // ========== FUNDED ACCOUNTS (6) ==========
    {
      id: accountIds.ftmo200k,
      user_id: 'demo',
      account_name: 'FTMO $200K Funded',
      prop_firm: 'FTMO',
      account_size: 200000,
      current_balance: 212500,
      phase: 'funded',
      platform: 'MT5',
      server: 'FTMO-Live01',
      login: 'FTMO200K',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 45,
      pnl: 12500,
      pnl_percent: 6.25,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(90),
      updated_at: nowIso(),
    },
    {
      id: accountIds.fundedNext100k,
      user_id: 'demo',
      account_name: 'FundedNext $100K',
      prop_firm: 'FundedNext',
      account_size: 100000,
      current_balance: 107200,
      phase: 'funded',
      platform: 'MT5',
      server: 'FundedNext-Live',
      login: 'FN100K',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 28,
      pnl: 7200,
      pnl_percent: 7.2,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(55),
      updated_at: nowIso(),
    },
    {
      id: accountIds.fundingPips50k,
      user_id: 'demo',
      account_name: 'Funding Pips $50K',
      prop_firm: 'Funding Pips',
      account_size: 50000,
      current_balance: 52100,
      phase: 'funded',
      platform: 'MT5',
      server: 'FundingPips-Live',
      login: 'FP50K',
      metaapi_account_id: null,
      profit_target: 8,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 22,
      pnl: 2100,
      pnl_percent: 4.2,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(40),
      updated_at: nowIso(),
    },
    {
      id: accountIds.the5ers100k,
      user_id: 'demo',
      account_name: 'The5ers $100K',
      prop_firm: 'The5ers',
      account_size: 100000,
      current_balance: 103500,
      phase: 'funded',
      platform: 'MT5',
      server: 'The5ers-Live',
      login: 'T5100K',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 6,
      max_daily_loss: 4,
      min_trading_days: 0,
      trading_days_completed: 35,
      pnl: 3500,
      pnl_percent: 3.5,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(65),
      updated_at: nowIso(),
    },
    {
      id: accountIds.e8Markets200k,
      user_id: 'demo',
      account_name: 'E8 Markets $200K',
      prop_firm: 'E8 Markets',
      account_size: 200000,
      current_balance: 218400,
      phase: 'funded',
      platform: 'MT5',
      server: 'E8-Live',
      login: 'E8200K',
      metaapi_account_id: null,
      profit_target: 8,
      max_loss: 8,
      max_daily_loss: 4,
      min_trading_days: 0,
      trading_days_completed: 42,
      pnl: 18400,
      pnl_percent: 9.2,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(75),
      updated_at: nowIso(),
    },
    {
      id: accountIds.goatFunded100k,
      user_id: 'demo',
      account_name: 'Goat Funded $100K',
      prop_firm: 'Goat Funded Trader',
      account_size: 100000,
      current_balance: 104800,
      phase: 'funded',
      platform: 'MT5',
      server: 'GoatFunded-Live',
      login: 'GF100K',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 0,
      trading_days_completed: 18,
      pnl: 4800,
      pnl_percent: 4.8,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(32),
      updated_at: nowIso(),
    },
    // ========== EVALUATION ACCOUNTS (4) ==========
    {
      id: accountIds.ftmo100kEval,
      user_id: 'demo',
      account_name: 'FTMO $100K Challenge',
      prop_firm: 'FTMO',
      account_size: 100000,
      current_balance: 106800,
      phase: 'evaluation',
      platform: 'MT5',
      server: 'FTMO-Demo',
      login: 'FTMO100E',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 4,
      trading_days_completed: 8,
      pnl: 6800,
      pnl_percent: 6.8,
      is_active: true,
      is_archived: false,
      evaluation_fee: 540,
      evaluation_phase: 1,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(12),
      updated_at: nowIso(),
    },
    {
      id: accountIds.alphaCapital50kEval,
      user_id: 'demo',
      account_name: 'Alpha Capital $50K',
      prop_firm: 'Alpha Capital',
      account_size: 50000,
      current_balance: 51200,
      phase: 'evaluation',
      platform: 'cTrader',
      server: 'Alpha-Demo',
      login: 'AC50E',
      metaapi_account_id: null,
      profit_target: 8,
      max_loss: 10,
      max_daily_loss: 5,
      min_trading_days: 4,
      trading_days_completed: 5,
      pnl: 1200,
      pnl_percent: 2.4,
      is_active: true,
      is_archived: false,
      evaluation_fee: 299,
      evaluation_phase: 1,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(8),
      updated_at: nowIso(),
    },
    {
      id: accountIds.blueGuardian25kEval,
      user_id: 'demo',
      account_name: 'Blue Guardian $25K',
      prop_firm: 'Blue Guardian',
      account_size: 25000,
      current_balance: 24200,
      phase: 'evaluation',
      platform: 'MT5',
      server: 'BlueGuardian-Demo',
      login: 'BG25E',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 10,
      max_daily_loss: 4,
      min_trading_days: 0,
      trading_days_completed: 5,
      pnl: -800,
      pnl_percent: -3.2,
      is_active: true,
      is_archived: false,
      evaluation_fee: 199,
      evaluation_phase: 1,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(14),
      updated_at: nowIso(),
    },
    {
      id: accountIds.brightFunded50kEval,
      user_id: 'demo',
      account_name: 'BrightFunded $50K',
      prop_firm: 'BrightFunded',
      account_size: 50000,
      current_balance: 47800,
      phase: 'evaluation',
      platform: 'MT5',
      server: 'BrightFunded-Demo',
      login: 'BF50E',
      metaapi_account_id: null,
      profit_target: 10,
      max_loss: 8,
      max_daily_loss: 4,
      min_trading_days: 0,
      trading_days_completed: 10,
      pnl: -2200,
      pnl_percent: -4.4,
      is_active: true,
      is_archived: false,
      evaluation_fee: 349,
      evaluation_phase: 1,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(18),
      updated_at: nowIso(),
    },
    // ========== HEDGE/LIVE ACCOUNTS (3) ==========
    {
      id: accountIds.icMarketsHedge,
      user_id: 'demo',
      account_name: 'IC Markets - Main Hedge',
      prop_firm: null,  // Brokers don't have prop_firm
      account_size: 25000,
      current_balance: 18500,
      phase: 'live',
      platform: 'MT5',
      server: 'ICMarkets-Live05',
      login: 'ICM25000',
      metaapi_account_id: null,
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl: -6500,
      pnl_percent: -26.0,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(120),
      updated_at: nowIso(),
    },
    {
      id: accountIds.pepperstoneHedge,
      user_id: 'demo',
      account_name: 'Pepperstone - Hedge #2',
      prop_firm: null,
      account_size: 15000,
      current_balance: 11200,
      phase: 'live',
      platform: 'cTrader',
      server: 'Pepperstone-cTrader',
      login: 'PP15000',
      metaapi_account_id: null,
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl: -3800,
      pnl_percent: -25.33,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(95),
      updated_at: nowIso(),
    },
    {
      id: accountIds.oandaHedge,
      user_id: 'demo',
      account_name: 'OANDA - Backup Hedge',
      prop_firm: null,
      account_size: 10000,
      current_balance: 7800,
      phase: 'live',
      platform: 'MT5',
      server: 'OANDA-Live',
      login: 'OAN10K',
      metaapi_account_id: null,
      profit_target: null,
      max_loss: null,
      max_daily_loss: null,
      min_trading_days: null,
      trading_days_completed: null,
      pnl: -2200,
      pnl_percent: -22.0,
      is_active: true,
      is_archived: false,
      evaluation_fee: null,
      evaluation_phase: null,
      previous_account_id: null,
      last_sync_at: nowIso(),
      created_at: daysAgoIso(60),
      updated_at: nowIso(),
    },
  ];

  // Create relationships - linking funded/eval accounts to hedge accounts
  // Hedge 1 (IC Markets): connected to 5 accounts (FTMO 200K, FundedNext 100K, The5ers 100K, FTMO Eval, Alpha Eval)
  // Hedge 2 (Pepperstone): connected to 3 accounts (Funding Pips 50K, E8 Markets 200K, Blue Guardian Eval)
  // Hedge 3 (OANDA): connected to 2 accounts (Goat Funded 100K, BrightFunded Eval)
  const relationships: HedgeRelationship[] = [
    // IC Markets Hedge connections (5 prop accounts)
    {
      id: generateId(),
      sourceId: accountIds.ftmo200k,
      targetId: accountIds.icMarketsHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.fundedNext100k,
      targetId: accountIds.icMarketsHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.the5ers100k,
      targetId: accountIds.icMarketsHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.ftmo100kEval,
      targetId: accountIds.icMarketsHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.alphaCapital50kEval,
      targetId: accountIds.icMarketsHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    // Pepperstone Hedge connections (3 prop accounts)
    {
      id: generateId(),
      sourceId: accountIds.fundingPips50k,
      targetId: accountIds.pepperstoneHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.e8Markets200k,
      targetId: accountIds.pepperstoneHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.blueGuardian25kEval,
      targetId: accountIds.pepperstoneHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    // OANDA Hedge connections (2 prop accounts)
    {
      id: generateId(),
      sourceId: accountIds.goatFunded100k,
      targetId: accountIds.oandaHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
    {
      id: generateId(),
      sourceId: accountIds.brightFunded50kEval,
      targetId: accountIds.oandaHedge,
      offsetPercentage: 100,
      logic: 'mirror',
      isActive: true,
    },
  ];

  return { accounts, relationships };
}

// ============================================================================
// Dev Utils API
// ============================================================================

export interface DevUtilsAPI {
  /** Populate demo accounts. Preset: 'default' | 'power' | 'hedge' */
  populateAccounts: (preset?: string, options?: { addToMap?: boolean; clearFirst?: boolean }) => void;
  /** Populate hedge map with accounts (shortcut - clears first, adds to map) */
  populateHedgeMap: (preset?: string) => void;
  /** Clear all demo account data */
  clearAccounts: () => void;
  /** List current accounts in console */
  listAccounts: () => void;
  /** Get current accounts as array */
  getAccounts: () => TradingAccount[];
  /** Trigger a page reload */
  reload: () => void;
}

function populateAccounts(preset: string = 'default', options: { addToMap?: boolean; clearFirst?: boolean } = {}): void {
  const { addToMap = false, clearFirst = false } = options;
  
  if (clearFirst) {
    localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
    localStorage.removeItem(HEDGE_MAP_ACCOUNTS_KEY);
    localStorage.removeItem(RELATIONSHIPS_KEY);
    localStorage.removeItem(NODE_POSITIONS_KEY);
    console.log('✓ Cleared existing demo data');
  }
  
  let accounts: TradingAccount[];
  let relationships: HedgeRelationship[] | null = null;
  
  switch (preset) {
    case 'power':
      accounts = getPowerUserAccounts();
      break;
    case 'hedge': {
      const hedgeData = getHedgePairAccounts();
      accounts = hedgeData.accounts;
      relationships = hedgeData.relationships;
      break;
    }
    case 'many': {
      const manyData = getManyAccountsWithRelationships();
      accounts = manyData.accounts;
      relationships = manyData.relationships;
      break;
    }
    case 'default':
    default:
      accounts = getDefaultAccounts();
  }
  
  // Merge with existing accounts
  const existing: TradingAccount[] = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]');
  const existingIds = new Set(existing.map(a => a.id));
  const newAccounts = accounts.filter(a => !existingIds.has(a.id));
  const merged = [...existing, ...newAccounts];
  
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(merged));
  console.log(`✓ Added ${newAccounts.length} new accounts (total: ${merged.length})`);
  
  if (addToMap || preset === 'hedge' || preset === 'many') {
    const mapIds: string[] = JSON.parse(localStorage.getItem(HEDGE_MAP_ACCOUNTS_KEY) || '[]');
    const newMapIds = accounts.map(a => a.id).filter(id => !mapIds.includes(id));
    const mergedMapIds = [...mapIds, ...newMapIds];
    localStorage.setItem(HEDGE_MAP_ACCOUNTS_KEY, JSON.stringify(mergedMapIds));
    console.log(`✓ Added ${newMapIds.length} accounts to hedge map`);
  }
  
  if (relationships) {
    const existingRels: HedgeRelationship[] = JSON.parse(localStorage.getItem(RELATIONSHIPS_KEY) || '[]');
    const existingRelIds = new Set(existingRels.map(r => r.id));
    const newRels = relationships.filter(r => !existingRelIds.has(r.id));
    const mergedRels = [...existingRels, ...newRels];
    localStorage.setItem(RELATIONSHIPS_KEY, JSON.stringify(mergedRels));
    console.log(`✓ Added ${newRels.length} hedge relationships`);
  }
  
  console.log('');
  console.log('🔄 Call __devUtils.reload() or press F5 to see changes');
}

function clearAccounts(): void {
  localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
  localStorage.removeItem(HEDGE_MAP_ACCOUNTS_KEY);
  localStorage.removeItem(RELATIONSHIPS_KEY);
  localStorage.removeItem(NODE_POSITIONS_KEY);
  console.log('✓ Cleared all demo account data');
  console.log('🔄 Call __devUtils.reload() or press F5 to see changes');
}

function listAccounts(): void {
  const accounts: TradingAccount[] = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]');
  const mapIds: string[] = JSON.parse(localStorage.getItem(HEDGE_MAP_ACCOUNTS_KEY) || '[]');
  const rels: HedgeRelationship[] = JSON.parse(localStorage.getItem(RELATIONSHIPS_KEY) || '[]');
  
  console.log('='.repeat(50));
  console.log(`DEMO ACCOUNTS (${accounts.length})`);
  console.log('='.repeat(50));
  
  accounts.forEach((a, i) => {
    const inMap = mapIds.includes(a.id) ? '📍' : '  ';
    console.log(`${inMap} ${i + 1}. ${a.account_name} (${a.phase})`);
    console.log(`      $${a.account_size.toLocaleString()} | P&L: ${a.pnl >= 0 ? '+' : ''}${a.pnl.toLocaleString()}`);
  });
  
  console.log('');
  console.log(`HEDGE MAP: ${mapIds.length} accounts`);
  console.log(`RELATIONSHIPS: ${rels.length}`);
}

function getAccounts(): TradingAccount[] {
  return JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]');
}

function reload(): void {
  window.location.reload();
}

function populateHedgeMap(preset: string = 'power'): void {
  console.log('🗺️ Populating Hedge Map...');
  populateAccounts(preset, { addToMap: true, clearFirst: true });
  console.log('');
  console.log('✅ Hedge Map populated! Call __devUtils.reload() or press F5');
}

// ============================================================================
// Initialize Dev Utils
// ============================================================================

export function initDevUtils(): void {
  if (import.meta.env.DEV) {
    const devUtils: DevUtilsAPI = {
      populateAccounts,
      populateHedgeMap,
      clearAccounts,
      listAccounts,
      getAccounts,
      reload,
    };
    
    // Expose on window
    (window as unknown as { __devUtils: DevUtilsAPI }).__devUtils = devUtils;
    
    // Only auto-populate if no accounts exist (first run)
    const existingAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    const hasAccounts = existingAccounts && JSON.parse(existingAccounts).length > 0;
    
    if (!hasAccounts) {
      console.log('🚀 First run detected - auto-populating demo accounts...');
      populateAccounts('many', { clearFirst: true });
      console.log('✅ Demo accounts loaded with hedge relationships!');
    }
    
    console.log('🛠️ Dev Utils loaded. Available commands:');
    console.log('   __devUtils.populateAccounts("many")  - Add 13 accounts + relationships');
    console.log('   __devUtils.populateHedgeMap()        - Populate hedge map');
    console.log('   __devUtils.clearAccounts()           - Clear all demo data');
    console.log('   __devUtils.listAccounts()            - List current accounts');
    console.log('   __devUtils.reload()                  - Reload page');
  }
}
