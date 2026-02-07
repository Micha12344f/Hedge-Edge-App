import { app, BrowserWindow, shell, ipcMain, safeStorage, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import crypto from 'crypto';
import { promises as fsPromises } from 'fs';

// Debug log helper - writes to file for debugging
const debugLogPath = path.join(process.env.USERPROFILE || '', 'Desktop', 'hedge-edge-debug.log');
async function debugLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    await fsPromises.appendFile(debugLogPath, line);
  } catch (e) {
    console.error('Failed to write debug log:', e);
  }
  console.log(message);
}

// Agent configuration and supervision modules
import { 
  getAgentConfig, 
  getAgentPort,
  getAgentUrl,
  setAgentConfig,
  resetAgentConfig,
  getConfigSummary,
  bundledAgentExists,
  AgentPlatform,
  AgentMode,
} from './agent-config.js';

import {
  initializeSupervisor,
  shutdownSupervisor,
  getAgentHealthStatus,
  getAllAgentHealthStatus,
  manualStartAgent,
  manualStopAgent,
  restartAgent,
  getAgentLogPath,
} from './agent-supervisor.js';

import { detectTerminals, detectTerminalsDeep, launchTerminal } from './terminal-detector.js';
import { licenseStore } from './license-store.js';
import { licenseManager } from './license-manager.js';
import { webRequestProxy } from './webrequest-proxy.js';
import { 
  checkWebRequestWhitelist, 
  addToWebRequestWhitelist,
  getManualWhitelistInstructions,
  HEDGE_EDGE_API_URL,
} from './mt5-webrequest-helper.js';
import { 
  agentChannelReader, 
  readCTraderSnapshot,
  sendMT5Command,
  sendCTraderCommand,
  isCTraderPipeAvailable,
  type AgentSnapshot,
  type AgentCommand,
} from './agent-channel-reader.js';

// ============================================================================
// Connection Session Manager (In-Memory State)
// ============================================================================

type ConnectionPlatform = 'mt5' | 'ctrader';
type ConnectionRole = 'local' | 'vps' | 'cloud';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

interface ConnectionEndpoint {
  host: string;
  port: number;
  secure?: boolean;
}

interface ConnectionMetrics {
  balance: number;
  equity: number;
  profit: number;
  positionCount: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
}

interface ConnectionPosition {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: string;
  magic?: number;
  comment?: string;
}

interface ConnectionSession {
  id: string;
  accountId: string;
  platform: ConnectionPlatform;
  role: ConnectionRole;
  endpoint?: ConnectionEndpoint;
  status: ConnectionStatus;
  lastUpdate: string;
  lastConnected?: string;
  error?: string;
  reconnectAttempts?: number;
  autoReconnect?: boolean;
  // Internal: stored credentials for auto-reconnect (never exposed via IPC)
  _credentials?: { login: string; password: string; server: string };
  // Internal: ZeroMQ terminal ID for multi-account routing
  _terminalId?: string;
}

interface ConnectionSnapshot {
  session: ConnectionSession;
  metrics?: ConnectionMetrics;
  positions?: ConnectionPosition[];
  timestamp: string;
}

type ConnectionSnapshotMap = Record<string, ConnectionSnapshot>;

// EA/cBot heartbeat configuration
// If no fresh data from EA/cBot within this threshold, consider it disconnected
const EA_STALENESS_THRESHOLD_MS = 15000; // 15 seconds - EAs typically update every 1-2 seconds

// In-memory connection sessions
const connectionSessions: Map<string, ConnectionSession> = new Map();
const connectionMetrics: Map<string, ConnectionMetrics> = new Map();
const connectionPositions: Map<string, ConnectionPosition[]> = new Map();
// Track last time we received fresh data from EA/cBot per account
const lastEADataTimestamp: Map<string, Date> = new Map();

// ============================================================================
// Connection Session Persistence & Auto-Reconnect
// ============================================================================

/**
 * Persisted session data (without sensitive credentials)
 * Stored in electron-store or JSON file for reconnection on restart
 */
interface PersistedSession {
  accountId: string;
  platform: ConnectionPlatform;
  role: ConnectionRole;
  login: string;
  server: string;
  lastConnected?: string;
}

// File path for persisted sessions
const SESSIONS_FILE = path.join(app.getPath('userData'), 'connection-sessions.json');

/**
 * Load persisted sessions from disk
 */
