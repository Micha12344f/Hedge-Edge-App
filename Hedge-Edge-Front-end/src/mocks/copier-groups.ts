/**
 * Mock data for Trade Copier Groups
 * Provides realistic demo data for the copier UI
 */

import type {
  CopierGroup,
  FollowerConfig,
  FollowerStats,
  GroupStats,
  CopierGroupStatus,
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

// ─── Populate Mock Stats for Demo ───────────────────────────────────────────

export const populateMockGroupStats = (groups: CopierGroup[]): CopierGroup[] => {
  return groups.map(group => ({
    ...group,
    followers: group.followers.map(f => ({
      ...f,
      stats:
        f.stats.tradesTotal > 0
          ? f.stats
          : {
              tradesToday: Math.floor(Math.random() * 12) + 1,
              tradesTotal: Math.floor(Math.random() * 400) + 30,
              totalProfit: Math.round((Math.random() * 1500 - 300) * 100) / 100,
              avgLatency: Math.floor(Math.random() * 25) + 12,
              successRate: Math.round((96 + Math.random() * 4) * 10) / 10,
              failedCopies: Math.floor(Math.random() * 4),
              lastCopyTime: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
            },
    })),
    stats: undefined as unknown as GroupStats, // will be recomputed
  })).map(g => ({ ...g, stats: computeGroupStats(g.followers) }));
};

// ─── Seed Demo Groups from Existing Accounts ───────────────────────────────

export const seedDemoGroups = (accounts: TradingAccount[]): CopierGroup[] => {
  const propAccounts = accounts.filter(
    a => (a.phase === 'evaluation' || a.phase === 'funded') && !a.is_archived,
  );
  const hedgeAccounts = accounts.filter(a => a.phase === 'live' && !a.is_archived);

  if (propAccounts.length === 0 || hedgeAccounts.length === 0) return [];

  const groups: CopierGroup[] = [];

  // Create one group per prop account, each copying to first available hedge
  propAccounts.forEach((prop, idx) => {
    const hedge = hedgeAccounts[idx % hedgeAccounts.length];
    const follower = createDefaultFollower(hedge);
    follower.reverseMode = true; // hedging

    const group: CopierGroup = {
      id: `group-demo-${idx}`,
      name: `${prop.account_name} → ${hedge.account_name}`,
      status: (idx === 0 ? 'active' : idx === 1 ? 'active' : 'paused') as CopierGroupStatus,
      leaderAccountId: prop.id,
      leaderAccountName: prop.account_name,
      leaderPlatform: prop.platform || 'MT5',
      leaderPhase: prop.phase,
      leaderSymbolSuffixRemove: '',
      followers: [follower],
      createdAt: new Date(Date.now() - 86400000 * (propAccounts.length - idx)).toISOString(),
      updatedAt: new Date().toISOString(),
      stats: computeGroupStats([follower]),
    };
    groups.push(group);
  });

  return populateMockGroupStats(groups);
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
