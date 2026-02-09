/**
 * Trade Copier Engine
 * 
 * Runs in the Electron main process. Listens for trade events on leader
 * accounts and replicates them to follower accounts via the ZMQ bridge.
 * 
 * Architecture:
 *   agentChannelReader (events) ──► CopierEngine ──► agentChannelReader.openPosition()
 *                                                  ──► agentChannelReader.modifyPosition()
 *                                                  ──► agentChannelReader.closePosition()
 * 
 * The engine reads copier group configuration from localStorage-compatible
 * JSON files and emits IPC events for the renderer to display live stats.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import type { AgentChannelReader } from './agent-channel-reader.js';

// ============================================================================
// Types (mirrors src/types/copier.ts for main process usage)
// ============================================================================

export type VolumeSizingMode =
  | 'equity-to-equity'
  | 'lot-multiplier'
  | 'risk-multiplier'
  | 'fixed-lot'
  | 'fixed-risk-percent'
  | 'fixed-risk-nominal';

export type AccountProtectionMode = 'off' | 'balance-based' | 'equity-based';

export interface FollowerConfig {
  id: string;
  accountId: string;
  accountName: string;
  platform: string;
  phase: 'evaluation' | 'funded' | 'live';
  status: 'active' | 'paused' | 'error' | 'pending';
  volumeSizing: VolumeSizingMode;
  lotMultiplier: number;
  riskMultiplier: number;
  fixedLot: number;
  fixedRiskPercent: number;
  fixedRiskNominal: number;
  copySL: boolean;
  copyTP: boolean;
  additionalSLPips: number;
  additionalTPPips: number;
  reverseMode: boolean;
  symbolWhitelist: string[];
  symbolBlacklist: string[];
  symbolSuffix: string;
  symbolAliases: Array<{ masterSymbol: string; slaveSymbol: string; lotMultiplier?: number }>;
  protectionMode: AccountProtectionMode;
  minThreshold: number;
  maxThreshold: number;
  delayMs: number;
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

export interface CopierGroup {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  leaderAccountId: string;
  leaderAccountName: string;
  leaderPlatform: string;
  leaderPhase: 'evaluation' | 'funded' | 'live';
  leaderSymbolSuffixRemove: string;
  followers: FollowerConfig[];
  createdAt: string;
  updatedAt: string;
  stats: GroupStats;
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

/** Maps leader ticket → follower ticket for each follower account */
interface PositionCorrelation {
  leaderTicket: string;
  followerTicket: string;
  followerId: string;
  followerAccountId: string;
  groupId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  openTime: string;
}

interface LeaderAccountMetrics {
  balance: number;
  equity: number;
  freeMargin: number;
}

interface FollowerAccountMetrics {
  balance: number;
  equity: number;
  freeMargin: number;
}

// ============================================================================
// Copier Engine
// ============================================================================

export class CopierEngine extends EventEmitter {
  private channelReader: AgentChannelReader;
  private groups: Map<string, CopierGroup> = new Map();
  private globalEnabled = false;
  
  // Position correlation: leaderTicket → follower correlations
  private correlations: Map<string, PositionCorrelation[]> = new Map();
  
  // Activity log (rolling buffer)
  private activityLog: CopierActivityEntry[] = [];
  private static readonly MAX_ACTIVITY_LOG = 500;
  
  // Per-follower mutex to prevent duplicate copies 
  private followerLocks: Map<string, boolean> = new Map();
  
  // Per-follower consecutive failure count for circuit breaker
  private followerFailures: Map<string, number> = new Map();
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  
  // Cached metrics per terminal
  private leaderMetrics: Map<string, LeaderAccountMetrics> = new Map();
  private followerMetrics: Map<string, FollowerAccountMetrics> = new Map();
  
  // Account UUID → terminal ID mapping (e.g. Supabase UUID → "mt5-12345")
  // This bridges the gap between frontend account IDs and ZMQ terminal IDs
  private accountMap: Map<string, string> = new Map();
  
  // File paths for persistence
  private correlationFilePath: string;
  private activityFilePath: string;
  
  // Event listener cleanup
  private boundHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
  
  constructor(channelReader: AgentChannelReader) {
    super();
    this.channelReader = channelReader;
    
    const userDataPath = app.getPath('userData');
    this.correlationFilePath = path.join(userDataPath, 'copier-correlations.json');
    this.activityFilePath = path.join(userDataPath, 'copier-activity.json');
  }
  
  // ========================================================================
  // Lifecycle
  // ========================================================================
  
