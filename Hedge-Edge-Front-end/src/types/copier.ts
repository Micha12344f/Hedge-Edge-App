/**
 * Trade Copier Types
 * Based on Heron Copier configuration model
 * Master (Leader) → Follower(s) with per-follower risk settings
 */

// ─── Volume Sizing ──────────────────────────────────────────────────────────

export type VolumeSizingMode =
  | 'equity-to-equity'
  | 'lot-multiplier'
  | 'risk-multiplier'
  | 'fixed-lot'
  | 'fixed-risk-percent'
  | 'fixed-risk-nominal';

// ─── Account Protection ─────────────────────────────────────────────────────

export type AccountProtectionMode = 'off' | 'balance-based' | 'equity-based';

// ─── Copier Group Status ────────────────────────────────────────────────────

export type CopierGroupStatus = 'active' | 'paused' | 'error';
export type FollowerStatus = 'active' | 'paused' | 'error' | 'pending';

// ─── Symbol Mapping Entry ───────────────────────────────────────────────────

export interface SymbolMapping {
  masterSymbol: string;
  slaveSymbol: string;
  /** Optional per-symbol lot multiplier override */
  lotMultiplier?: number;
}

// ─── Follower Config ────────────────────────────────────────────────────────

export interface FollowerConfig {
  id: string;
  accountId: string;
  accountName: string;
  platform: string;
  phase: 'evaluation' | 'funded' | 'live';
  status: FollowerStatus;

  // Volume sizing
  volumeSizing: VolumeSizingMode;
  lotMultiplier: number;       // used when volumeSizing = 'lot-multiplier'
  riskMultiplier: number;      // used when volumeSizing = 'risk-multiplier'
  fixedLot: number;            // used when volumeSizing = 'fixed-lot'
  fixedRiskPercent: number;    // used when volumeSizing = 'fixed-risk-percent'
  fixedRiskNominal: number;    // used when volumeSizing = 'fixed-risk-nominal'

  // TP / SL
  copySL: boolean;
  copyTP: boolean;
  additionalSLPips: number;
  additionalTPPips: number;

  // Reverse mode (for hedging)
  reverseMode: boolean;

  // Symbol filtering
  symbolWhitelist: string[];   // only these symbols copied
  symbolBlacklist: string[];   // these symbols skipped
  symbolSuffix: string;        // append suffix to all symbols
  symbolAliases: SymbolMapping[];

  // Account protection
  protectionMode: AccountProtectionMode;
  minThreshold: number;        // close all & stop if below
  maxThreshold: number;        // close all & stop if above

  // Delay
  delayMs: number;

  // Stats (runtime)
  stats: FollowerStats;
}

export interface FollowerStats {
  tradesToday: number;
  tradesTotal: number;
  totalProfit: number;
  avgLatency: number;
  successRate: number;
  failedCopies: number;
  lastCopyTime: string | null;
}

// ─── Copier Group (1 Leader → N Followers) ──────────────────────────────────

export interface CopierGroup {
  id: string;
  name: string;
  status: CopierGroupStatus;

  // Leader account
  leaderAccountId: string;
  leaderAccountName: string;
  leaderPlatform: string;
  leaderPhase: 'evaluation' | 'funded' | 'live';
  /** Symbol suffix to remove from leader symbols before sending */
  leaderSymbolSuffixRemove: string;

  // Followers
  followers: FollowerConfig[];

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Aggregated stats (computed)
  stats: GroupStats;
  /** Total failed copies across all followers **/
  totalFailedCopies?: number;
}

export interface GroupStats {
  tradesToday: number;
  tradesTotal: number;
  totalProfit: number;
  avgLatency: number;
  activeFollowers: number;
  totalFollowers: number;
}

// ─── Activity Log ───────────────────────────────────────────────────────────

export interface CopierActivityEntry {
  id: string;
  groupId: string;
  followerId: string;
  timestamp: string;
  type: 'open' | 'close' | 'modify' | 'error' | 'protection-triggered';
  symbol: string;
  action: 'buy' | 'sell';
  volume: number;
  price: number;
  latency: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}
