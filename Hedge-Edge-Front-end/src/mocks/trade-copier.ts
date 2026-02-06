/**
 * Trade Copier Utilities for Front-End
 * =====================================
 * Utility functions for working with trade copier data.
 * Mock data injection is handled by DOE/tmp/developer/inject_trade_copiers.js
 */

import type { TradingAccount } from '@/hooks/useTradingAccounts';

// ============================================================================
// Types
// ============================================================================

export type CopierLogic = 'mirror' | 'partial' | 'inverse';
export type CopierStatus = 'active' | 'paused' | 'error' | 'pending';

/**
 * Trade Copier Configuration
 * Represents a trade copying relationship from source (master) to target (follower)
 */
export interface TradeCopierConfig {
  id: string;
  /** Source account (master) - the account being copied FROM */
  sourceAccountId: string;
  sourceAccountName: string;
  sourcePlatform: string;
  sourcePhase: 'evaluation' | 'funded' | 'live';
  /** Target account (follower) - the account copying TO */
  targetAccountId: string;
  targetAccountName: string;
  targetPlatform: string;
  targetPhase: 'evaluation' | 'funded' | 'live';
  /** Copying logic */
  logic: CopierLogic;
  /** Lot multiplier percentage (100 = 1:1, 50 = 0.5x, 200 = 2x) */
  lotMultiplier: number;
  /** Maximum position size limit (lots) */
  maxPositionSize: number;
  /** Maximum total exposure (lots) */
  maxExposure: number;
  /** Symbol mappings for cross-broker compatibility */
  symbolMappings: Record<string, string>;
  /** Whether the copier is currently active */
  status: CopierStatus;
  /** Creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivity: string | null;
  /** Statistics */
  stats: CopierStats;
}

export interface CopierStats {
  /** Total trades copied today */
  tradesToday: number;
  /** Total trades copied all time */
  tradesTotal: number;
  /** Total profit/loss from copied trades */
  totalProfit: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Success rate percentage */
  successRate: number;
  /** Failed copies count */
  failedCopies: number;
}

