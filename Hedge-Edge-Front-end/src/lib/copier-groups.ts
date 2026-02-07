/**
 * Copier Group Utilities
 * Real production helpers for creating, storing, and computing copier groups.
 */

import type {
  CopierGroup,
  FollowerConfig,
  FollowerStats,
  GroupStats,
} from '@/types/copier';
import type { TradingAccount } from '@/hooks/useTradingAccounts';

// ─── Local Storage ──────────────────────────────────────────────────────────

const COPIER_GROUPS_KEY = 'hedge_edge_copier_groups';

export const getStoredCopierGroups = (): CopierGroup[] => {
  try {
    const stored = localStorage.getItem(COPIER_GROUPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveCopierGroups = (groups: CopierGroup[]) => {
  localStorage.setItem(COPIER_GROUPS_KEY, JSON.stringify(groups));
};

// ─── Default Follower Config ────────────────────────────────────────────────

export const createDefaultFollower = (
  account: TradingAccount,
): FollowerConfig => ({
  id: `follower-${account.id}`,
  accountId: account.id,
  accountName: account.account_name,
  platform: account.platform || 'MT5',
  phase: account.phase,
  status: 'active',
  volumeSizing: 'equity-to-equity',
  lotMultiplier: 1.0,
  riskMultiplier: 1.0,
  fixedLot: 0.01,
  fixedRiskPercent: 1.0,
  fixedRiskNominal: 50,
  copySL: true,
  copyTP: true,
  additionalSLPips: 0,
  additionalTPPips: 0,
  reverseMode: false,
  symbolWhitelist: [],
  symbolBlacklist: [],
  symbolSuffix: '',
  symbolAliases: [],
  protectionMode: 'off',
  minThreshold: 0,
  maxThreshold: 0,
  delayMs: 0,
  stats: emptyFollowerStats(),
});

const emptyFollowerStats = (): FollowerStats => ({
  tradesToday: 0,
  tradesTotal: 0,
  totalProfit: 0,
  avgLatency: 0,
  successRate: 100,
  failedCopies: 0,
  lastCopyTime: null,
});

// ─── Compute Group Stats ────────────────────────────────────────────────────

export const computeGroupStats = (followers: FollowerConfig[]): GroupStats => {
  const active = followers.filter(f => f.status === 'active');
  const tradesToday = followers.reduce((s, f) => s + f.stats.tradesToday, 0);
  const tradesTotal = followers.reduce((s, f) => s + f.stats.tradesTotal, 0);
  const totalProfit = followers.reduce((s, f) => s + f.stats.totalProfit, 0);
  const avgLatency =
    active.length > 0
      ? Math.round(active.reduce((s, f) => s + f.stats.avgLatency, 0) / active.length)
      : 0;

  return {
    tradesToday,
    tradesTotal,
    totalProfit: Math.round(totalProfit * 100) / 100,
    avgLatency,
    activeFollowers: active.length,
    totalFollowers: followers.length,
  };
};

// ─── Create a New Copier Group ──────────────────────────────────────────────

export const createCopierGroup = (
  name: string,
  leader: TradingAccount,
  followerAccounts: TradingAccount[],
): CopierGroup => {
  const now = new Date().toISOString();
  const followers = followerAccounts.map(createDefaultFollower);

  return {
    id: `group-${crypto.randomUUID()}`,
    name,
    status: 'active',
    leaderAccountId: leader.id,
    leaderAccountName: leader.account_name,
    leaderPlatform: leader.platform || 'MT5',
    leaderPhase: leader.phase,
    leaderSymbolSuffixRemove: '',
    followers,
    createdAt: now,
    updatedAt: now,
    stats: computeGroupStats(followers),
  };
};

// ─── Summary Across All Groups ──────────────────────────────────────────────

export const getGroupsSummary = (groups: CopierGroup[]) => {
  const activeGroups = groups.filter(g => g.status === 'active');
  const allFollowers = groups.flatMap(g => g.followers);
  const activeFollowers = allFollowers.filter(f => f.status === 'active');

  return {
    totalGroups: groups.length,
    activeGroups: activeGroups.length,
    totalFollowers: allFollowers.length,
    activeFollowers: activeFollowers.length,
    tradesToday: groups.reduce((s, g) => s + g.stats.tradesToday, 0),
    totalProfit: Math.round(groups.reduce((s, g) => s + g.stats.totalProfit, 0) * 100) / 100,
    avgLatency:
      activeGroups.length > 0
        ? Math.round(activeGroups.reduce((s, g) => s + g.stats.avgLatency, 0) / activeGroups.length)
        : 0,
  };
};