  /**
   * Start the copier engine. Call after agentChannelReader is initialized.
   */
  async start(): Promise<void> {
    console.log('[CopierEngine] Starting...');
    
    // Load persisted correlations and activity
    await this.loadCorrelations();
    await this.loadActivity();
    
    // Subscribe to trade events from the channel reader
    this.subscribeToEvents();
    
    console.log('[CopierEngine] Started. Groups:', this.groups.size, 'Global:', this.globalEnabled);
  }
  
  /**
   * Stop the copier engine and persist state
   */
  async stop(): Promise<void> {
    console.log('[CopierEngine] Stopping...');
    
    // Unsubscribe from events
    for (const { event, handler } of this.boundHandlers) {
      this.channelReader.removeListener(event, handler);
    }
    this.boundHandlers = [];
    
    // Persist state
    await this.saveCorrelations();
    await this.saveActivity();
    
    console.log('[CopierEngine] Stopped');
  }
  
  // ========================================================================
  // Configuration
  // ========================================================================
  
  /**
   * Update copier groups configuration (called when renderer updates groups)
   */
  updateGroups(groups: CopierGroup[]): void {
    this.groups.clear();
    for (const group of groups) {
      this.groups.set(group.id, group);
    }
    console.log(`[CopierEngine] Groups updated: ${groups.length} groups`);
  }
  
  /**
   * Set global copier enabled state
   */
  setGlobalEnabled(enabled: boolean): void {
    this.globalEnabled = enabled;
    console.log(`[CopierEngine] Global enabled: ${enabled}`);
  }
  
  /**
   * Update account UUID → terminal ID mapping.
   * Called by the renderer which knows both the Supabase UUID (account.id)
   * and the MT5 login number (account.login).  The terminal IDs used by
   * agentChannelReader are formatted as "mt5-{login}".
   *
   * @param mapping - Record of { [supabaseUUID]: mt5Login }
   */
  updateAccountMap(mapping: Record<string, string>): void {
    this.accountMap.clear();
    for (const [uuid, login] of Object.entries(mapping)) {
      if (uuid && login) {
        // Store both the "mt5-{login}" terminal ID and the raw login
        this.accountMap.set(uuid, `mt5-${login}`);
      }
    }
    console.log(`[CopierEngine] Account map updated: ${this.accountMap.size} entries`, 
      Object.fromEntries(this.accountMap));
  }
  
  /**
   * Check if global copier is enabled
   */
  isGlobalEnabled(): boolean {
    return this.globalEnabled;
  }
  
  /**
   * Get activity log entries (most recent first, optionally limited)
   */
  getActivityLog(limit?: number): CopierActivityEntry[] {
    const entries = [...this.activityLog].reverse();
    return limit ? entries.slice(0, limit) : entries;
  }
  
  /**
   * Get all correlations (for debugging/UI)
   */
  getCorrelations(): PositionCorrelation[] {
    const all: PositionCorrelation[] = [];
    for (const corrs of this.correlations.values()) {
      all.push(...corrs);
    }
    return all;
  }
  
  /**
   * Get computed group stats
   */
  getGroupStats(groupId: string): GroupStats | null {
    const group = this.groups.get(groupId);
    if (!group) return null;
    return this.computeGroupStats(group);
  }
  
  // ========================================================================
  // Event Subscriptions
  // ========================================================================
  
  private subscribeToEvents(): void {
    // Position opened on any terminal
    const onPositionOpened = (terminalId: string, event: unknown) => {
      this.handleLeaderPositionOpened(terminalId, event);
    };
    this.channelReader.on('positionOpened', onPositionOpened);
    this.boundHandlers.push({ event: 'positionOpened', handler: onPositionOpened as (...args: unknown[]) => void });
    
    // Position closed on any terminal
    const onPositionClosed = (terminalId: string, event: unknown) => {
      this.handleLeaderPositionClosed(terminalId, event);
    };
    this.channelReader.on('positionClosed', onPositionClosed);
    this.boundHandlers.push({ event: 'positionClosed', handler: onPositionClosed as (...args: unknown[]) => void });
    
    // Position modified on any terminal
    const onPositionModified = (terminalId: string, event: unknown) => {
      this.handleLeaderPositionModified(terminalId, event);
    };
    this.channelReader.on('positionModified', onPositionModified);
    this.boundHandlers.push({ event: 'positionModified', handler: onPositionModified as (...args: unknown[]) => void });
    
    // Heartbeat - cache account metrics
    const onHeartbeat = (terminalId: string, event: unknown) => {
      this.handleHeartbeat(terminalId, event);
    };
    this.channelReader.on('heartbeat', onHeartbeat);
    this.boundHandlers.push({ event: 'heartbeat', handler: onHeartbeat as (...args: unknown[]) => void });
    
    // Account update - cache metrics
    const onAccountUpdate = (terminalId: string, event: unknown) => {
      this.handleHeartbeat(terminalId, event);
    };
    this.channelReader.on('accountUpdate', onAccountUpdate);
    this.boundHandlers.push({ event: 'accountUpdate', handler: onAccountUpdate as (...args: unknown[]) => void });
  }
  