export interface CopierActivity {
  id: string;
  copierId: string;
  timestamp: string;
  type: 'open' | 'close' | 'modify' | 'error';
  sourceTicket: number;
  targetTicket?: number;
  symbol: string;
  action: 'buy' | 'sell';
  volume: number;
  price: number;
  latency: number; // ms
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

// ============================================================================
// Local Storage Keys
// ============================================================================

const COPIERS_KEY = 'hedge_edge_trade_copiers';
const COPIER_ACTIVITY_KEY = 'hedge_edge_copier_activity';

// ============================================================================
// Storage Functions
// ============================================================================

export const getStoredCopiers = (): TradeCopierConfig[] => {
  try {
    const stored = localStorage.getItem(COPIERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveCopiers = (copiers: TradeCopierConfig[]) => {
  localStorage.setItem(COPIERS_KEY, JSON.stringify(copiers));
};

export const getStoredActivity = (): CopierActivity[] => {
  try {
    const stored = localStorage.getItem(COPIER_ACTIVITY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveActivity = (activity: CopierActivity[]) => {
  localStorage.setItem(COPIER_ACTIVITY_KEY, JSON.stringify(activity));
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a trade copier config from a hedge relationship
 * For reverse copying: prop account (evaluation/funded) → hedge account (live)
 */
export const createCopierFromRelationship = (
  relationshipId: string,
  sourceAccount: TradingAccount,
  targetAccount: TradingAccount,
  logic: CopierLogic = 'inverse',
  lotMultiplier: number = 100
): TradeCopierConfig => {
  const now = new Date().toISOString();
  
  return {
    id: `copier-${relationshipId}`,
    sourceAccountId: sourceAccount.id,
    sourceAccountName: sourceAccount.account_name,
    sourcePlatform: sourceAccount.platform || 'MT5',
    sourcePhase: sourceAccount.phase,
    targetAccountId: targetAccount.id,
    targetAccountName: targetAccount.account_name,
    targetPlatform: targetAccount.platform || 'MT5',
    targetPhase: targetAccount.phase,
    logic,
    lotMultiplier,
    maxPositionSize: 10.0,
    maxExposure: 50.0,
    symbolMappings: {},
    status: 'active',
    createdAt: now,
    lastActivity: null,
    stats: {
      tradesToday: 0,
      tradesTotal: 0,
      totalProfit: 0,
      avgLatency: 0,
      successRate: 100,
      failedCopies: 0,
    },
  };
};

/**
 * Sync trade copiers with hedge map relationships
 * This function creates/updates copiers based on current relationships
 */
export const syncCopiersWithRelationships = (
  relationships: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    logic: 'mirror' | 'partial' | 'inverse';
    offsetPercentage: number;
    isActive: boolean;
  }>,
  accounts: TradingAccount[]
): TradeCopierConfig[] => {
  const existingCopiers = getStoredCopiers();
  const newCopiers: TradeCopierConfig[] = [];
  
  for (const rel of relationships) {
    if (!rel.isActive) continue;
    
    const sourceAccount = accounts.find(a => a.id === rel.sourceId);
    const targetAccount = accounts.find(a => a.id === rel.targetId);
    
    if (!sourceAccount || !targetAccount) continue;
    
    // For reverse trade copying, the prop account (eval/funded) is the master
    // and the hedge account (live) is the follower
    let master = sourceAccount;
    let follower = targetAccount;
    
    // Determine which is the prop account and which is the hedge account
    const isPropSource = sourceAccount.phase === 'evaluation' || sourceAccount.phase === 'funded';
    const isHedgeTarget = targetAccount.phase === 'live';
    
    if (isPropSource && isHedgeTarget) {
      master = sourceAccount;
      follower = targetAccount;
    } else if (targetAccount.phase !== 'live' && sourceAccount.phase === 'live') {
      master = targetAccount;
      follower = sourceAccount;
    }
    
    // Check if copier already exists
    const existingCopier = existingCopiers.find(c => 
      c.id === `copier-${rel.id}` ||
      (c.sourceAccountId === master.id && c.targetAccountId === follower.id)
    );
    
    if (existingCopier) {
      // Update existing copier with current account names and settings
      newCopiers.push({
        ...existingCopier,
        sourceAccountName: master.account_name,
        targetAccountName: follower.account_name,
        logic: rel.logic,
        lotMultiplier: rel.offsetPercentage,
        status: rel.isActive ? existingCopier.status : 'paused',
      });
    } else {
      // Create new copier
      newCopiers.push(createCopierFromRelationship(
        rel.id,
        master,
        follower,
        rel.logic,
        rel.offsetPercentage
      ));
    }
  }
  
  saveCopiers(newCopiers);
  return newCopiers;
};

/**
 * Get copiers aggregated stats
 */
export const getCopiersSummary = (copiers: TradeCopierConfig[]) => {
  const activeCopiers = copiers.filter(c => c.status === 'active');
  const totalTradesToday = copiers.reduce((sum, c) => sum + c.stats.tradesToday, 0);
  const avgLatency = activeCopiers.length > 0
    ? activeCopiers.reduce((sum, c) => sum + c.stats.avgLatency, 0) / activeCopiers.length
    : 0;
  
  return {
    activeCopiers: activeCopiers.length,
    totalCopiers: copiers.length,
    tradesToday: totalTradesToday,
    avgLatency: Math.round(avgLatency),
    totalProfit: copiers.reduce((sum, c) => sum + c.stats.totalProfit, 0),
  };
};

/**
 * Populate copiers with demo statistics (for UI testing)
 * Note: For full mock data injection, use DOE/tmp/developer/inject_trade_copiers.js
 */
export const populateMockCopierStats = (copiers: TradeCopierConfig[]): TradeCopierConfig[] => {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return copiers.map(copier => ({
    ...copier,
    lastActivity: copier.lastActivity || new Date(Date.now() - Math.floor(Math.random() * ONE_HOUR_MS)).toISOString(),
    stats: copier.stats.tradesTotal > 0 ? copier.stats : {
      tradesToday: Math.floor(Math.random() * 15),
      tradesTotal: Math.floor(Math.random() * 500) + 50,
      totalProfit: Math.round((Math.random() * 2000 - 500) * 100) / 100,
      avgLatency: Math.floor(Math.random() * 30) + 15,
      successRate: Math.round((95 + Math.random() * 5) * 10) / 10,
      failedCopies: Math.floor(Math.random() * 5),
    },
  }));
};