async function loadPersistedSessions(): Promise<PersistedSession[]> {
  try {
    const data = await fsPromises.readFile(SESSIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid - return empty
    return [];
  }
}

/**
 * Save sessions to disk (without passwords)
 */
async function savePersistedSessions(): Promise<void> {
  const sessions: PersistedSession[] = [];
  
  for (const [accountId, session] of connectionSessions) {
    if (session._credentials) {
      sessions.push({
        accountId,
        platform: session.platform,
        role: session.role,
        login: session._credentials.login,
        server: session._credentials.server,
        lastConnected: session.lastConnected,
      });
    }
  }
  
  try {
    await fsPromises.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
    console.log('[Main] Saved', sessions.length, 'connection sessions to disk');
  } catch (error) {
    console.error('[Main] Failed to save sessions:', error);
  }
}

/**
 * Auto-reconnect accounts via ZeroMQ
 * Called on app startup to restore connections
 * Scans multiple port ranges for multi-account support
 */
async function autoReconnectFromZMQ(): Promise<void> {
  try {
    // Scan all configured port ranges for MT5 terminals
    const connectedTerminals = await agentChannelReader.scanAndConnectAllMT5Terminals();
    
    // Process each connected terminal (detected via PUB/SUB events)
    for (const terminalId of connectedTerminals) {
      const snapshot = agentChannelReader.getLastSnapshot(terminalId);
      if (snapshot) {
        // Use terminalId as the primary session key for multi-account support
        // This ensures each terminal on different ports has its own session
        // The snapshot.accountId may be "0" if terminal isn't fully logged in
        const sessionKey = terminalId;
        
        // Check if session already exists
        if (!connectionSessions.has(sessionKey)) {
          // Create session from ZeroMQ data
          const session: ConnectionSession = {
            id: sessionKey,
            accountId: sessionKey, // Use terminalId as accountId for uniqueness
            platform: 'mt5',
            role: 'local',
            status: 'connected',
            lastUpdate: new Date().toISOString(),
            lastConnected: new Date().toISOString(),
            autoReconnect: true,
            _credentials: {
              login: String(snapshot.accountId || '0'),
              password: '',
              server: snapshot.server || snapshot.broker || '',
            },
            // Store terminalId for ZMQ routing
            _terminalId: terminalId,
          };
          connectionSessions.set(sessionKey, session);
          
          // Track EA data timestamp for health checking
          lastEADataTimestamp.set(sessionKey, new Date());
          
          // Store metrics from ZeroMQ snapshot
          const metrics: ConnectionMetrics = {
            balance: snapshot.balance ?? 0,
            equity: snapshot.equity ?? 0,
            profit: snapshot.floatingPnL ?? 0,
            positionCount: snapshot.positions?.length ?? 0,
            margin: snapshot.margin,
            freeMargin: snapshot.freeMargin,
            marginLevel: snapshot.marginLevel,
          };
          connectionMetrics.set(sessionKey, metrics);
          
          // Store positions
          if (snapshot.positions) {
            const positions: ConnectionPosition[] = snapshot.positions.map((p: any) => ({
              ticket: parseInt(p.id) || 0,
              symbol: p.symbol,
              type: p.side === 'BUY' ? 'buy' : 'sell',
              volume: p.volumeLots,
              openPrice: p.entryPrice,
              currentPrice: p.currentPrice,
              profit: p.profit,
              stopLoss: p.stopLoss,
              takeProfit: p.takeProfit,
              openTime: p.openTime || new Date().toISOString(),
              magic: 0,
              comment: p.comment || '',
            }));
            connectionPositions.set(sessionKey, positions);
          }
        }
      }
    }
    
    // Also try to load persisted sessions and mark them for reconnect
    const persisted = await loadPersistedSessions();
    for (const ps of persisted) {
      if (!connectionSessions.has(ps.accountId)) {
        // Create a disconnected session so UI knows about this account
        const session: ConnectionSession = {
          id: ps.accountId,
          accountId: ps.accountId,
          platform: ps.platform,
          role: ps.role,
          status: 'disconnected',
          lastUpdate: new Date().toISOString(),
          lastConnected: ps.lastConnected,
          autoReconnect: true,
          _credentials: {
            login: ps.login,
            password: '',
            server: ps.server,
          },
        };
        connectionSessions.set(ps.accountId, session);
        console.log('[Main] Loaded persisted session (disconnected):', ps.accountId);
      }
    }
    
    console.log('[Main] Auto-reconnect complete. Total sessions:', connectionSessions.size);
  } catch (error) {
    console.error('[Main] Auto-reconnect failed:', error);
  }
}

/**
 * Get a sanitized session (without internal credentials)
 */
function getSanitizedSession(session: ConnectionSession): ConnectionSession {
  const { _credentials, ...sanitized } = session;
  return sanitized;
}

/**
 * Build a snapshot for an account
 * Includes both terminalId and actual MT5 accountId (login) for proper matching
 */
function buildSnapshot(accountId: string): ConnectionSnapshot | null {
  const session = connectionSessions.get(accountId);
  if (!session) return null;
  
  // Get the actual MT5 account login from the ZMQ snapshot if available
  const terminalId = session._terminalId || accountId;
  const zmqSnapshot = agentChannelReader.getLastSnapshot(terminalId);
  
  // Build sanitized session with actual account info for matching
  const sanitizedSession = getSanitizedSession(session);
  
  // Add actual MT5 login to session for proper frontend matching
  if (zmqSnapshot?.accountId) {
    (sanitizedSession as any).mt5Login = String(zmqSnapshot.accountId);
    (sanitizedSession as any).broker = zmqSnapshot.broker;
    (sanitizedSession as any).server = zmqSnapshot.server;
  }
  
  return {
    session: sanitizedSession,
    metrics: connectionMetrics.get(accountId),
    positions: connectionPositions.get(accountId),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build all snapshots - one entry per real connection
 * Keyed by connection session ID (terminalId). The raw MT5 login is
 * available inside each snapshot (session.mt5Login / session.login)
 * so the frontend can match by login without duplicate map keys.
 */
function buildAllSnapshots(): ConnectionSnapshotMap {
  const snapshots: ConnectionSnapshotMap = {};
  for (const [accountId, session] of connectionSessions) {
    const snapshot = buildSnapshot(accountId);
    if (snapshot) {
      // Single canonical key per connection (e.g., "mt5-11789976")
      snapshots[accountId] = snapshot;
    }
  }
  return snapshots;
}

/**
 * Push connection updates to renderer (EVENT-DRIVEN - replaces polling)
 * Called when ZeroMQ events come in from EAs
 */
function pushConnectionUpdate(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  try {
    const snapshots = safeSerializeForIPC(buildAllSnapshots());
    window.webContents.send('connections:update', snapshots);
  } catch (error) {
    console.error('[Main] Failed to push connection update:', error);
  }
}

/**
 * Update metrics from heartbeat event (now includes positions for real-time updates)
 */
function updateMetricsFromHeartbeat(terminalId: string, event: unknown): void {
  const heartbeat = event as { 
    data?: { 
      balance?: number; 
      equity?: number; 
      profit?: number; 
      margin?: number;
      freeMargin?: number;
      positionCount?: number;
      positions?: Array<{
        id: string;
        symbol: string;
        side: string;
        volumeLots: number;
        entryPrice: number;
        currentPrice: number;
        profit: number;
        stopLoss: number | null;
        takeProfit: number | null;
        swap: number;
        commission: number;
        openTime: string;
        comment: string;
      }>;
    } 
  };
  if (heartbeat?.data) {
    const metrics = connectionMetrics.get(terminalId) || {
      balance: 0,
      equity: 0,
      profit: 0,
      positionCount: 0,
    };
    
    if (heartbeat.data.balance !== undefined) metrics.balance = heartbeat.data.balance;
    if (heartbeat.data.equity !== undefined) metrics.equity = heartbeat.data.equity;
    if (heartbeat.data.profit !== undefined) metrics.profit = heartbeat.data.profit;
    if (heartbeat.data.positionCount !== undefined) metrics.positionCount = heartbeat.data.positionCount;
    if (heartbeat.data.margin !== undefined) (metrics as any).margin = heartbeat.data.margin;
    if (heartbeat.data.freeMargin !== undefined) (metrics as any).freeMargin = heartbeat.data.freeMargin;
    
    connectionMetrics.set(terminalId, metrics);
    lastEADataTimestamp.set(terminalId, new Date());
    
    // Update positions from heartbeat if provided (for real-time position updates)
    if (heartbeat.data.positions && heartbeat.data.positions.length >= 0) {
      const positions: ConnectionPosition[] = heartbeat.data.positions.map((p) => ({
        ticket: parseInt(p.id) || 0,
        symbol: p.symbol,
        type: p.side === 'BUY' ? 'buy' : 'sell',
        volume: p.volumeLots,
        openPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        profit: p.profit,
        stopLoss: p.stopLoss ?? 0,
        takeProfit: p.takeProfit ?? 0,
        openTime: p.openTime || new Date().toISOString(),
        magic: 0,
        comment: p.comment || '',
      }));
      connectionPositions.set(terminalId, positions);
    }
  }
}

/**
 * Check ZeroMQ health for all connected sessions
 * Marks sessions as disconnected if ZeroMQ data is stale
 */
async function checkZMQHealthForAllSessions(): Promise<void> {
  const now = new Date();
  
  for (const [accountId, session] of connectionSessions) {
    // Only check connected sessions
    if (session.status !== 'connected') continue;
    
    // Check if we have recent ZeroMQ data
    const lastUpdate = lastEADataTimestamp.get(accountId);
    const isStale = !lastUpdate || (now.getTime() - lastUpdate.getTime() > EA_STALENESS_THRESHOLD_MS);
    
    if (isStale) {
      // Try to refresh from ZeroMQ to confirm disconnection
      const stillConnected = await verifyZMQConnection(accountId, session);
      
      if (!stillConnected) {
        updateSessionStatus(accountId, 'disconnected', 'Trading terminal closed or HedgeEdgeZMQ EA removed');
      }
    }
  }
}

/**
 * Verify if ZeroMQ connection is still active
 * Returns true if connection is still active, false if disconnected
 */
async function verifyZMQConnection(accountId: string, session: ConnectionSession): Promise<boolean> {
  try {
    if (session.platform === 'mt5') {
      // Use the terminalId from session if available (multi-account support)
      const terminalId = session._terminalId || 'mt5-default';
      
      // Check if the terminal is connected
      if (!agentChannelReader.isTerminalConnected(terminalId)) {
        return false;
      }
      
      const snapshot = agentChannelReader.getLastSnapshot(terminalId);
      if (snapshot) {
        // Check if the data timestamp is fresh
        const zmqTimestamp = new Date(snapshot.timestamp);
        const now = new Date();
        const ageMs = now.getTime() - zmqTimestamp.getTime();
        
        if (ageMs < EA_STALENESS_THRESHOLD_MS) {
          // ZMQ is still running and providing fresh data
          lastEADataTimestamp.set(accountId, now);
          
          // Update metrics from fresh data
          const metrics: ConnectionMetrics = {
            balance: snapshot.balance ?? 0,
            equity: snapshot.equity ?? 0,
            profit: snapshot.floatingPnL ?? 0,
            positionCount: snapshot.positions?.length ?? 0,
            margin: snapshot.margin,
            freeMargin: snapshot.freeMargin,
            marginLevel: snapshot.marginLevel,
          };
          connectionMetrics.set(accountId, metrics);
          
          // Update positions from fresh data
          if (snapshot.positions) {
            const positions: ConnectionPosition[] = snapshot.positions.map((p: any) => ({
              ticket: parseInt(p.id) || 0,
              symbol: p.symbol,
              type: p.side === 'BUY' ? 'buy' : 'sell',
              volume: p.volumeLots,
              openPrice: p.entryPrice,
              currentPrice: p.currentPrice,
              profit: p.profit,
              stopLoss: p.stopLoss,
              takeProfit: p.takeProfit,
              openTime: p.openTime || new Date().toISOString(),
              magic: 0,
              comment: p.comment || '',
            }));
            connectionPositions.set(accountId, positions);
          }
          
          return true;
        }
      }
      
      // No fresh MT5 ZMQ data found
      return false;
      
    } else if (session.platform === 'ctrader') {
      // For cTrader, check if the named pipe is still available
      try {
        const pipeAvailable = await isCTraderPipeAvailable();
        if (pipeAvailable) {
          lastEADataTimestamp.set(accountId, new Date());
          return true;
        }
      } catch {
        // Pipe not available
      }
      return false;
    }
    
    return false;
  } catch (error) {
    console.error(`[Main] Error verifying ZMQ connection for ${accountId}:`, error);
    return false;
  }
}

/**
 * Update session status
 */
function updateSessionStatus(
  accountId: string, 
  status: ConnectionStatus, 
  error?: string
): void {
  const session = connectionSessions.get(accountId);
  if (session) {
    session.status = status;
    session.lastUpdate = new Date().toISOString();
    session.error = error;
    if (status === 'connected') {
      session.lastConnected = session.lastUpdate;
      session.reconnectAttempts = 0;
    }
    connectionSessions.set(accountId, session);
  }
}

/**
 * Fetch metrics for a connected session
 */
async function fetchSessionMetrics(accountId: string): Promise<void> {
  const session = connectionSessions.get(accountId);
  if (!session || session.status !== 'connected' || !session._credentials) {
    return;
  }

  try {
    const platform = session.platform as AgentPlatform;
    
    // Get snapshot from agent
    const result = await agentRequest<{
      balance?: number;
      equity?: number;
      profit?: number;
      margin?: number;
      free_margin?: number;
      margin_level?: number;
      positions?: Array<{
        ticket: number;
        symbol: string;
        type: string;
        volume: number;
        price_open: number;
        price_current: number;
        profit: number;
        sl?: number;
        tp?: number;
        time?: string;
        magic?: number;
        comment?: string;
      }>;
    }>(platform, '/api/account/snapshot', 'POST', session._credentials);

    if (result.success && result.data) {
      const data = result.data;
      
      // Track successful data fetch for health checking
      lastEADataTimestamp.set(accountId, new Date());
      
      // Update metrics
      const metrics: ConnectionMetrics = {
        balance: data.balance ?? 0,
        equity: data.equity ?? 0,
        profit: data.profit ?? 0,
        positionCount: data.positions?.length ?? 0,
        margin: data.margin,
        freeMargin: data.free_margin,
        marginLevel: data.margin_level,
      };
      connectionMetrics.set(accountId, metrics);

      // Update positions
      if (data.positions) {
        const positions: ConnectionPosition[] = data.positions.map(p => ({
          ticket: p.ticket,
          symbol: p.symbol,
          type: p.type.toLowerCase() as 'buy' | 'sell',
          volume: p.volume,
          openPrice: p.price_open,
          currentPrice: p.price_current,
          profit: p.profit,
          stopLoss: p.sl,
          takeProfit: p.tp,
          openTime: p.time ?? new Date().toISOString(),
          magic: p.magic,
          comment: p.comment,
        }));
        connectionPositions.set(accountId, positions);
      }

      session.lastUpdate = new Date().toISOString();
      connectionSessions.set(accountId, session);
    } else {
      // Connection issue - mark as error
      updateSessionStatus(accountId, 'error', result.error || 'Failed to fetch data');
    }
  } catch (error) {
    updateSessionStatus(accountId, 'error', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Connect an account
 * For MT5: Connects via ZeroMQ (HedgeEdgeZMQ EA)
 */
async function connectAccount(params: {
  accountId: string;
  platform: ConnectionPlatform;
  role: ConnectionRole;
  credentials: { login: string; password: string; server: string };
  endpoint?: ConnectionEndpoint;
  autoReconnect?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { accountId, platform, role, credentials, endpoint, autoReconnect } = params;

  // Create or update session
  const session: ConnectionSession = {
    id: accountId,
    accountId,
    platform,
    role,
    endpoint,
    status: 'connecting',
    lastUpdate: new Date().toISOString(),
    autoReconnect: autoReconnect ?? true, // Default to auto-reconnect
    _credentials: credentials,
  };
  connectionSessions.set(accountId, session);

  // For MT5, connect via ZeroMQ
  if (platform === 'mt5') {
    try {
      // Check for existing ZeroMQ connection
      let snapshot = null;
      const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
        id => agentChannelReader.isTerminalConnected(id)
      );
      
      for (const terminalId of zmqTerminals) {
        const s = agentChannelReader.getLastSnapshot(terminalId);
        if (s && String(s.accountId) === String(credentials.login)) {
          snapshot = s;
          // Store terminalId for ZMQ routing (was missing before)
          session._terminalId = terminalId;
          break;
        }
      }
      
      // Try to discover via auto-port scan if no existing connection
      if (!snapshot) {
        const discovered = await agentChannelReader.scanAndConnectAllMT5Terminals();
        for (const tid of discovered) {
          const s = agentChannelReader.getLastSnapshot(tid);
          if (s && String(s.accountId) === String(credentials.login)) {
            snapshot = s;
            // Update session with discovered terminalId for routing
            session._terminalId = tid;
            break;
          }
        }
      }
      
      if (snapshot) {
        console.log('[Main] Connected via ZeroMQ for account:', credentials.login);
        
        // Track timestamp for health checking
        lastEADataTimestamp.set(accountId, new Date());
        
        // Update session to connected
        session.status = 'connected';
        session.lastConnected = new Date().toISOString();
        session.lastUpdate = session.lastConnected;
        connectionSessions.set(accountId, session);
        
        // Store metrics
        const metrics: ConnectionMetrics = {
          balance: snapshot.balance ?? 0,
          equity: snapshot.equity ?? 0,
          profit: snapshot.floatingPnL ?? 0,
          positionCount: snapshot.positions?.length ?? 0,
          margin: snapshot.margin,
          freeMargin: snapshot.freeMargin,
          marginLevel: snapshot.marginLevel,
        };
        connectionMetrics.set(accountId, metrics);
        
        // Store positions
        if (snapshot.positions) {
          const positions: ConnectionPosition[] = snapshot.positions.map((p: any) => ({
            ticket: parseInt(p.id) || 0,
            symbol: p.symbol,
            type: p.side === 'BUY' ? 'buy' : 'sell',
            volume: p.volumeLots,
            openPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            profit: p.profit,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
            openTime: p.openTime || new Date().toISOString(),
            magic: 0,
            comment: p.comment || '',
          }));
          connectionPositions.set(accountId, positions);
        }
        
        // Save session for reconnect on restart
        savePersistedSessions().catch(err => console.error('[Main] Failed to save sessions:', err));
        
        return { success: true };
      }
      
      // ZeroMQ connection not found for this account
      console.log('[Main] No ZeroMQ connection found for account:', credentials.login);
      updateSessionStatus(accountId, 'error', 'HedgeEdgeZMQ EA not running for this account.');
      return { success: false, error: 'HedgeEdgeZMQ EA not running for this account. Attach the EA to a chart in MT5.' };
      
    } catch (error) {
      console.log('[Main] ZeroMQ connection failed:', error);
      updateSessionStatus(accountId, 'error', error instanceof Error ? error.message : 'Connection failed');
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  // For cTrader, use agent API
  try {
    const result = await agentRequest<{ valid?: boolean }>(
      platform as AgentPlatform, 
      '/api/validate', 
      'POST', 
      credentials
    );

    if (result.success) {
      updateSessionStatus(accountId, 'connected');
      await fetchSessionMetrics(accountId);
      
      // Save session for reconnect on restart
      savePersistedSessions().catch(err => console.error('[Main] Failed to save sessions:', err));
      
      return { success: true };
    } else {
      updateSessionStatus(accountId, 'error', result.error || 'Validation failed');
      return { success: false, error: result.error || 'Validation failed' };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Connection failed';
    updateSessionStatus(accountId, 'error', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Disconnect an account
 */
function disconnectAccount(accountId: string, reason?: string): { success: boolean; error?: string } {
  const session = connectionSessions.get(accountId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  // Clear credentials
  delete session._credentials;
  session.status = 'disconnected';
  session.lastUpdate = new Date().toISOString();
  session.error = reason;
  connectionSessions.set(accountId, session);

  // Clear metrics and positions
  connectionMetrics.delete(accountId);
  connectionPositions.delete(accountId);

  return { success: true };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if running in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

// ============================================================================
// Event-Driven Trading Feed Forwarding
// ============================================================================

/**
 * EFFICIENCY MODEL (inspired by Heron Copier):
 * 
 * 1. TRADE EVENTS (position open/close/modify) → push to UI IMMEDIATELY
 *    These are critical for hedge execution and must be instant.
 * 
 * 2. ACCOUNT DATA (balance, equity, margin) → 30-second refresh timer
 *    No need for real-time streaming of financial metrics.
 *    User can also click "Refresh" button for on-demand update.
 * 
 * 3. HEARTBEATS → update health timestamp only, NO UI push
 *    Just proves the EA is alive. Data is cached in agentChannelReader.
 * 
 * 4. CONNECTION STATE CHANGES → push immediately
 *    Connect/disconnect are important state transitions.
 */

// 30-second periodic refresh timer
let periodicRefreshTimer: NodeJS.Timeout | null = null;
const ACCOUNT_REFRESH_INTERVAL_MS = 30000; // 30 seconds

/**
 * Start periodic account data refresh (30s timer)
 * Reads cached ZMQ data and pushes to renderer
 */
function startPeriodicRefresh(window: BrowserWindow): void {
  if (periodicRefreshTimer) clearInterval(periodicRefreshTimer);
  
  periodicRefreshTimer = setInterval(() => {
    if (window.isDestroyed()) {
      if (periodicRefreshTimer) clearInterval(periodicRefreshTimer);
      return;
    }
    
    // Read cached data from agentChannelReader (already updated by ZMQ silently)
    refreshAllSessionsFromCache();
    pushConnectionUpdate(window);
  }, ACCOUNT_REFRESH_INTERVAL_MS);
  
  console.log(`[Main] Started periodic account refresh (every ${ACCOUNT_REFRESH_INTERVAL_MS / 1000}s)`);
}

/**
 * Refresh all session metrics from cached ZMQ data (no network calls)
 */
function refreshAllSessionsFromCache(): void {
  for (const [accountId, session] of connectionSessions) {
    if (session.status !== 'connected') continue;
    
    const terminalId = session._terminalId || accountId;
    const snapshot = agentChannelReader.getLastSnapshot(terminalId);
    if (!snapshot) continue;
    
    // Update metrics from cached snapshot
    const metrics: ConnectionMetrics = {
      balance: snapshot.balance ?? 0,
      equity: snapshot.equity ?? 0,
      profit: snapshot.floatingPnL ?? 0,
      positionCount: snapshot.positions?.length ?? 0,
      margin: snapshot.margin,
      freeMargin: snapshot.freeMargin,
      marginLevel: snapshot.marginLevel,
    };
    connectionMetrics.set(accountId, metrics);
    lastEADataTimestamp.set(accountId, new Date());
    
    // Update positions from cached snapshot
    if (snapshot.positions) {
      const positions: ConnectionPosition[] = snapshot.positions.map((p: any) => ({
        ticket: parseInt(p.id) || 0,
        symbol: p.symbol,
        type: p.side === 'BUY' ? 'buy' : 'sell',
        volume: p.volumeLots,
        openPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        profit: p.profit,
        stopLoss: p.stopLoss ?? 0,
        takeProfit: p.takeProfit ?? 0,
        openTime: p.openTime || new Date().toISOString(),
        magic: 0,
        comment: p.comment || '',
      }));
      connectionPositions.set(accountId, positions);
    }
  }
}

/**
 * Set up event forwarding from agentChannelReader to the renderer
 * ONLY trade events and connection state changes push immediately.
 * Account data refreshes on 30s timer or manual "Refresh" button.
 */
function setupTradingEventForwarding(window: BrowserWindow): void {
  // Forward critical events to renderer
  const forwardEvent = (eventName: string, terminalId: string, eventData: unknown) => {
    if (window.isDestroyed()) return;
    try {
      const payload = safeSerializeForIPC({
        event: eventName,
        terminalId,
        data: eventData,
        timestamp: new Date().toISOString(),
      });
      window.webContents.send('trading:event', payload);
    } catch (error) {
      console.error(`[Main] Failed to forward ${eventName} event:`, error);
    }
  };
  
  // ━━━ IMMEDIATE: Trade Events (critical for hedge execution) ━━━━━━━━━━━
  agentChannelReader.on('positionOpened', (terminalId: string, event: unknown) => {
    console.log(`[Main] Trade event: positionOpened on ${terminalId}`);
    forwardEvent('positionOpened', terminalId, event);
    // Also refresh cached data and push full snapshot so UI shows new position
    refreshAllSessionsFromCache();
    pushConnectionUpdate(window);
  });
  
  agentChannelReader.on('positionClosed', (terminalId: string, event: unknown) => {
    console.log(`[Main] Trade event: positionClosed on ${terminalId}`);
    forwardEvent('positionClosed', terminalId, event);
    refreshAllSessionsFromCache();
    pushConnectionUpdate(window);
  });
  
  agentChannelReader.on('positionModified', (terminalId: string, event: unknown) => {
    forwardEvent('positionModified', terminalId, event);
    refreshAllSessionsFromCache();
    pushConnectionUpdate(window);
  });
  
  agentChannelReader.on('positionReversed', (terminalId: string, event: unknown) => {
    forwardEvent('positionReversed', terminalId, event);
    refreshAllSessionsFromCache();
    pushConnectionUpdate(window);
  });
  
  // ━━━ IMMEDIATE: Order Events ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agentChannelReader.on('orderPlaced', (terminalId: string, event: unknown) => {
    forwardEvent('orderPlaced', terminalId, event);
  });
  
  agentChannelReader.on('orderCancelled', (terminalId: string, event: unknown) => {
    forwardEvent('orderCancelled', terminalId, event);
  });
  
  // ━━━ IMMEDIATE: Connection State Changes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agentChannelReader.on('terminalConnected', (terminalId: string) => {
    console.log(`[Main] Terminal connected: ${terminalId}`);
    forwardEvent('connected', terminalId, { connected: true });
    refreshAllSessionsFromCache();
    pushConnectionUpdate(window);
  });
  
  agentChannelReader.on('terminalDisconnected', (terminalId: string) => {
    console.log(`[Main] Terminal disconnected: ${terminalId}`);
    forwardEvent('disconnected', terminalId, { connected: false });
    pushConnectionUpdate(window);
  });
  
  // ━━━ SILENT: Heartbeat (health tracking only, no UI push) ━━━━━━━━━━━━━
  agentChannelReader.on('heartbeat', (terminalId: string, _event: unknown) => {
    // Just update the health timestamp - proves EA is alive
    lastEADataTimestamp.set(terminalId, new Date());
  });
  
  // ━━━ IMMEDIATE: Pause/Resume Events ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agentChannelReader.on('paused', (terminalId: string, event: unknown) => {
    forwardEvent('paused', terminalId, event);
  });
  
  agentChannelReader.on('resumed', (terminalId: string, event: unknown) => {
    forwardEvent('resumed', terminalId, event);
  });
  
  // Error events
  agentChannelReader.on('error', (terminalId: string, error: Error) => {
    forwardEvent('error', terminalId, { message: error.message });
  });
  
  // ━━━ START: 30-second periodic refresh timer ━━━━━━━━━━━━━━━━━━━━━━━━━━
  startPeriodicRefresh(window);
}

// ============================================================================
// IPC Payload Validation
// ============================================================================

/**
 * Safely serialize a response for IPC to avoid DataCloneError
 * This ensures all values are JSON-serializable primitives
 */
function safeSerializeForIPC<T>(data: T): T {
  try {
    // First try to stringify - this will throw if there are circular refs or non-serializable values
    const serialized = JSON.stringify(data);
    return JSON.parse(serialized);
  } catch (err) {
    console.error('[Main] safeSerializeForIPC failed:', err);
    console.error('[Main] Data that failed to serialize:', typeof data, data);
    // If serialization fails, return a safe error
    return { success: false, error: 'Failed to serialize response' } as T;
  }
}

/**
 * Validate that a value is a valid trading platform
 */
function isValidPlatform(value: unknown): value is AgentPlatform {
  return value === 'mt5' || value === 'ctrader';
}

/**
 * Validate trading credentials structure
 */
function isValidCredentials(value: unknown): value is { login: string; password: string; server: string } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.login === 'string' &&
    typeof obj.password === 'string' &&
    typeof obj.server === 'string' &&
    obj.login.length > 0 &&
    obj.server.length > 0
  );
}

/**
 * Validate order request structure
 */
function isValidOrderRequest(value: unknown): value is { 
  symbol: string; 
  type: string; 
  volume: number;
  price?: number;
  sl?: number;
  tp?: number;
  magic?: number;
  comment?: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.symbol === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.volume === 'number' &&
    obj.symbol.length > 0 &&
    ['BUY', 'SELL'].includes(obj.type) &&
    obj.volume > 0
  );
}

/**
 * Validate close order request structure
 */
function isValidCloseOrderRequest(value: unknown): value is { ticket: number; volume?: number } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ticket === 'number' &&
    obj.ticket > 0 &&
    (obj.volume === undefined || (typeof obj.volume === 'number' && obj.volume > 0))
  );
}

/**
 * Validate agent config update structure
 */
function isValidAgentConfigUpdate(value: unknown): value is { mode?: AgentMode; host?: string; port?: number } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  if (obj.mode !== undefined && !['bundled', 'external', 'not-configured'].includes(obj.mode as string)) {
    return false;
  }
  if (obj.host !== undefined && typeof obj.host !== 'string') {
    return false;
  }
  if (obj.port !== undefined && (typeof obj.port !== 'number' || obj.port < 1 || obj.port > 65535)) {
    return false;
  }
  return true;
}

// ============================================================================
// Port Checking Utility
// ============================================================================

/**
 * Check if a port is available (not in use)
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

// ============================================================================
// Agent HTTP Requests
// ============================================================================

/**
 * Make a request to the local trading agent
 * Uses configurable ports from agent-config
 */
async function agentRequest<T>(
  platform: AgentPlatform,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<{ success: boolean; data?: T; error?: string }> {
  const baseUrl = getAgentUrl(platform);
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json() as T & { error?: string };
    
    if (!response.ok) {
      return { success: false, error: data?.error || `HTTP ${response.status}` };
    }
    
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Agent request failed',
    };
  }
}

// ============================================================================
// Security: URL Allowlist for External Links
// ============================================================================

const EXTERNAL_URL_ALLOWLIST = [
  // Documentation and support
  'hedgeedge.com',
  'docs.hedgeedge.com',
  'support.hedgeedge.com',
  // OAuth providers (Supabase, etc.)
  'supabase.co',
  // GitHub for updates/releases
  'github.com',
  'releases.hedgeedge.com',
];

/**
 * Check if a URL is allowed for external opening
 */
function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow https (and http in dev)
    if (parsed.protocol !== 'https:' && !(isDev && parsed.protocol === 'http:')) {
      return false;
    }
    
    // Check against allowlist
    const hostname = parsed.hostname.toLowerCase();
    return EXTERNAL_URL_ALLOWLIST.some(allowed => 
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Security Handlers
// ============================================================================

function setupSecurityHandlers(window: BrowserWindow) {
  // Prevent navigation to external URLs
  window.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowedProtocols = ['file:', 'http:', 'https:'];
    
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      event.preventDefault();
      return;
    }
    
    // In production, only allow file: protocol for main content
    if (!isDev && parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      // Use the same allowlist for consistency
      if (isAllowedExternalUrl(url)) {
        shell.openExternal(url);
      } else {
        console.warn('Blocked navigation to non-allowlisted URL:', url);
      }
    }
  });

  // Open external links in default browser (with allowlist check)
  window.webContents.setWindowOpenHandler(({ url }) => {
    // Apply the same allowlist check as app:openExternal
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      console.warn('Blocked window.open to non-allowlisted URL:', url);
    }
    return { action: 'deny' };
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'HedgeEdge',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#0a0a0a',
    show: true, // Show immediately for debugging
    center: true, // Center on screen
    webPreferences: {
      // Security: Use preload script for safe IPC
      preload: path.join(__dirname, 'preload.js'),
      // Security: Disable Node.js integration in renderer
      nodeIntegration: false,
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable remote module
      sandbox: true,
      // Security: Disable web security only in dev for hot reload
      webSecurity: !isDev,
    },
  });

  // Setup security handlers
  setupSecurityHandlers(mainWindow);

  // Content Security Policy
  // All trading data flows via IPC, so we can lock down connect-src
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          scriptSrc,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: blob:",
          // Only allow Supabase for auth - all trading data flows via IPC
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    });
  });

  // Load the app
  if (isDev) {
    // Development: Load from Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:8080';
    console.log('[Main] Loading dev server:', devServerUrl);
    try {
      await mainWindow.loadURL(devServerUrl);
      console.log('[Main] Dev server loaded successfully');
    } catch (err) {
      console.error('[Main] Failed to load dev server:', err);
    }
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window immediately - don't wait for ready-to-show in dev
  if (isDev) {
    mainWindow.show();
  } else {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });
  }
  
  // Set up event-driven trading feed forwarding
  setupTradingEventForwarding(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIpcHandlers() {
  // -------------------------------------------------------------------------
  // App Handlers
  // -------------------------------------------------------------------------
  
  // Get app version
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  // Get platform info
  ipcMain.handle('app:getPlatform', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    };
  });

  // Open external URL - with allowlist validation
  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    // Validate URL before opening
    if (typeof url !== 'string') {
      console.error('Invalid URL type:', typeof url);
      return false;
    }
    
    try {
      // Strict allowlist check in production
      if (!isDev && !isAllowedExternalUrl(url)) {
        console.warn('URL not in allowlist:', url);
        return false;
      }
      
      // In dev, allow http/https
      const parsedUrl = new URL(url);
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        await shell.openExternal(url);
        return true;
      }
    } catch {
      console.error('Invalid URL:', url);
    }
    return false;
  });

  // -------------------------------------------------------------------------
  // Agent Configuration Handlers
  // -------------------------------------------------------------------------

  // Get agent configuration summary
  ipcMain.handle('agent:getConfig', () => {
    return getConfigSummary();
  });

  // Get full health status for all agents
  ipcMain.handle('agent:getHealthStatus', async () => {
    return getAllAgentHealthStatus();
  });

  // Get health status for a specific platform
  ipcMain.handle('agent:getPlatformHealth', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    const status = await getAgentHealthStatus(platform);
    return { success: true, data: status };
  });

  // Update agent configuration for a platform
  ipcMain.handle('agent:setConfig', async (_event, platform: unknown, config: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidAgentConfigUpdate(config)) {
      return { success: false, error: 'Invalid configuration' };
    }
    
    try {
      setAgentConfig(platform, config);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save configuration',
      };
    }
  });

  // Reset agent configuration to defaults
  ipcMain.handle('agent:resetConfig', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    
    try {
      resetAgentConfig(platform);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset configuration',
      };
    }
  });

  // Start agent (bundled mode only)
  ipcMain.handle('agent:start', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return manualStartAgent(platform);
  });

  // Stop agent
  ipcMain.handle('agent:stop', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return manualStopAgent(platform);
  });

  // Restart agent
  ipcMain.handle('agent:restart', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return restartAgent(platform);
  });

  // Get agent log file path
  ipcMain.handle('agent:getLogPath', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return { success: true, data: getAgentLogPath(platform) };
  });

  // Check if bundled agent exists
  ipcMain.handle('agent:hasBundled', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return { success: true, data: bundledAgentExists(platform) };
  });

  // Get connected accounts from ZeroMQ (multi-account support)
  ipcMain.handle('agent:getConnectedAccounts', async () => {
    try {
      await debugLog('[getConnectedAccounts] Checking ZeroMQ connections (multi-account)...');
      
      const connectedAccounts: Array<{
        login: string;
        server: string;
        name?: string;
        broker?: string;
        balance?: number;
        equity?: number;
        currency?: string;
        leverage?: number;
        terminalId?: string;
      }> = [];
      
      // Check for existing ZeroMQ connections with live event data
      const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
        id => agentChannelReader.isTerminalConnected(id)
      );
      
      for (const terminalId of zmqTerminals) {
        // First try cached account state from events, then fall back to last known data
        const stats = agentChannelReader.getStats(terminalId);
        const snapshot = agentChannelReader.getLastSnapshot(terminalId);
        
        if (snapshot) {
          await debugLog(`[getConnectedAccounts] Found ZMQ account: ${snapshot.accountId} @ ${snapshot.broker} (${terminalId}, events: ${stats?.eventsReceived ?? 0})`);
          connectedAccounts.push({
            login: String(snapshot.accountId),
            server: snapshot.server || snapshot.broker || 'Unknown',
            name: String(snapshot.accountId),
            broker: snapshot.broker,
            balance: snapshot.balance,
            equity: snapshot.equity,
            currency: snapshot.currency,
            leverage: snapshot.leverage,
            terminalId: terminalId,
          });
        } else if (stats && stats.eventsReceived > 0) {
          // Bridge received events but no structured data yet - still a valid connection
          await debugLog(`[getConnectedAccounts] ZMQ connection alive on ${terminalId} (events: ${stats.eventsReceived}, awaiting data)`);
          connectedAccounts.push({
            login: '0',
            server: 'Connecting...',
            name: terminalId,
            terminalId: terminalId,
          });
        }
      }
      
      // Try to scan all port ranges if no existing connections
      if (connectedAccounts.length === 0) {
        await debugLog('[getConnectedAccounts] No existing ZMQ connections, scanning all port ranges...');
        const connectedTerminals = await agentChannelReader.scanAndConnectAllMT5Terminals();
        
        for (const terminalId of connectedTerminals) {
          const snapshot = agentChannelReader.getLastSnapshot(terminalId);
          const stats = agentChannelReader.getStats(terminalId);
          
          if (snapshot) {
            await debugLog(`[getConnectedAccounts] Found ZMQ account after scan: ${snapshot.accountId} @ ${snapshot.broker} (events: ${stats?.eventsReceived ?? 0})`);
            connectedAccounts.push({
              login: String(snapshot.accountId),
              server: snapshot.server || snapshot.broker || 'Unknown',
              name: String(snapshot.accountId),
              broker: snapshot.broker,
              balance: snapshot.balance,
              equity: snapshot.equity,
              currency: snapshot.currency,
              leverage: snapshot.leverage,
              terminalId: terminalId,
            });
          } else if (stats && stats.eventsReceived > 0) {
            await debugLog(`[getConnectedAccounts] ZMQ connection alive after scan on ${terminalId} (events: ${stats.eventsReceived})`);
            connectedAccounts.push({
              login: '0',
              server: 'Connecting...',
              name: terminalId,
              terminalId: terminalId,
            });
          }
        }
      }
      
      await debugLog(`[getConnectedAccounts] Returning ${connectedAccounts.length} accounts`);
      return { 
        success: true, 
        data: connectedAccounts 
      };
    } catch (error) {
      await debugLog(`[getConnectedAccounts] Error: ${error}`);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error getting connected accounts' 
      };
    }
  });

  // -------------------------------------------------------------------------
  // Trading Bridge Handlers (with validation)
  // -------------------------------------------------------------------------

  // Get terminal status
  // MT5: ZeroMQ only | cTrader: Named Pipes
  ipcMain.handle('trading:getStatus', async (_event, platform: unknown) => {
    // Wrap in safe serialization to prevent IPC DataCloneError
    const getStatusInternal = async () => {
      if (!isValidPlatform(platform)) {
        return { success: false, error: 'Invalid platform' };
      }
      
      try {
        // MT5: Check ZeroMQ first (PRIMARY)
        if (platform === 'mt5') {
          // Check for active ZeroMQ connections
          const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
            id => agentChannelReader.isTerminalConnected(id)
          );
          
          if (zmqTerminals.length > 0) {
            const stats = agentChannelReader.getStats(zmqTerminals[0]);
            return {
              success: true,
              data: {
                connected: true,
                platform,
                terminalRunning: true,
                zmqMode: true,
                zmqConnected: true,
                eventsReceived: stats?.eventsReceived || 0,
                lastHeartbeat: new Date().toISOString(),
              },
            };
          }
          
          // Try to discover via auto-port scan
          const discovered = await agentChannelReader.scanAndConnectAllMT5Terminals();
          
          if (discovered.length > 0) {
            return {
              success: true,
              data: {
                connected: true,
                platform,
                terminalRunning: true,
                zmqMode: true,
                zmqConnected: true,
                terminalsFound: discovered.length,
                lastHeartbeat: new Date().toISOString(),
              },
            };
          }
          
          // ZeroMQ connection failed - EA not running
          return {
            success: true,
            data: {
              connected: false,
              platform,
              terminalRunning: false,
              zmqMode: false,
              zmqConnected: false,
              error: 'HedgeEdgeZMQ EA not running. Attach the EA to a chart in MT5.',
            },
          };
        }
        
        // cTrader: Use agent API
        const config = getAgentConfig();
        const platformConfig = config[platform];
        const isLocalAgent = platformConfig.endpoint.host === '127.0.0.1' || platformConfig.endpoint.host === 'localhost';
        
        // Only do local port check for bundled/local agents
        // For external agents on remote hosts, skip directly to health check
        if (isLocalAgent) {
          const port = getAgentPort(platform);
          const portAvailable = await isPortAvailable(port);
          
          if (portAvailable) {
            return {
              success: true,
              data: {
                connected: false,
                platform,
                terminalRunning: false,
                error: 'Trading agent not running',
              },
            };
          }
        }
        
        // Try to get health from agent (uses configured host via agentRequest)
        const result = await agentRequest<any>(platform, '/health');
        
        if (result.success) {
          return {
            success: true,
            data: {
              connected: result.data?.mt5_connected || result.data?.ctrader_connected || false,
              platform,
              terminalRunning: true,
              lastHeartbeat: new Date().toISOString(),
            },
          };
        }
        
        return {
          success: true,
          data: {
            connected: false,
            platform,
            terminalRunning: true,
            error: result.error,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get status',
        };
      }
    };
    
    // Execute and safely serialize to prevent IPC DataCloneError
    try {
      const result = await getStatusInternal();
      return safeSerializeForIPC(result);
    } catch (err) {
      console.error('[Main] getStatus unexpected error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unexpected error' };
    }
  });

  // Validate credentials (with payload validation)
  ipcMain.handle('trading:validateCredentials', async (
    _event,
    platform: unknown,
    credentials: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    
    // For MT5, validate via ZeroMQ snapshot
    if (platform === 'mt5') {
      // Check for active ZeroMQ connections
      const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
        id => agentChannelReader.isTerminalConnected(id)
      );
      
      for (const terminalId of zmqTerminals) {
        const snapshot = agentChannelReader.getLastSnapshot(terminalId);
        if (snapshot && String(snapshot.accountId) === String(credentials.login)) {
          console.log('[Main] Validated MT5 credentials via ZeroMQ for account:', credentials.login);
          return { success: true, data: { valid: true } };
        }
      }
      
      // Try to discover via auto-port scan if not connected
      if (zmqTerminals.length === 0) {
        const discovered = await agentChannelReader.scanAndConnectAllMT5Terminals();
        
        for (const tid of discovered) {
          const snapshot = agentChannelReader.getLastSnapshot(tid);
          if (snapshot && String(snapshot.accountId) === String(credentials.login)) {
            console.log('[Main] Validated MT5 credentials via auto-discovery:', credentials.login);
            return { success: true, data: { valid: true } };
          }
        }
      }
      
      return { 
        success: false, 
        error: 'MT5 not connected. Make sure HedgeEdgeZMQ EA is running on the account.' 
      };
    }
    
    // NOTE: Password is never stored at rest - only passed through to agent
    return agentRequest(platform, '/api/validate', 'POST', credentials);
  });

  // Get account snapshot (with payload validation)
  // ZeroMQ ONLY for MT5
  ipcMain.handle('trading:getSnapshot', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    // Wrap entire handler in safe serialization to prevent DataCloneError
    const getSnapshotInternal = async () => {
      if (!isValidPlatform(platform)) {
        return { success: false, error: 'Invalid platform' };
      }
      if (credentials !== undefined && !isValidCredentials(credentials)) {
        return { success: false, error: 'Invalid credentials format' };
      }
    
    // For MT5 - ZeroMQ is PRIMARY
    if (platform === 'mt5') {
      // First, check if we have an active ZeroMQ connection
      const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
        id => agentChannelReader.isTerminalUsingZmq(id)
      );
      
      // Try ZeroMQ connection first (if available)
      if (zmqTerminals.length > 0) {
        for (const terminalId of zmqTerminals) {
          const snapshot = agentChannelReader.getLastSnapshot(terminalId);
          if (snapshot) {
            // Match by terminalId first (most reliable for multi-account)
            // Or match by broker if server matches
            // Or match by accountId if it's not "0"
            if (credentials) {
              const creds = credentials as { login: string; server: string; terminalId?: string };
              
              // If terminalId is provided, match by that (most reliable)
              if (creds.terminalId && creds.terminalId !== terminalId) {
                continue;
              }
              
              // If no terminalId, try to match by broker/server
              if (!creds.terminalId) {
                const serverMatch = snapshot.broker === creds.server || snapshot.server === creds.server;
                const accountMatch = snapshot.accountId && snapshot.accountId !== '0' && String(snapshot.accountId) === String(creds.login);
                
                // Skip if neither server nor accountId match
                if (!serverMatch && !accountMatch) {
                  continue;
                }
              }
            }
            
            return {
              success: true,
              data: {
                balance: snapshot.balance,
                equity: snapshot.equity,
                margin: snapshot.margin,
                freeMargin: snapshot.freeMargin,
                marginLevel: snapshot.marginLevel,
                profit: snapshot.floatingPnL,
                currency: snapshot.currency,
                leverage: snapshot.leverage,
                accountId: snapshot.accountId,
                broker: snapshot.broker,
                server: snapshot.server || '',
                terminalId: terminalId, // Include terminalId for routing
                positions: (snapshot.positions || []).map((p: any) => ({
                  ticket: parseInt(p.id) || 0,
                  symbol: p.symbol,
                  type: p.side === 'BUY' ? 0 : 1,
                  volume: p.volumeLots,
                  openPrice: p.entryPrice,
                  currentPrice: p.currentPrice,
                  stopLoss: p.stopLoss || 0,
                  takeProfit: p.takeProfit || 0,
                  profit: p.profit,
                  swap: p.swap,
                  commission: p.commission,
                  openTime: p.openTime,
                  comment: p.comment || '',
                })),
                timestamp: snapshot.timestamp,
                zmqMode: true, // Indicate ZMQ mode
              },
            };
          }
        }
      }
      
      // No active ZMQ connections with matching data
      // The startup scan (autoReconnectFromZMQ) should establish connections
      // ZeroMQ connection not available - no MT5 data available
      return {
        success: false,
        error: 'MT5 not connected. Make sure HedgeEdgeZMQ EA is attached to a chart in MT5.',
      };
    }
    
    // Only try agentRequest for cTrader or if explicitly configured
    if (platform === 'ctrader') {
      if (credentials) {
        return agentRequest(platform, '/api/account/snapshot', 'POST', credentials);
      }
      return agentRequest(platform, '/api/snapshot');
    }
    
    // Unknown platform
    return {
      success: false,
      error: `Unsupported platform: ${platform}`,
    };
    };
    
    // Execute and safely serialize to prevent IPC DataCloneError
    try {
      const result = await getSnapshotInternal();
      return safeSerializeForIPC(result);
    } catch (err) {
      console.error('[Main] getSnapshot unexpected error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unexpected error' };
    }
  });

  // Get balance (with payload validation)
  ipcMain.handle('trading:getBalance', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    if (credentials) {
      return agentRequest(platform, '/api/account/balance', 'POST', credentials);
    }
    return agentRequest(platform, '/api/balance');
  });

  // Get positions (with payload validation)
  ipcMain.handle('trading:getPositions', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    if (credentials) {
      return agentRequest(platform, '/api/account/positions', 'POST', credentials);
    }
    return agentRequest(platform, '/api/positions');
  });

  // Get tick (with payload validation)
  ipcMain.handle('trading:getTick', async (
    _event,
    platform: unknown,
    symbol: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (typeof symbol !== 'string' || symbol.length === 0) {
      return { success: false, error: 'Invalid symbol' };
    }
    return agentRequest(platform, `/api/tick?symbol=${encodeURIComponent(symbol)}`);
  });

  // Get symbols (with payload validation)
  ipcMain.handle('trading:getSymbols', async (
    _event,
    platform: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return agentRequest(platform, '/api/symbols');
  });

  // Place order (with payload validation)
  ipcMain.handle('trading:placeOrder', async (
    _event,
    platform: unknown,
    order: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidOrderRequest(order)) {
      return { success: false, error: 'Invalid order request' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    const body = credentials ? { ...order, ...credentials } : order;
    return agentRequest(platform, '/api/order', 'POST', body);
  });

  // Close order (with payload validation)
  ipcMain.handle('trading:closeOrder', async (
    _event,
    platform: unknown,
    request: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidCloseOrderRequest(request)) {
      return { success: false, error: 'Invalid close order request' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    const body = credentials ? { ...request, ...credentials } : request;
    return agentRequest(platform, '/api/order/close', 'POST', body);
  });

  // -------------------------------------------------------------------------
  // Secure Storage Handlers (using Electron safeStorage)
  // -------------------------------------------------------------------------

  // Check if secure storage encryption is available
  ipcMain.handle('secureStorage:isAvailable', () => {
    return safeStorage.isEncryptionAvailable();
  });

  // Encrypt a string using OS keychain
  ipcMain.handle('secureStorage:encrypt', (_event, plainText: unknown) => {
    if (typeof plainText !== 'string') {
      return { success: false, error: 'Invalid input: expected string' };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'Secure storage not available on this system' };
    }
    try {
      const encrypted = safeStorage.encryptString(plainText);
      // Return as base64 for safe JSON transmission
      return { success: true, data: encrypted.toString('base64') };
    } catch (error) {
      return { success: false, error: `Encryption failed: ${error}` };
    }
  });

  // Decrypt a string using OS keychain
  ipcMain.handle('secureStorage:decrypt', (_event, encryptedBase64: unknown) => {
    if (typeof encryptedBase64 !== 'string') {
      return { success: false, error: 'Invalid input: expected base64 string' };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'Secure storage not available on this system' };
    }
    try {
      const encrypted = Buffer.from(encryptedBase64, 'base64');
      const decrypted = safeStorage.decryptString(encrypted);
      return { success: true, data: decrypted };
    } catch (error) {
      return { success: false, error: `Decryption failed: ${error}` };
    }
  });

  // -------------------------------------------------------------------------
  // Terminal Detection Handlers
  // -------------------------------------------------------------------------

  // Detect installed trading terminals (MT4/MT5/cTrader)
  ipcMain.handle('terminals:detect', async () => {
    return detectTerminals();
  });

  // Deep scan for terminals (SLOW - scans entire system)
  ipcMain.handle('terminals:detectDeep', async () => {
    return detectTerminalsDeep();
  });

  // Launch a terminal by executable path, optionally with credentials
  ipcMain.handle('terminals:launch', async (_event, executablePath: unknown, credentials?: unknown) => {
    if (typeof executablePath !== 'string' || !executablePath) {
      return { success: false, error: 'Invalid executable path' };
    }
    // Parse credentials if provided
    let creds: { login?: string; password?: string; server?: string } | undefined;
    if (credentials && typeof credentials === 'object') {
      const c = credentials as Record<string, unknown>;
      creds = {
        login: typeof c.login === 'string' ? c.login : undefined,
        password: typeof c.password === 'string' ? c.password : undefined,
        server: typeof c.server === 'string' ? c.server : undefined,
      };
    }
    return launchTerminal(executablePath, creds);
  });

  // -------------------------------------------------------------------------
  // ZeroMQ Bridge Handlers (High-Performance Mode)
  // -------------------------------------------------------------------------

  // Check if ZeroMQ is available
  ipcMain.handle('zmq:isAvailable', async () => {
    return { success: true, available: agentChannelReader.isZmqAvailable() };
  });

  // Register terminal with ZMQ mode
  ipcMain.handle('zmq:registerTerminal', async (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      return { success: false, error: 'Invalid parameters' };
    }

    const p = params as Record<string, unknown>;
    const terminalId = typeof p.terminalId === 'string' ? p.terminalId : '';
    const dataPort = typeof p.dataPort === 'number' ? p.dataPort : undefined;
    const commandPort = typeof p.commandPort === 'number' ? p.commandPort : undefined;
    const host = typeof p.host === 'string' ? p.host : '127.0.0.1';

    if (!terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      const success = await agentChannelReader.registerMT5TerminalZmq(terminalId, {
        dataPort,
        commandPort,
        host,
      });

      return { 
        success, 
        mode: agentChannelReader.getTerminalMode(terminalId),
        error: success ? undefined : 'Failed to connect ZeroMQ. Make sure HedgeEdgeZMQ EA is running.',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register terminal',
      };
    }
  });

  // Get terminal communication mode
  ipcMain.handle('zmq:getTerminalMode', (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    const mode = agentChannelReader.getTerminalMode(terminalId);
    return { success: true, mode };
  });

  // Get ZMQ connection stats
  ipcMain.handle('zmq:getStats', (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    const stats = agentChannelReader.getStats(terminalId);
    return { success: true, stats };
  });

  // Ping terminal via ZMQ or file mode
  ipcMain.handle('zmq:ping', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    try {
      const alive = await agentChannelReader.ping(terminalId);
      return { success: true, alive };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ping failed' };
    }
  });

  // Send command via best available method (ZMQ or file)
  ipcMain.handle('zmq:sendCommand', async (_event, terminalId: unknown, command: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    if (!command || typeof command !== 'object') {
      return { success: false, error: 'Invalid command' };
    }

    try {
      const cmd = command as AgentCommand;
      return await agentChannelReader.sendCommand(terminalId, cmd);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
      };
    }
  });

  // Pause trading via ZMQ
  ipcMain.handle('zmq:pause', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    return agentChannelReader.pause(terminalId);
  });

  // Resume trading via ZMQ
  ipcMain.handle('zmq:resume', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    return agentChannelReader.resume(terminalId);
  });

  // Close all positions via ZMQ
  ipcMain.handle('zmq:closeAll', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    return agentChannelReader.closeAll(terminalId);
  });

  // Close specific position via ZMQ
  ipcMain.handle('zmq:closePosition', async (_event, terminalId: unknown, positionId: unknown) => {
    if (typeof terminalId !== 'string' || typeof positionId !== 'string') {
      return { success: false, error: 'Invalid parameters' };
    }
    return agentChannelReader.closePosition(terminalId, positionId);
  });

  // Unregister terminal
  ipcMain.handle('zmq:unregisterTerminal', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    await agentChannelReader.unregisterTerminal(terminalId);
    return { success: true };
  });

  // -------------------------------------------------------------------------
  // Event-Driven Trading Feed Subscription Handlers
  // -------------------------------------------------------------------------
  
  // Subscribe to trading events (real-time event stream from MT5 EA)
  // Returns immediately - events are pushed via 'trading:event' messages
  ipcMain.handle('trading:subscribeEvents', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    
    // Make sure we're connected
    if (!agentChannelReader.isTerminalConnected(terminalId)) {
      // Try to connect
      const connected = await agentChannelReader.connectMT5(terminalId);
      if (!connected) {
        return { success: false, error: 'Failed to connect to MT5 terminal' };
      }
    }
    
    return { success: true, message: 'Subscribed to trading events. Listen for trading:event messages.' };
  });
  
  // Get cached account state (event-driven alternative to polling getSnapshot)
  ipcMain.handle('trading:getCachedState', (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }
    
    const snapshot = agentChannelReader.getLastSnapshot(terminalId);
    if (snapshot) {
      return { success: true, data: safeSerializeForIPC(snapshot) };
    }
    return { success: false, error: 'No cached state available' };
  });

  // -------------------------------------------------------------------------
  // Connection Management Handlers
  // -------------------------------------------------------------------------

  // List all connection snapshots (with ZeroMQ health check)
  ipcMain.handle('connections:list', async () => {
    // Check ZeroMQ health before returning snapshots
    // This ensures the UI reflects actual connection state
    await checkZMQHealthForAllSessions();
    return safeSerializeForIPC(buildAllSnapshots());
  });

  // Connect an account
  ipcMain.handle('connections:connect', async (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      return { success: false, error: 'Invalid parameters' };
    }
    
    const p = params as Record<string, unknown>;
    
    // Validate required fields
    if (typeof p.accountId !== 'string' || !p.accountId) {
      return { success: false, error: 'Account ID is required' };
    }
    
    const credentials = p.credentials as Record<string, unknown> | undefined;
    if (!credentials || typeof credentials.login !== 'string' || typeof credentials.server !== 'string') {
      return { success: false, error: 'Valid credentials (login, server) are required' };
    }
    
    const platform = (p.platform as string) || 'mt5';
    if (!['mt5', 'ctrader'].includes(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    
    const role = (p.role as string) || 'local';
    if (!['local', 'vps', 'cloud'].includes(role)) {
      return { success: false, error: 'Invalid role' };
    }

    return connectAccount({
      accountId: p.accountId,
      platform: platform as ConnectionPlatform,
      role: role as ConnectionRole,
      credentials: {
        login: credentials.login as string,
        password: (credentials.password as string) || '',
        server: credentials.server as string,
      },
      endpoint: p.endpoint as ConnectionEndpoint | undefined,
      autoReconnect: p.autoReconnect as boolean | undefined,
    });
  });

  // Disconnect an account
  ipcMain.handle('connections:disconnect', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      return { success: false, error: 'Invalid parameters' };
    }
    
    const p = params as Record<string, unknown>;
    if (typeof p.accountId !== 'string' || !p.accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    return disconnectAccount(p.accountId, p.reason as string | undefined);
  });

  // Get status for a specific account
  ipcMain.handle('connections:status', (_event, accountId: unknown) => {
    if (typeof accountId !== 'string' || !accountId) {
      return null;
    }
    return safeSerializeForIPC(buildSnapshot(accountId));
  });

  // Refresh connection data for an account
  ipcMain.handle('connections:refresh', async (_event, accountId: unknown) => {
    if (typeof accountId !== 'string' || !accountId) {
      return { success: false, error: 'Account ID is required' };
    }
    
    const session = connectionSessions.get(accountId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    if (session.status !== 'connected') {
      return { success: false, error: 'Account not connected' };
    }
    
    try {
      // Read from ZMQ cache (no network calls needed)
      refreshAllSessionsFromCache();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to refresh' 
      };
    }
  });

  // Manual refresh all accounts from cached ZMQ data + push to renderer immediately
  ipcMain.handle('connections:manualRefreshAll', async () => {
    console.log('[Main] Manual refresh triggered by user');
    try {
      refreshAllSessionsFromCache();
      // Push updated snapshots to renderer immediately
      if (mainWindow && !mainWindow.isDestroyed()) {
        pushConnectionUpdate(mainWindow);
      }
      return safeSerializeForIPC({ 
        success: true, 
        snapshots: buildAllSnapshots(),
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Refresh failed' };
    }
  });

  // Scan for running EAs and auto-reconnect accounts
  ipcMain.handle('connections:reconnect', async () => {
    console.log('[Main] Manual reconnect triggered');
    try {
      await autoReconnectFromZMQ();
      return { 
        success: true, 
        sessionsCount: connectionSessions.size,
        connectedCount: Array.from(connectionSessions.values()).filter(s => s.status === 'connected').length,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Reconnect failed' 
      };
    }
  });

  // Refresh connection data from ZeroMQ
  ipcMain.handle('connections:refreshFromEA', async (_event, accountId: unknown) => {
    if (typeof accountId !== 'string' || !accountId) {
      return { success: false, error: 'Account ID is required' };
    }
    
    const session = connectionSessions.get(accountId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    // Try to refresh from ZeroMQ
    if (session.platform === 'mt5') {
      try {
        // Check existing ZeroMQ connections
        const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
          id => agentChannelReader.isTerminalConnected(id)
        );
        
        for (const terminalId of zmqTerminals) {
          const snapshot = agentChannelReader.getLastSnapshot(terminalId);
          if (snapshot && String(snapshot.accountId) === String(session._credentials?.login || accountId)) {
            // Track timestamp for health checking
            lastEADataTimestamp.set(accountId, new Date());
            
            // Update metrics
            const metrics: ConnectionMetrics = {
              balance: snapshot.balance ?? 0,
              equity: snapshot.equity ?? 0,
              profit: snapshot.floatingPnL ?? 0,
              positionCount: snapshot.positions?.length ?? 0,
              margin: snapshot.margin,
              freeMargin: snapshot.freeMargin,
              marginLevel: snapshot.marginLevel,
            };
            connectionMetrics.set(accountId, metrics);
            
            // Update session status
            session.status = 'connected';
            session.lastUpdate = new Date().toISOString();
            session.error = undefined;
            connectionSessions.set(accountId, session);
            
            // Update positions
            if (snapshot.positions) {
              const positions: ConnectionPosition[] = snapshot.positions.map((p: any) => ({
                ticket: parseInt(p.id) || 0,
                symbol: p.symbol,
                type: p.side === 'BUY' ? 'buy' : 'sell',
                volume: p.volumeLots,
                openPrice: p.entryPrice,
                currentPrice: p.currentPrice,
                profit: p.profit,
                stopLoss: p.stopLoss,
                takeProfit: p.takeProfit,
                openTime: p.openTime || new Date().toISOString(),
                magic: 0,
                comment: p.comment || '',
              }));
              connectionPositions.set(accountId, positions);
            }
            
            return { success: true };
          }
        }
        
        // Try to reconnect via auto-port scan
        const discovered = await agentChannelReader.scanAndConnectAllMT5Terminals();
        
        for (const tid of discovered) {
          const disc = agentChannelReader.getLastSnapshot(tid);
          if (disc && String(disc.accountId) === String(accountId)) {
            lastEADataTimestamp.set(accountId, new Date());
            session.status = 'connected';
            session._terminalId = tid;
            session.lastUpdate = new Date().toISOString();
            connectionSessions.set(accountId, session);
            return { success: true };
          }
        }
        
        // ZeroMQ connection not found
        session.status = 'error';
        session.error = 'HedgeEdgeZMQ EA not running';
        session.lastUpdate = new Date().toISOString();
        connectionSessions.set(accountId, session);
        
        return { success: false, error: 'HedgeEdgeZMQ EA not running' };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to refresh from ZeroMQ' 
        };
      }
    }
    
    // For cTrader, use the regular refresh
    try {
      await fetchSessionMetrics(accountId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to refresh' 
      };
    }
  });

  // -------------------------------------------------------------------------
  // License Management Handlers (Enhanced with LicenseManager)
  // -------------------------------------------------------------------------

  // Get current license status (enhanced with device info)
  ipcMain.handle('license:getStatus', async () => {
    try {
      const status = licenseManager.getLicenseStatus();
      const devices = await licenseManager.getRegisteredDevices();
      const connectedAgents = licenseManager.getConnectedAgents();
      
      return {
        success: true,
        data: {
          ...status,
          deviceId: licenseManager.getDeviceId(),
          devices,
          connectedAgents: connectedAgents.length,
          secureStorage: licenseStore.isEncryptionAvailable(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get license status',
      };
    }
  });

  // Validate license key (uses LicenseManager for caching and token management)
  ipcMain.handle('license:validate', async (_event, licenseKey: unknown, deviceId?: unknown, platform?: unknown) => {
    if (typeof licenseKey !== 'string' || !licenseKey.trim()) {
      return { success: false, error: 'License key is required' };
    }

    try {
      const result = await licenseManager.validateLicense(
        licenseKey.trim(),
        typeof deviceId === 'string' ? deviceId : undefined,
        typeof platform === 'string' ? platform : 'desktop'
      );
      
      return {
        success: result.valid,
        data: result,
        error: result.valid ? undefined : result.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  });

  // Validate and activate license key (legacy support + enhanced)
  ipcMain.handle('license:activate', async (_event, licenseKey: unknown) => {
    if (typeof licenseKey !== 'string' || !licenseKey.trim()) {
      return { success: false, error: 'License key is required' };
    }

    try {
      const result = await licenseManager.validateLicense(licenseKey.trim());
      
      if (result.valid) {
        return { success: true, license: licenseManager.getLicenseStatus() };
      } else {
        return { success: false, error: result.message };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Activation failed',
      };
    }
  });

  // Refresh license status
  ipcMain.handle('license:refresh', async () => {
    try {
      const result = await licenseManager.refreshLicense();
      
      if (result.success) {
        return { success: true, license: result.info };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
      };
    }
  });

  // Remove license
  ipcMain.handle('license:remove', async () => {
    try {
      await licenseStore.remove();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove license',
      };
    }
  });

  // Check if secure storage is available
  ipcMain.handle('license:isSecureStorageAvailable', () => {
    return { success: true, data: licenseStore.isEncryptionAvailable() };
  });

  // Get registered devices for the license
  ipcMain.handle('license:devices', async () => {
    try {
      const devices = await licenseManager.getRegisteredDevices();
      return { success: true, data: devices };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get devices',
      };
    }
  });

  // Deactivate a device from the license
  ipcMain.handle('license:deactivate', async (_event, deviceId: unknown) => {
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return { success: false, error: 'Device ID is required' };
    }

    try {
      const licenseKey = licenseStore.getLicenseKey();
      if (!licenseKey) {
        return { success: false, error: 'No license configured' };
      }

      const success = await licenseManager.deactivateDevice(licenseKey, deviceId.trim());
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deactivation failed',
      };
    }
  });

  // Get current device ID
  ipcMain.handle('license:getDeviceId', () => {
    return { success: true, data: licenseManager.getDeviceId() };
  });

  // Get connected agents
  ipcMain.handle('license:getConnectedAgents', () => {
    try {
      const agents = licenseManager.getConnectedAgents();
      return { success: true, data: agents };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agents',
      };
    }
  });

  // -------------------------------------------------------------------------
  // WebRequest Proxy Management
  // -------------------------------------------------------------------------

  // Start WebRequest proxy server
  ipcMain.handle('proxy:start', async () => {
    try {
      const success = await webRequestProxy.start();
      return { success, data: webRequestProxy.getStatus() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start proxy',
      };
    }
  });

  // Stop WebRequest proxy server
  ipcMain.handle('proxy:stop', async () => {
    try {
      await webRequestProxy.stop();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop proxy',
      };
    }
  });

  // Get proxy status
  ipcMain.handle('proxy:status', () => {
    return { success: true, data: webRequestProxy.getStatus() };
  });

  // -------------------------------------------------------------------------
  // MT5 WebRequest Whitelist Handlers
  // -------------------------------------------------------------------------

  // Check WebRequest whitelist status
  ipcMain.handle('mt5:checkWhitelist', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      const detectionResult = await detectTerminals();
      const terminal = detectionResult.terminals.find(t => t.id === terminalId);
      if (!terminal) {
        return { success: false, error: 'Terminal not found' };
      }

      const dataPath = terminal.dataPath || terminal.installPath;
      const status = await checkWebRequestWhitelist(dataPath, HEDGE_EDGE_API_URL);
      
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Check failed',
      };
    }
  });

  // Add URL to WebRequest whitelist
  ipcMain.handle('mt5:addToWhitelist', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      const detectionResult = await detectTerminals();
      const terminal = detectionResult.terminals.find(t => t.id === terminalId);
      if (!terminal) {
        return { success: false, error: 'Terminal not found' };
      }

      const dataPath = terminal.dataPath || terminal.installPath;
      const result = await addToWebRequestWhitelist(dataPath, HEDGE_EDGE_API_URL);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add to whitelist',
      };
    }
  });

  // -------------------------------------------------------------------------
  // Agent Data Channel Handlers
  // -------------------------------------------------------------------------

  // Read agent snapshot from ZeroMQ or Named Pipe
  ipcMain.handle('agent:readSnapshot', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      // For MT5, use ZeroMQ
      if (terminalId.startsWith('mt5') || terminalId.includes('mt5')) {
        // Check existing ZeroMQ connections
        const zmqTerminals = agentChannelReader.getMT5Terminals().filter(
          id => agentChannelReader.isTerminalConnected(id)
        );
        
        for (const tid of zmqTerminals) {
          const snapshot = agentChannelReader.getLastSnapshot(tid);
          if (snapshot) {
            return { success: true, data: snapshot };
          }
        }
        
        // Try to discover via auto-port scan
        const discovered = await agentChannelReader.scanAndConnectAllMT5Terminals();
        
        for (const tid of discovered) {
          const snapshot = agentChannelReader.getLastSnapshot(tid);
          if (snapshot) {
            return { success: true, data: snapshot };
          }
        }
        
        return { success: false, error: 'HedgeEdgeZMQ EA not running' };
      }
      
      // For cTrader, use named pipe
      const result = await readCTraderSnapshot();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read snapshot',
      };
    }
  });

  // Send command to agent
  ipcMain.handle('agent:sendCommand', async (
    _event,
    terminalId: unknown,
    command: unknown
  ) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }
    if (!command || typeof command !== 'object') {
      return { success: false, error: 'Command is required' };
    }

    try {
      const detectionResult = await detectTerminals();
      const terminal = detectionResult.terminals.find(t => t.id === terminalId);
      if (!terminal) {
        return { success: false, error: 'Terminal not found' };
      }

      const dataPath = terminal.dataPath || terminal.installPath;
      const cmd = command as AgentCommand;
      
      if (terminal.type === 'mt5' || terminal.type === 'mt4') {
        return sendMT5Command(dataPath, cmd);
      } else if (terminal.type === 'ctrader') {
        return sendCTraderCommand(cmd);
      }
      
      return { success: false, error: 'Unsupported terminal type' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send command',
      };
    }
  });

  // -------------------------------------------------------------------------
  // EA/DLL/cBot Installer Handlers
  // -------------------------------------------------------------------------

  // Get paths to bundled assets
  function getAssetPaths(): {
    mt4EaPath: string;
    mt4DllPath: string;
    mt5EaPath: string;
    mt5DllPath: string;
    ctraderCbotPath: string;
    assetsDir: string;
  } {
    // In development, assets are in the project's agents folder
    // In production, they're bundled with the app
    const assetsDir = isDev
      ? path.join(__dirname, '../../agents')
      : path.join(process.resourcesPath, 'agents');
    
    return {
      assetsDir,
      mt4EaPath: path.join(assetsDir, 'mt4', 'HedgeEdge.ex4'),
      mt4DllPath: path.join(assetsDir, 'mt4', 'HedgeEdgeBridge.dll'),
      mt5EaPath: path.join(assetsDir, 'mt5', 'HedgeEdge.ex5'),
      mt5DllPath: path.join(assetsDir, 'mt5', 'HedgeEdgeBridge.dll'),
      ctraderCbotPath: path.join(assetsDir, 'ctrader', 'HedgeEdge.algo'),
    };
  }

  // Check if assets exist
  async function checkAssetsExist(terminalType: 'mt4' | 'mt5' | 'ctrader'): Promise<boolean> {
    const { existsSync } = await import('fs');
    const paths = getAssetPaths();
    
    switch (terminalType) {
      case 'mt4':
        return existsSync(paths.mt4EaPath) && existsSync(paths.mt4DllPath);
      case 'mt5':
        return existsSync(paths.mt5EaPath) && existsSync(paths.mt5DllPath);
      case 'ctrader':
        return existsSync(paths.ctraderCbotPath);
      default:
        return false;
    }
  }

  // Calculate file hash for verification
  async function calculateFileHash(filePath: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    const content = await readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Verify installed file
  async function verifyInstalledFile(
    sourcePath: string,
    targetPath: string
  ): Promise<{ verified: boolean; error?: string }> {
    const { existsSync } = await import('fs');
    
    if (!existsSync(targetPath)) {
      return { verified: false, error: 'Target file not found' };
    }
    
    try {
      const sourceHash = await calculateFileHash(sourcePath);
      const targetHash = await calculateFileHash(targetPath);
      
      if (sourceHash === targetHash) {
        return { verified: true };
      } else {
        return { verified: false, error: 'File hash mismatch' };
      }
    } catch (error) {
      return { 
        verified: false, 
        error: error instanceof Error ? error.message : 'Verification failed' 
      };
    }
  }

  // Run installation prechecks
  ipcMain.handle('installer:precheck', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      // Get terminal info from detection
      const detectionResult = await detectTerminals();
      if (!detectionResult.success) {
        return { success: false, error: 'Failed to detect terminals' };
      }

      const terminal = detectionResult.terminals.find(t => t.id === terminalId);
      if (!terminal) {
        return { success: false, error: 'Terminal not found' };
      }

      const terminalType = terminal.type as 'mt4' | 'mt5' | 'ctrader';
      const { accessSync, constants } = await import('fs');
      
      // Check if data folder is writable
      let dataFolderWritable = false;
      try {
        const dataPath = terminal.dataPath || terminal.installPath;
        accessSync(dataPath, constants.W_OK);
        dataFolderWritable = true;
      } catch {
        dataFolderWritable = false;
      }

      // Check if assets are available
      const assetsAvailable = await checkAssetsExist(terminalType);

      const precheck = {
        passed: true,
        checks: {
          terminalInstalled: true,
          terminalClosed: !terminal.isRunning,
          dataFolderWritable,
          assetsAvailable,
        },
        messages: [] as string[],
      };

      // Build messages for failed checks
      if (terminal.isRunning) {
        precheck.messages.push('Terminal is running. Please close it before installing.');
        precheck.passed = false;
      }
      if (!dataFolderWritable) {
        precheck.messages.push('Cannot write to terminal data folder. Check permissions.');
        precheck.passed = false;
      }
      if (!assetsAvailable) {
        precheck.messages.push('Installation files not found. Please re-download the application.');
        precheck.passed = false;
      }

      return { success: true, data: precheck };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Precheck failed',
      };
    }
  });

  // Install a single asset with verification
  ipcMain.handle('installer:installAsset', async (
    _event,
    terminalId: unknown,
    assetType: unknown
  ) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }
    if (typeof assetType !== 'string') {
      return { success: false, error: 'Asset type is required' };
    }

    try {
      const { copyFileSync, mkdirSync, existsSync } = await import('fs');
      
      // Get terminal info
      const detectionResult = await detectTerminals();
      const terminal = detectionResult.terminals.find(t => t.id === terminalId);
      if (!terminal) {
        return { success: false, error: 'Terminal not found' };
      }

      const dataPath = terminal.dataPath || terminal.installPath;
      const paths = getAssetPaths();

      let sourcePath: string;
      let targetDir: string;
      let fileName: string;

      switch (assetType) {
        case 'mt4-ea':
          sourcePath = paths.mt4EaPath;
          targetDir = path.join(dataPath, 'MQL4', 'Experts');
          fileName = 'HedgeEdge.ex4';
          break;
        case 'mt4-dll':
          sourcePath = paths.mt4DllPath;
          targetDir = path.join(dataPath, 'MQL4', 'Libraries');
          fileName = 'HedgeEdgeBridge.dll';
          break;
        case 'mt5-ea':
          sourcePath = paths.mt5EaPath;
          targetDir = path.join(dataPath, 'MQL5', 'Experts');
          fileName = 'HedgeEdge.ex5';
          break;
        case 'mt5-dll':
          sourcePath = paths.mt5DllPath;
          targetDir = path.join(dataPath, 'MQL5', 'Libraries');
          fileName = 'HedgeEdgeBridge.dll';
          break;
        case 'ctrader-cbot':
          sourcePath = paths.ctraderCbotPath;
          targetDir = path.join(dataPath, 'cBots');
          fileName = 'HedgeEdge.algo';
          break;
        default:
          return { success: false, error: `Unknown asset type: ${assetType}` };
      }

      // Ensure source exists
      if (!existsSync(sourcePath)) {
        return { success: false, error: `Source file not found: ${fileName}` };
      }

      // Create target directory if needed
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // Copy file
      const targetPath = path.join(targetDir, fileName);
      copyFileSync(sourcePath, targetPath);

      // Verify the copy
      const verification = await verifyInstalledFile(sourcePath, targetPath);
      if (!verification.verified) {
        return {
          success: false,
          error: `Installation verification failed: ${verification.error}`,
        };
      }

      console.log(`[Installer] Successfully installed and verified: ${targetPath}`);

      return {
        success: true,
        data: { 
          installedPath: targetPath,
          verified: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Installation failed',
      };
    }
  });

  // Select custom installation path
  ipcMain.handle('installer:selectPath', async (_event, terminalType: unknown) => {
    if (typeof terminalType !== 'string') {
      return { success: false, error: 'Terminal type is required' };
    }

    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: `Select ${terminalType.toUpperCase()} Data Folder`,
        buttonLabel: 'Select Folder',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Selection cancelled' };
      }

      const selectedPath = result.filePaths[0];
      
      // Validate the selected path looks like a terminal data folder
      const { existsSync } = await import('fs');
      let isValid = false;
      
      if (terminalType === 'mt5') {
        isValid = existsSync(path.join(selectedPath, 'MQL5'));
      } else if (terminalType === 'mt4') {
        isValid = existsSync(path.join(selectedPath, 'MQL4'));
      } else if (terminalType === 'ctrader') {
        // cTrader has less strict structure
        isValid = true;
      }

      return {
        success: true,
        data: {
          path: selectedPath,
          isValidStructure: isValid,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Path selection failed',
      };
    }
  });

  // Install asset to custom path
  ipcMain.handle('installer:installToPath', async (
    _event,
    customPath: unknown,
    assetType: unknown
  ) => {
    if (typeof customPath !== 'string' || !customPath) {
      return { success: false, error: 'Custom path is required' };
    }
    if (typeof assetType !== 'string') {
      return { success: false, error: 'Asset type is required' };
    }

    try {
      const { copyFileSync, mkdirSync, existsSync } = await import('fs');
      const paths = getAssetPaths();

      let sourcePath: string;
      let targetDir: string;
      let fileName: string;

      switch (assetType) {
        case 'mt4-ea':
          sourcePath = paths.mt4EaPath;
          targetDir = path.join(customPath, 'MQL4', 'Experts');
          fileName = 'HedgeEdge.ex4';
          break;
        case 'mt4-dll':
          sourcePath = paths.mt4DllPath;
          targetDir = path.join(customPath, 'MQL4', 'Libraries');
          fileName = 'HedgeEdgeBridge.dll';
          break;
        case 'mt5-ea':
          sourcePath = paths.mt5EaPath;
          targetDir = path.join(customPath, 'MQL5', 'Experts');
          fileName = 'HedgeEdge.ex5';
          break;
        case 'mt5-dll':
          sourcePath = paths.mt5DllPath;
          targetDir = path.join(customPath, 'MQL5', 'Libraries');
          fileName = 'HedgeEdgeBridge.dll';
          break;
        case 'ctrader-cbot':
          sourcePath = paths.ctraderCbotPath;
          targetDir = path.join(customPath, 'cBots');
          fileName = 'HedgeEdge.algo';
          break;
        default:
          return { success: false, error: `Unknown asset type: ${assetType}` };
      }

      if (!existsSync(sourcePath)) {
        return { success: false, error: `Source file not found: ${fileName}` };
      }

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, fileName);
      copyFileSync(sourcePath, targetPath);

      // Verify the copy
      const verification = await verifyInstalledFile(sourcePath, targetPath);
      if (!verification.verified) {
        return {
          success: false,
          error: `Installation verification failed: ${verification.error}`,
        };
      }

      return {
        success: true,
        data: { 
          installedPath: targetPath,
          verified: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Installation failed',
      };
    }
  });

  // Open data folder in explorer/finder
  ipcMain.handle('installer:openDataFolder', async (_event, terminalId: unknown) => {
    if (typeof terminalId !== 'string' || !terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      const detectionResult = await detectTerminals();
      const terminal = detectionResult.terminals.find(t => t.id === terminalId);
      if (!terminal) {
        return { success: false, error: 'Terminal not found' };
      }

      const dataPath = terminal.dataPath || terminal.installPath;
      await shell.openPath(dataPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open folder',
      };
    }
  });

  // Get available assets info
  ipcMain.handle('installer:getAssets', async () => {
    const paths = getAssetPaths();
    const { existsSync } = await import('fs');

    return {
      success: true,
      data: {
        mt4: {
          ea: existsSync(paths.mt4EaPath),
          dll: existsSync(paths.mt4DllPath),
        },
        mt5: {
          ea: existsSync(paths.mt5EaPath),
          dll: existsSync(paths.mt5DllPath),
        },
        ctrader: {
          cbot: existsSync(paths.ctraderCbotPath),
        },
      },
    };
  });
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  // Test debug logging
  await debugLog('[Main] App starting - debug log initialized');
  
  // Setup IPC handlers first
  setupIpcHandlers();
  
  // Initialize license store (loads persisted license from keychain)
  try {
    await licenseStore.initialize();
    console.log('[Main] License store initialized');
    
    // Auto-validate persisted license on startup
    const status = licenseStore.getStatus();
    if (status.status === 'checking' || status.maskedKey) {
      console.log('[Main] Validating persisted license...');
      await licenseStore.refresh();
    }
  } catch (error) {
    console.error('[Main] Failed to initialize license store:', error);
  }
  
  // Initialize license manager (enhanced license management)
  try {
    await licenseManager.initialize();
    console.log('[Main] License manager initialized');
    
    // Subscribe to license state changes for logging
    licenseManager.onLicenseChange((event) => {
      console.log(`[Main] License state changed: ${event.type}`, {
        status: event.license.status,
        tier: event.license.tier,
      });
    });
    
    // Subscribe to expiry warnings
    licenseManager.onExpiryWarning((hoursRemaining) => {
      console.warn(`[Main] License expires in ${hoursRemaining} hours!`);
      // Could show a notification here
    });
  } catch (error) {
    console.error('[Main] Failed to initialize license manager:', error);
  }
  
  // Start WebRequest proxy (optional local license validation)
  try {
    const proxyStarted = await webRequestProxy.start();
    if (proxyStarted) {
      console.log('[Main] WebRequest proxy started on port 8089');
    } else {
      console.warn('[Main] WebRequest proxy failed to start (non-critical)');
    }
  } catch (error) {
    console.warn('[Main] WebRequest proxy error (non-critical):', error);
  }
  
  // Initialize agent supervisor (starts bundled agents if available)
  try {
    await initializeSupervisor();
    console.log('[Main] Agent supervisor initialized');
  } catch (error) {
    console.error('[Main] Failed to initialize agent supervisor:', error);
  }
  
  // Auto-reconnect accounts via ZeroMQ (restore connections on restart)
  try {
    await autoReconnectFromZMQ();
    console.log('[Main] Auto-reconnect via ZeroMQ complete');
  } catch (error) {
    console.error('[Main] Auto-reconnect failed:', error);
  }
  
  // Create the main window
  await createWindow();

  // macOS: Re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent creation of additional webviews
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});

// Cleanup on quit - shutdown supervisor and ZMQ gracefully
app.on('before-quit', async (event) => {
  // Prevent immediate quit to allow async cleanup
  event.preventDefault();
  
  try {
    // Shutdown WebRequest proxy
    await webRequestProxy.stop();
    console.log('[Main] WebRequest proxy shutdown complete');
    
    // Shutdown license manager
    await licenseManager.shutdown();
    console.log('[Main] License manager shutdown complete');
    
    // Shutdown ZMQ bridges first
    await agentChannelReader.shutdown();
    console.log('[Main] ZMQ bridges shutdown complete');
    
    await shutdownSupervisor();
    console.log('[Main] Agent supervisor shutdown complete');
  } catch (error) {
    console.error('[Main] Error during shutdown:', error);
  }
  
  // Now actually quit
  app.exit(0);
});