  // ========================================================================
  // Event Handlers
  // ========================================================================
  
  private async handleLeaderPositionOpened(terminalId: string, event: unknown): Promise<void> {
    if (!this.globalEnabled) return;
    
    const eventData = event as {
      position?: number;
      symbol?: string;
      type?: 'BUY' | 'SELL';
      volume?: number;
      price?: number;
      stopLoss?: number;
      takeProfit?: number;
    };
    
    if (!eventData.position || !eventData.symbol || !eventData.type) {
      return; // Not enough data
    }
    
    const leaderTicket = String(eventData.position);
    
    // Find groups where this terminal is the leader
    for (const group of this.groups.values()) {
      if (group.status !== 'active') continue;
      if (!this.isTerminalForAccount(terminalId, group.leaderAccountId)) continue;
      
      // Process each active follower
      for (const follower of group.followers) {
        if (follower.status !== 'active') continue;
        
        // Apply symbol filtering
        const mappedSymbol = this.mapSymbol(eventData.symbol, group, follower);
        if (!mappedSymbol) continue; // Filtered out
        
        // Apply delay if configured
        if (follower.delayMs > 0) {
          await this.delay(follower.delayMs);
        }
        
        // Check account protection
        if (!this.checkAccountProtection(follower)) {
          this.addActivity({
            groupId: group.id,
            followerId: follower.id,
            type: 'protection-triggered',
            symbol: mappedSymbol,
            action: eventData.type === 'BUY' ? 'buy' : 'sell',
            volume: 0,
            price: 0,
            latency: 0,
            status: 'failed',
            errorMessage: `Account protection triggered (${follower.protectionMode})`,
          });
          continue;
        }
        
        // Check circuit breaker
        const failures = this.followerFailures.get(follower.id) || 0;
        if (failures >= CopierEngine.CIRCUIT_BREAKER_THRESHOLD) {
          console.warn(`[CopierEngine] Circuit breaker active for follower ${follower.id}`);
          continue;
        }
        
        // Compute volume
        const leaderVolumeLots = (eventData.volume || 0) > 100 
          ? (eventData.volume || 0) / 100000  // Convert from units to lots if needed
          : (eventData.volume || 0);
        const volume = this.computeVolume(
          leaderVolumeLots,
          follower,
          terminalId,
          follower.accountId
        );
        
        if (volume <= 0) {
          console.warn(`[CopierEngine] Computed volume <= 0 for follower ${follower.id}`);
          continue;
        }
        
        // Determine side (respect reverse mode)
        let side: 'BUY' | 'SELL' = eventData.type;
        if (follower.reverseMode) {
          side = side === 'BUY' ? 'SELL' : 'BUY';
        }
        
        // Compute SL/TP
        const sl = this.computeStopLoss(eventData, follower, side);
        const tp = this.computeTakeProfit(eventData, follower, side);
        
        // Execute the copy
        await this.executeCopy(group, follower, {
          leaderTicket,
          symbol: mappedSymbol,
          side,
          volume,
          sl,
          tp,
          leaderPrice: eventData.price || 0,
        });
      }
    }
  }
  
  private async handleLeaderPositionClosed(terminalId: string, event: unknown): Promise<void> {
    if (!this.globalEnabled) return;
    
    const eventData = event as {
      position?: number;
      symbol?: string;
      profit?: number;
    };
    
    if (!eventData.position) return;
    
    const leaderTicket = String(eventData.position);
    const correlationsForTicket = this.correlations.get(leaderTicket);
    
    if (!correlationsForTicket || correlationsForTicket.length === 0) return;
    
    // Close all correlated follower positions
    for (const correlation of correlationsForTicket) {
      const group = this.groups.get(correlation.groupId);
      if (!group || group.status !== 'active') continue;
      
      const follower = group.followers.find(f => f.id === correlation.followerId);
      if (!follower || follower.status !== 'active') continue;
      
      const followerTerminalId = this.getTerminalIdForAccount(correlation.followerAccountId);
      if (!followerTerminalId) continue;
      
      const startTime = Date.now();
      
      try {
        const result = await this.channelReader.closePosition(
          followerTerminalId,
          correlation.followerTicket
        );
        
        const latency = Date.now() - startTime;
        
        if (result.success) {
          this.updateFollowerStats(follower, latency, true, eventData.profit || 0);
          this.addActivity({
            groupId: group.id,
            followerId: follower.id,
            type: 'close',
            symbol: correlation.symbol,
            action: correlation.side === 'BUY' ? 'buy' : 'sell',
            volume: correlation.volume,
            price: 0,
            latency,
            status: 'success',
          });
        } else {
          this.updateFollowerStats(follower, latency, false);
          this.addActivity({
            groupId: group.id,
            followerId: follower.id,
            type: 'close',
            symbol: correlation.symbol,
            action: correlation.side === 'BUY' ? 'buy' : 'sell',
            volume: correlation.volume,
            price: 0,
            latency,
            status: 'failed',
            errorMessage: result.error,
          });
        }
      } catch (error) {
        console.error(`[CopierEngine] Close position failed:`, error);
      }
    }
    
    // Remove correlations for this leader ticket
    this.correlations.delete(leaderTicket);
    this.emitStatsUpdate();
    this.saveCorrelations().catch(() => {});
  }
  
  private async handleLeaderPositionModified(terminalId: string, event: unknown): Promise<void> {
    if (!this.globalEnabled) return;
    
    const eventData = event as {
      position?: number;
      symbol?: string;
      stopLoss?: number;
      takeProfit?: number;
      type?: 'BUY' | 'SELL';
    };
    
    if (!eventData.position) return;
    
    const leaderTicket = String(eventData.position);
    const correlationsForTicket = this.correlations.get(leaderTicket);
    
    if (!correlationsForTicket || correlationsForTicket.length === 0) return;
    
    for (const correlation of correlationsForTicket) {
      const group = this.groups.get(correlation.groupId);
      if (!group || group.status !== 'active') continue;
      
      const follower = group.followers.find(f => f.id === correlation.followerId);
      if (!follower || follower.status !== 'active') continue;
      
      // Only modify if SL/TP copying is enabled
      if (!follower.copySL && !follower.copyTP) continue;
      
      const followerTerminalId = this.getTerminalIdForAccount(correlation.followerAccountId);
      if (!followerTerminalId) continue;
      
      // Compute new SL/TP for the follower (considering reverse mode and additional pips)
      const side = correlation.side;
      const sl = follower.copySL ? this.computeStopLoss(eventData, follower, side) : undefined;
      const tp = follower.copyTP ? this.computeTakeProfit(eventData, follower, side) : undefined;
      
      const startTime = Date.now();
      
      try {
        const result = await this.channelReader.modifyPosition(
          followerTerminalId,
          correlation.followerTicket,
          sl,
          tp
        );
        
        const latency = Date.now() - startTime;
        
        this.addActivity({
          groupId: group.id,
          followerId: follower.id,
          type: 'modify',
          symbol: correlation.symbol,
          action: side === 'BUY' ? 'buy' : 'sell',
          volume: correlation.volume,
          price: 0,
          latency,
          status: result.success ? 'success' : 'failed',
          errorMessage: result.error,
        });
      } catch (error) {
        console.error(`[CopierEngine] Modify position failed:`, error);
      }
    }
  }
  
  private handleHeartbeat(terminalId: string, event: unknown): void {
    const data = event as {
      balance?: number;
      equity?: number;
      freeMargin?: number;
      profit?: number;
    };
    
    if (data.balance != null && data.equity != null) {
      const metrics = {
        balance: data.balance,
        equity: data.equity,
        freeMargin: data.freeMargin || 0,
      };
      
      // Store for both leader and follower usage
      this.leaderMetrics.set(terminalId, metrics);
      this.followerMetrics.set(terminalId, metrics);
    }
  }
  
  // ========================================================================
  // Trade Execution
  // ========================================================================
  
  private async executeCopy(
    group: CopierGroup,
    follower: FollowerConfig,
    params: {
      leaderTicket: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      volume: number;
      sl: number;
      tp: number;
      leaderPrice: number;
    }
  ): Promise<void> {
    const { leaderTicket, symbol, side, volume, sl, tp, leaderPrice } = params;
    
    // Per-follower lock to prevent duplicate copies
    const lockKey = `${follower.id}-${leaderTicket}`;
    if (this.followerLocks.get(lockKey)) {
      console.warn(`[CopierEngine] Duplicate copy blocked: ${lockKey}`);
      return;
    }
    this.followerLocks.set(lockKey, true);
    
    const followerTerminalId = this.getTerminalIdForAccount(follower.accountId);
    if (!followerTerminalId) {
      this.followerLocks.delete(lockKey);
      this.addActivity({
        groupId: group.id,
        followerId: follower.id,
        type: 'error',
        symbol,
        action: side === 'BUY' ? 'buy' : 'sell',
        volume,
        price: leaderPrice,
        latency: 0,
        status: 'failed',
        errorMessage: `Follower terminal not connected: ${follower.accountId}`,
      });
      return;
    }
    
    const startTime = Date.now();
    
    try {
      const result = await this.channelReader.openPosition(followerTerminalId, {
        symbol,
        side,
        volume,
        sl: sl > 0 ? sl : undefined,
        tp: tp > 0 ? tp : undefined,
        magic: 123456,
        comment: `HE Copy ${leaderTicket}`,
      });
      
      const latency = Date.now() - startTime;
      
      if (result.success && result.ticket) {
        // Store correlation
        const correlation: PositionCorrelation = {
          leaderTicket,
          followerTicket: result.ticket,
          followerId: follower.id,
          followerAccountId: follower.accountId,
          groupId: group.id,
          symbol,
          side,
          volume,
          openTime: new Date().toISOString(),
        };
        
        const existing = this.correlations.get(leaderTicket) || [];
        existing.push(correlation);
        this.correlations.set(leaderTicket, existing);
        
        // Update stats
        this.updateFollowerStats(follower, latency, true);
        this.followerFailures.set(follower.id, 0); // Reset circuit breaker
        
        this.addActivity({
          groupId: group.id,
          followerId: follower.id,
          type: 'open',
          symbol,
          action: side === 'BUY' ? 'buy' : 'sell',
          volume,
          price: leaderPrice,
          latency,
          status: 'success',
        });
        
        console.log(`[CopierEngine] Copy success: ${side} ${volume} ${symbol} → ${follower.accountName} ticket=${result.ticket} (${latency}ms)`);
      } else {
        // Increment circuit breaker counter
        const failures = (this.followerFailures.get(follower.id) || 0) + 1;
        this.followerFailures.set(follower.id, failures);
        
        this.updateFollowerStats(follower, latency, false);
        
        this.addActivity({
          groupId: group.id,
          followerId: follower.id,
          type: 'open',
          symbol,
          action: side === 'BUY' ? 'buy' : 'sell',
          volume,
          price: leaderPrice,
          latency,
          status: 'failed',
          errorMessage: result.error || 'Unknown error',
        });
        
        console.error(`[CopierEngine] Copy failed: ${result.error} (failures: ${failures}/${CopierEngine.CIRCUIT_BREAKER_THRESHOLD})`);
        
        // Emit error event for notification
        this.emit('copyError', {
          groupId: group.id,
          followerId: follower.id,
          error: result.error,
          circuitBreakerActive: failures >= CopierEngine.CIRCUIT_BREAKER_THRESHOLD,
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      
      const failures = (this.followerFailures.get(follower.id) || 0) + 1;
      this.followerFailures.set(follower.id, failures);
      
      this.updateFollowerStats(follower, latency, false);
      
      this.addActivity({
        groupId: group.id,
        followerId: follower.id,
        type: 'error',
        symbol,
        action: side === 'BUY' ? 'buy' : 'sell',
        volume,
        price: leaderPrice,
        latency,
        status: 'failed',
        errorMessage: errMsg,
      });
      
      console.error(`[CopierEngine] Copy exception:`, error);
    } finally {
      this.followerLocks.delete(lockKey);
      this.emitStatsUpdate();
      this.saveCorrelations().catch(() => {});
    }
  }
  
  // ========================================================================
  // Volume Sizing
  // ========================================================================
  
  private computeVolume(
    leaderVolumeLots: number,
    follower: FollowerConfig,
    leaderTerminalId: string,
    followerAccountId: string
  ): number {
    const followerTerminalId = this.getTerminalIdForAccount(followerAccountId);
    
    switch (follower.volumeSizing) {
      case 'equity-to-equity': {
        const leaderMetrics = this.leaderMetrics.get(leaderTerminalId);
        const followerM = followerTerminalId ? this.followerMetrics.get(followerTerminalId) : null;
        if (!leaderMetrics || !followerM || leaderMetrics.equity <= 0) {
          return leaderVolumeLots; // Fallback to 1:1
        }
        return leaderVolumeLots * (followerM.equity / leaderMetrics.equity);
      }
      
      case 'lot-multiplier':
        return leaderVolumeLots * follower.lotMultiplier;
      
      case 'risk-multiplier':
        // Approximate: apply multiplier to the leader volume as a proxy
        return leaderVolumeLots * follower.riskMultiplier;
      
      case 'fixed-lot':
        return follower.fixedLot;
      
      case 'fixed-risk-percent': {
        const followerM = followerTerminalId ? this.followerMetrics.get(followerTerminalId) : null;
        if (!followerM || followerM.equity <= 0) return follower.fixedLot || 0.01;
        // Simplified: risk% of equity → volume. Full implementation needs SL distance and pip value.
        return (followerM.equity * follower.fixedRiskPercent / 100) / 1000;
      }
      
      case 'fixed-risk-nominal': {
        // Fixed $ risk → volume. Simplified without SL distance.
        return follower.fixedRiskNominal / 1000;
      }
      
      default:
        return leaderVolumeLots;
    }
  }
  
  // ========================================================================
  // Symbol Mapping
  // ========================================================================
  
  /**
   * Map leader symbol to follower symbol based on configuration.
   * Returns null if symbol should be filtered out.
   */
  private mapSymbol(leaderSymbol: string, group: CopierGroup, follower: FollowerConfig): string | null {
    // Remove leader suffix if configured
    let baseSymbol = leaderSymbol;
    if (group.leaderSymbolSuffixRemove && baseSymbol.endsWith(group.leaderSymbolSuffixRemove)) {
      baseSymbol = baseSymbol.slice(0, -group.leaderSymbolSuffixRemove.length);
    }
    
    // Check whitelist (if non-empty, only whitelisted symbols pass)
    if (follower.symbolWhitelist.length > 0) {
      const inWhitelist = follower.symbolWhitelist.some(
        s => s.toUpperCase() === baseSymbol.toUpperCase() || s.toUpperCase() === leaderSymbol.toUpperCase()
      );
      if (!inWhitelist) return null;
    }
    
    // Check blacklist
    if (follower.symbolBlacklist.length > 0) {
      const inBlacklist = follower.symbolBlacklist.some(
        s => s.toUpperCase() === baseSymbol.toUpperCase() || s.toUpperCase() === leaderSymbol.toUpperCase()
      );
      if (inBlacklist) return null;
    }
    
    // Check aliases
    for (const alias of follower.symbolAliases) {
      if (alias.masterSymbol.toUpperCase() === baseSymbol.toUpperCase() ||
          alias.masterSymbol.toUpperCase() === leaderSymbol.toUpperCase()) {
        return alias.slaveSymbol;
      }
    }
    
    // Apply follower suffix
    return baseSymbol + (follower.symbolSuffix || '');
  }
  
  // ========================================================================
  // SL / TP Computation
  // ========================================================================
  
  private computeStopLoss(
    eventData: { stopLoss?: number; type?: string },
    follower: FollowerConfig,
    followerSide: 'BUY' | 'SELL'
  ): number {
    if (!follower.copySL || !eventData.stopLoss || eventData.stopLoss === 0) return 0;
    
    let sl = eventData.stopLoss;
    
    // Apply additional pips (1 pip ≈ 0.0001 for forex)
    const pipValue = 0.0001; // Simplified - should ideally use symbol info
    if (follower.additionalSLPips !== 0) {
      if (followerSide === 'BUY') {
        sl -= follower.additionalSLPips * pipValue; // Wider SL
      } else {
        sl += follower.additionalSLPips * pipValue;
      }
    }
    
    return sl;
  }
  
  private computeTakeProfit(
    eventData: { takeProfit?: number; type?: string },
    follower: FollowerConfig,
    followerSide: 'BUY' | 'SELL'
  ): number {
    if (!follower.copyTP || !eventData.takeProfit || eventData.takeProfit === 0) return 0;
    
    let tp = eventData.takeProfit;
    
    const pipValue = 0.0001;
    if (follower.additionalTPPips !== 0) {
      if (followerSide === 'BUY') {
        tp += follower.additionalTPPips * pipValue;
      } else {
        tp -= follower.additionalTPPips * pipValue;
      }
    }
    
    return tp;
  }
  
  // ========================================================================
  // Account Protection
  // ========================================================================
  
  private checkAccountProtection(follower: FollowerConfig): boolean {
    if (follower.protectionMode === 'off') return true;
    
    const followerTerminalId = this.getTerminalIdForAccount(follower.accountId);
    if (!followerTerminalId) return true; // Can't check, allow
    
    const metrics = this.followerMetrics.get(followerTerminalId);
    if (!metrics) return true;
    
    const value = follower.protectionMode === 'balance-based' ? metrics.balance : metrics.equity;
    
    if (follower.minThreshold > 0 && value < follower.minThreshold) {
      console.warn(`[CopierEngine] Protection: ${follower.accountName} ${follower.protectionMode} ${value} < min ${follower.minThreshold}`);
      return false;
    }
    
    if (follower.maxThreshold > 0 && value > follower.maxThreshold) {
      console.warn(`[CopierEngine] Protection: ${follower.accountName} ${follower.protectionMode} ${value} > max ${follower.maxThreshold}`);
      return false;
    }
    
    return true;
  }
  
  // ========================================================================
  // Stats Updates
  // ========================================================================
  
  private updateFollowerStats(follower: FollowerConfig, latencyMs: number, success: boolean, profit?: number): void {
    if (success) {
      follower.stats.tradesToday++;
      follower.stats.tradesTotal++;
      if (profit != null) {
        follower.stats.totalProfit += profit;
      }
      follower.stats.lastCopyTime = new Date().toISOString();
      
      // Rolling average latency
      const total = follower.stats.tradesTotal;
      follower.stats.avgLatency = ((follower.stats.avgLatency * (total - 1)) + latencyMs) / total;
    } else {
      follower.stats.failedCopies++;
    }
    
    const attempts = follower.stats.tradesTotal + follower.stats.failedCopies;
    follower.stats.successRate = attempts > 0 ? (follower.stats.tradesTotal / attempts) * 100 : 0;
  }
  
  private computeGroupStats(group: CopierGroup): GroupStats {
    let tradesToday = 0;
    let tradesTotal = 0;
    let totalProfit = 0;
    let avgLatency = 0;
    let activeFollowers = 0;
    
    for (const f of group.followers) {
      tradesToday += f.stats.tradesToday;
      tradesTotal += f.stats.tradesTotal;
      totalProfit += f.stats.totalProfit;
      avgLatency += f.stats.avgLatency;
      if (f.status === 'active') activeFollowers++;
    }
    
    if (group.followers.length > 0) {
      avgLatency /= group.followers.length;
    }
    
    return {
      tradesToday,
      tradesTotal,
      totalProfit,
      avgLatency,
      activeFollowers,
      totalFollowers: group.followers.length,
    };
  }
  
  private emitStatsUpdate(): void {
    const groupStats: Record<string, GroupStats> = {};
    for (const [id, group] of this.groups) {
      groupStats[id] = this.computeGroupStats(group);
    }
    this.emit('statsUpdate', groupStats);
  }
  
  // ========================================================================
  // Activity Log
  // ========================================================================
  
  private addActivity(partial: Omit<CopierActivityEntry, 'id' | 'timestamp'>): void {
    const entry: CopierActivityEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...partial,
    };
    
    this.activityLog.push(entry);
    
    // Trim to max size
    if (this.activityLog.length > CopierEngine.MAX_ACTIVITY_LOG) {
      this.activityLog = this.activityLog.slice(-CopierEngine.MAX_ACTIVITY_LOG);
    }
    
    // Emit for real-time UI updates
    this.emit('activity', entry);
  }
  
  // ========================================================================
  // Terminal Lookup
  // ========================================================================
  
  /**
   * Check if the given terminalId corresponds to the given accountId.
   * The agentChannelReader uses "mt5-{login}" as the terminalId.
   * The accountId may be a Supabase UUID, "mt5-{login}", or a raw login.
   */
  private isTerminalForAccount(terminalId: string, accountId: string): boolean {
    // Direct match
    if (terminalId === accountId) return true;
    
    // accountId may be formatted as "mt5-12345" while terminalId is "12345" (or vice-versa)
    if (accountId.startsWith('mt5-')) {
      if (terminalId === accountId.slice(4)) return true;
    }
    if (terminalId.startsWith('mt5-')) {
      if (terminalId.slice(4) === accountId) return true;
    }
    
    // Use accountMap: accountId is a Supabase UUID → look up its terminal ID
    const mappedTerminalId = this.accountMap.get(accountId);
    if (mappedTerminalId) {
      if (terminalId === mappedTerminalId) return true;
      // Also check without "mt5-" prefix
      if (mappedTerminalId.startsWith('mt5-') && terminalId === mappedTerminalId.slice(4)) return true;
    }
    
    return false;
  }
  
  /**
   * Get the terminal ID for a given account ID.
   * accountId may be a Supabase UUID, "mt5-{login}", or a raw login number.
   */
  private getTerminalIdForAccount(accountId: string): string | null {
    // 1. Try direct lookup (works if accountId is already a terminal ID)
    if (this.channelReader.isTerminalConnected(accountId)) {
      return accountId;
    }
    
    // 2. Try stripping "mt5-" prefix
    if (accountId.startsWith('mt5-')) {
      const loginId = accountId.slice(4);
      if (this.channelReader.isTerminalConnected(loginId)) {
        return loginId;
      }
    }
    
    // 3. Use accountMap to resolve Supabase UUID → terminal ID
    const mappedTerminalId = this.accountMap.get(accountId);
    if (mappedTerminalId) {
      // Try the mapped terminal ID directly (e.g. "mt5-12345")
      if (this.channelReader.isTerminalConnected(mappedTerminalId)) {
        return mappedTerminalId;
      }
      // Try without prefix (e.g. "12345" from "mt5-12345")
      if (mappedTerminalId.startsWith('mt5-')) {
        const rawLogin = mappedTerminalId.slice(4);
        if (this.channelReader.isTerminalConnected(rawLogin)) {
          return rawLogin;
        }
      }
    }
    
    // 4. Try all connected terminals as a last resort
    const terminals = this.channelReader.getMT5Terminals();
    for (const tid of terminals) {
      if (tid === accountId || `mt5-${tid}` === accountId) {
        if (this.channelReader.isTerminalConnected(tid)) {
          return tid;
        }
      }
    }
    
    return null;
  }
  
  // ========================================================================
  // Persistence
  // ========================================================================
  
  private async loadCorrelations(): Promise<void> {
    try {
      const data = await fs.readFile(this.correlationFilePath, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, PositionCorrelation[]>;
      this.correlations.clear();
      for (const [key, value] of Object.entries(parsed)) {
        this.correlations.set(key, value);
      }
      console.log(`[CopierEngine] Loaded ${this.correlations.size} correlation entries`);
    } catch {
      // File doesn't exist or is invalid — start fresh
    }
  }
  
  private async saveCorrelations(): Promise<void> {
    try {
      const obj: Record<string, PositionCorrelation[]> = {};
      for (const [key, value] of this.correlations) {
        obj[key] = value;
      }
      await fs.writeFile(this.correlationFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (error) {
      console.error('[CopierEngine] Failed to save correlations:', error);
    }
  }
  
  private async loadActivity(): Promise<void> {
    try {
      const data = await fs.readFile(this.activityFilePath, 'utf-8');
      this.activityLog = JSON.parse(data) as CopierActivityEntry[];
      console.log(`[CopierEngine] Loaded ${this.activityLog.length} activity entries`);
    } catch {
      // Start fresh
    }
  }
  
  private async saveActivity(): Promise<void> {
    try {
      await fs.writeFile(this.activityFilePath, JSON.stringify(this.activityLog, null, 2), 'utf-8');
    } catch (error) {
      console.error('[CopierEngine] Failed to save activity:', error);
    }
  }
  
  // ========================================================================
  // Helpers
  // ========================================================================
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Reset circuit breaker for a follower (called from UI when user acknowledges errors)
   */
  resetCircuitBreaker(_groupId: string, followerId: string): void {
    this.followerFailures.set(followerId, 0);
    console.log(`[CopierEngine] Circuit breaker reset for follower ${followerId}`);
  }
  
  /**
   * Reset daily stats (should be called at midnight)
   */
  resetDailyStats(): void {
    for (const group of this.groups.values()) {
      for (const f of group.followers) {
        f.stats.tradesToday = 0;
      }
    }
    this.emitStatsUpdate();
  }
  
  /**
   * Graceful shutdown - persist state and clean up
   */
  shutdown(): void {
    this.saveCorrelations().catch(() => {});
    this.saveActivity().catch(() => {});
    console.log('[CopierEngine] Shutdown complete - state persisted');
  }
}
