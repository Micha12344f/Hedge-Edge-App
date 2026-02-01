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
  readMT5Snapshot, 
  readCTraderSnapshot,
  sendMT5Command,
  sendCTraderCommand,
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
}

interface ConnectionSnapshot {
  session: ConnectionSession;
  metrics?: ConnectionMetrics;
  positions?: ConnectionPosition[];
  timestamp: string;
}

type ConnectionSnapshotMap = Record<string, ConnectionSnapshot>;

// In-memory connection sessions
const connectionSessions: Map<string, ConnectionSession> = new Map();
const connectionMetrics: Map<string, ConnectionMetrics> = new Map();
const connectionPositions: Map<string, ConnectionPosition[]> = new Map();

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
 * Auto-reconnect accounts by scanning for running EAs
 * Called on app startup to restore connections without requiring passwords
 */
async function autoReconnectFromEAFiles(): Promise<void> {
  console.log('[Main] Auto-reconnecting from EA files...');
  
  try {
    // Scan for MT5 terminals and their EA data files
    const detectionResult = await detectTerminals();
    if (!detectionResult.success || !detectionResult.terminals) {
      console.log('[Main] No terminals detected for auto-reconnect');
      return;
    }
    
    const mt5Terminals = detectionResult.terminals.filter((t: { type: string }) => t.type === 'mt5');
    console.log('[Main] Found', mt5Terminals.length, 'MT5 terminals to check for EA files');
    
    for (const terminal of mt5Terminals) {
      console.log('[Main] Checking terminal:', terminal.name, 'dataPath:', terminal.dataPath);
      if (!terminal.dataPath) {
        console.log('[Main] Skipping terminal - no dataPath');
        continue;
      }
      
      try {
        const snapshotResult = await readMT5Snapshot(terminal.dataPath);
        console.log('[Main] EA file read result:', snapshotResult.success, snapshotResult.error || '');
        if (!snapshotResult.success || !snapshotResult.data) {
          console.log('[Main] No EA snapshot data for terminal');
          continue;
        }
        
        const data = snapshotResult.data;
        const accountId = String(data.accountId);
        
        // Check if session already exists
        if (connectionSessions.has(accountId)) {
          console.log('[Main] Session already exists for account:', accountId);
          continue;
        }
        
        console.log('[Main] Auto-connecting account from EA file:', accountId, data.broker);
        
        // Create session from EA data (no password needed for file-based reading)
        const session: ConnectionSession = {
          id: accountId,
          accountId,
          platform: 'mt5',
          role: 'local',
          status: 'connected', // Already connected via EA file
          lastUpdate: new Date().toISOString(),
          lastConnected: new Date().toISOString(),
          autoReconnect: true,
          // Store credentials for matching (password empty since we use file-based)
          _credentials: {
            login: accountId,
            password: '', // Not needed for file-based
            server: data.server || data.broker || '',
          },
        };
        connectionSessions.set(accountId, session);
        
        // Store metrics from EA snapshot
        const metrics: ConnectionMetrics = {
          balance: data.balance ?? 0,
          equity: data.equity ?? 0,
          profit: data.floatingPnL ?? 0,
          positionCount: data.positions?.length ?? 0,
          margin: data.margin,
          freeMargin: data.freeMargin,
          marginLevel: data.marginLevel,
        };
        connectionMetrics.set(accountId, metrics);
        
        // Store positions
        if (data.positions) {
          const positions: ConnectionPosition[] = data.positions.map((p: any) => ({
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
        
        console.log('[Main] Auto-connected account:', accountId, 'Balance:', metrics.balance);
      } catch (err) {
        console.log('[Main] Failed to auto-connect from terminal:', terminal.dataPath, err);
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
            password: '', // Will need password to fully reconnect
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
 */
function buildSnapshot(accountId: string): ConnectionSnapshot | null {
  const session = connectionSessions.get(accountId);
  if (!session) return null;
  
  return {
    session: getSanitizedSession(session),
    metrics: connectionMetrics.get(accountId),
    positions: connectionPositions.get(accountId),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build all snapshots
 */
function buildAllSnapshots(): ConnectionSnapshotMap {
  const snapshots: ConnectionSnapshotMap = {};
  for (const [accountId] of connectionSessions) {
    const snapshot = buildSnapshot(accountId);
    if (snapshot) {
      snapshots[accountId] = snapshot;
    }
  }
  return snapshots;
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
 * For MT5: First tries to connect via EA file (no password needed), falls back to agent API
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

  // For MT5, try file-based connection first (no password needed)
  if (platform === 'mt5') {
    try {
      const detectionResult = await detectTerminals();
      if (detectionResult.success && detectionResult.terminals) {
        const mt5Terminals = detectionResult.terminals.filter((t: { type: string }) => t.type === 'mt5');
        
        for (const terminal of mt5Terminals) {
          if (!terminal.dataPath) continue;
          
          const snapshotResult = await readMT5Snapshot(terminal.dataPath);
          if (snapshotResult.success && snapshotResult.data) {
            const data = snapshotResult.data;
            
            // Check if this matches the account we're trying to connect
            if (String(data.accountId) === String(credentials.login)) {
              console.log('[Main] Connected via EA file for account:', credentials.login);
              
              // Update session to connected
              session.status = 'connected';
              session.lastConnected = new Date().toISOString();
              session.lastUpdate = session.lastConnected;
              connectionSessions.set(accountId, session);
              
              // Store metrics
              const metrics: ConnectionMetrics = {
                balance: data.balance ?? 0,
                equity: data.equity ?? 0,
                profit: data.floatingPnL ?? 0,
                positionCount: data.positions?.length ?? 0,
                margin: data.margin,
                freeMargin: data.freeMargin,
                marginLevel: data.marginLevel,
              };
              connectionMetrics.set(accountId, metrics);
              
              // Store positions
              if (data.positions) {
                const positions: ConnectionPosition[] = data.positions.map((p: any) => ({
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
          }
        }
      }
      
      // EA file not found for this account
      console.log('[Main] No EA file found for account:', credentials.login);
      updateSessionStatus(accountId, 'error', 'EA not running for this account. Start the HedgeEdge EA on MT5.');
      return { success: false, error: 'EA not running for this account. Start the HedgeEdge EA on MT5.' };
      
    } catch (error) {
      console.log('[Main] File-based connection failed:', error);
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

  // Get connected accounts from EAs/cBots
  ipcMain.handle('agent:getConnectedAccounts', async () => {
    try {
      // Scan all detected MT5 terminals for account data files
      await debugLog('[getConnectedAccounts] Starting terminal detection...');
      const detectionResult = await detectTerminals();
      await debugLog(`[getConnectedAccounts] Found ${detectionResult.terminals.length} terminals`);
      
      const connectedAccounts: Array<{
        login: string;
        server: string;
        name?: string;
        broker?: string;
        balance?: number;
        equity?: number;
        currency?: string;
        leverage?: number;
      }> = [];
      
      for (const terminal of detectionResult.terminals) {
        await debugLog(`[getConnectedAccounts] Checking terminal: ${terminal.id}, type: ${terminal.type}, dataPath: ${terminal.dataPath}, installPath: ${terminal.installPath}`);
        if (terminal.type === 'mt5' || terminal.type === 'mt4') {
          const dataPath = terminal.dataPath || terminal.installPath;
          await debugLog(`[getConnectedAccounts] Reading from: ${dataPath}`);
          try {
            const snapshot = await readMT5Snapshot(dataPath);
            await debugLog(`[getConnectedAccounts] Snapshot result: success=${snapshot.success}, error=${snapshot.error}`);
            if (snapshot.success && snapshot.data) {
              await debugLog(`[getConnectedAccounts] Found account: ${snapshot.data.accountId} @ ${snapshot.data.broker}`);
              // Found a connected account!
              connectedAccounts.push({
                login: snapshot.data.accountId,
                server: snapshot.data.server || snapshot.data.broker || 'Unknown',
                name: snapshot.data.accountId,
                broker: snapshot.data.broker,
                balance: snapshot.data.balance,
                equity: snapshot.data.equity,
                currency: snapshot.data.currency,
                leverage: snapshot.data.leverage,
              });
            }
          } catch (err) {
            await debugLog(`[getConnectedAccounts] Error reading terminal: ${err}`);
            // No data file for this terminal, skip
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
  ipcMain.handle('trading:getStatus', async (_event, platform: unknown) => {
    // Wrap in safe serialization to prevent IPC DataCloneError
    const getStatusInternal = async () => {
      if (!isValidPlatform(platform)) {
        return { success: false, error: 'Invalid platform' };
      }
      
      try {
        // First, check for file-based EA connection (works for MT5 EA without separate agent)
        if (platform === 'mt5') {
          const detectionResult = await detectTerminals();
          if (detectionResult.success && detectionResult.terminals) {
            const mt5Terminals = detectionResult.terminals.filter((t: { type: string }) => t.type === 'mt5');
            
            for (const terminal of mt5Terminals) {
              if (terminal.dataPath) {
                const snapshot = await readMT5Snapshot(terminal.dataPath);
                if (snapshot.success && snapshot.data) {
                  // EA is writing data - terminal is running and connected
                  return {
                    success: true,
                    data: {
                      connected: true,
                      platform,
                      terminalRunning: true,
                      lastHeartbeat: snapshot.data.timestamp || new Date().toISOString(),
                    },
                  };
                }
              }
            }
          }
        }
        
        const config = getAgentConfig();
        const platformConfig = config[platform];
        const isLocalAgent = platformConfig.endpoint.host === '127.0.0.1' || platformConfig.endpoint.host === 'localhost';
        
        // Only do local port check for bundled/local agents
        // For external agents on remote hosts, skip directly to health check
        if (isLocalAgent) {
          const port = getAgentPort(platform);
          const portAvailable = await isPortAvailable(port);
          
          if (portAvailable) {
            // Port is available = agent not running, but check if we found EA above
            // If we get here for MT5, it means no EA data was found
            return {
              success: true,
              data: {
                connected: false,
                platform,
                terminalRunning: false,
                error: platform === 'mt5' ? 'MT5 EA not running or not writing data' : 'Trading agent not running',
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
    
    // For MT5, first try to validate via file-based EA (if no HTTP agent running)
    if (platform === 'mt5') {
      try {
        const detectionResult = await detectTerminals();
        if (detectionResult.success && detectionResult.terminals) {
          const mt5Terminals = detectionResult.terminals.filter((t: { type: string }) => t.type === 'mt5');
          
          for (const terminal of mt5Terminals) {
            if (terminal.dataPath) {
              const snapshot = await readMT5Snapshot(terminal.dataPath);
              if (snapshot.success && snapshot.data) {
                // Check if the account ID matches the credentials
                if (snapshot.data.accountId === credentials.login) {
                  console.log('[Main] Validated MT5 credentials via EA file for account:', credentials.login);
                  return { success: true, data: { valid: true } };
                }
              }
            }
          }
        }
      } catch (err) {
        console.log('[Main] File-based validation failed, trying agent:', err);
      }
    }
    
    // NOTE: Password is never stored at rest - only passed through to agent
    return agentRequest(platform, '/api/validate', 'POST', credentials);
  });

  // Get account snapshot (with payload validation)
  ipcMain.handle('trading:getSnapshot', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    console.log('[Main] trading:getSnapshot ENTRY - platform:', platform, 'credentials:', credentials ? { login: (credentials as any).login, server: (credentials as any).server } : 'none');
    
    // Wrap entire handler in safe serialization to prevent DataCloneError
    const getSnapshotInternal = async () => {
      if (!isValidPlatform(platform)) {
        return { success: false, error: 'Invalid platform' };
      }
      if (credentials !== undefined && !isValidCredentials(credentials)) {
        return { success: false, error: 'Invalid credentials format' };
      }
    
    // For MT5, first try to get snapshot from file-based EA
    if (platform === 'mt5') {
      try {
        const detectionResult = await detectTerminals();
        if (detectionResult.success && detectionResult.terminals) {
          const mt5Terminals = detectionResult.terminals.filter((t: { type: string }) => t.type === 'mt5');
          
          // Collect all available snapshots first
          const availableSnapshots: Array<{ terminal: typeof mt5Terminals[0], data: any }> = [];
          
          for (const terminal of mt5Terminals) {
            if (terminal.dataPath) {
              const snapshotResult = await readMT5Snapshot(terminal.dataPath);
              if (snapshotResult.success && snapshotResult.data) {
                availableSnapshots.push({ terminal, data: snapshotResult.data });
              }
            }
          }
          
          // If credentials provided, find the matching account
          if (credentials) {
            // Convert both sides to strings for comparison (JSON may parse accountId as number)
            const matchingSnapshot = availableSnapshots.find(
              s => String(s.data.accountId) === String(credentials.login)
            );
            
            if (matchingSnapshot) {
              console.log('[Main] Got MT5 snapshot via EA file for account:', matchingSnapshot.data.accountId);
              const data = matchingSnapshot.data;
              return {
                success: true,
                data: {
                  balance: data.balance,
                  equity: data.equity,
                  margin: data.margin,
                  freeMargin: data.freeMargin,
                  marginLevel: data.marginLevel,
                  profit: data.floatingPnL,
                  currency: data.currency,
                  leverage: data.leverage,
                  accountId: data.accountId,
                  broker: data.broker,
                  server: data.server || '',
                  positions: (data.positions || []).map((p: any) => ({
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
                  timestamp: data.timestamp,
                },
              };
            }
            // If credentials provided but no match found, return error
            console.log('[Main] No MT5 file found for account:', credentials.login);
            return { 
              success: false, 
              error: `No data found for account ${credentials.login}. Make sure the EA is running on that terminal.` 
            };
          } else if (availableSnapshots.length === 1) {
            // No credentials but only one account available - return it
            const data = availableSnapshots[0].data;
            console.log('[Main] Got MT5 snapshot (single account):', data.accountId);
            return {
              success: true,
              data: {
                balance: data.balance,
                equity: data.equity,
                margin: data.margin,
                freeMargin: data.freeMargin,
                marginLevel: data.marginLevel,
                profit: data.floatingPnL,
                currency: data.currency,
                leverage: data.leverage,
                accountId: data.accountId,
                broker: data.broker,
                server: data.server || '',
                positions: (data.positions || []).map((p: any) => ({
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
                timestamp: data.timestamp,
              },
            };
          }
          // Multiple accounts but no credentials - return error
          if (availableSnapshots.length > 1 && !credentials) {
            return {
              success: false,
              error: 'Multiple accounts detected. Please specify which account to connect to.',
            };
          }
        }
      } catch (err) {
        console.log('[Main] File-based snapshot failed:', err);
        // Return a proper error instead of falling through to agentRequest
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to read MT5 data',
        };
      }
    }
    
    // Only try agentRequest for cTrader or if explicitly configured
    if (platform === 'ctrader') {
      if (credentials) {
        return agentRequest(platform, '/api/account/snapshot', 'POST', credentials);
      }
      return agentRequest(platform, '/api/snapshot');
    }
    
    // For MT5 without file-based data, return error (no HTTP agent available)
    return {
      success: false,
      error: 'MT5 data not available. Make sure the HedgeEdge EA is running.',
    };
    };
    
    // Execute and safely serialize to prevent IPC DataCloneError
    try {
      const result = await getSnapshotInternal();
      console.log('[Main] trading:getSnapshot EXIT - result.success:', result.success, 'hasData:', !!result.data);
      const serialized = safeSerializeForIPC(result);
      console.log('[Main] trading:getSnapshot serialized successfully');
      return serialized;
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
    const fallbackDataPath = typeof p.fallbackDataPath === 'string' ? p.fallbackDataPath : undefined;

    if (!terminalId) {
      return { success: false, error: 'Terminal ID is required' };
    }

    try {
      const success = await agentChannelReader.registerMT5TerminalZmq(terminalId, {
        dataPort,
        commandPort,
        host,
        fallbackDataPath,
      });

      return { 
        success, 
        mode: agentChannelReader.getTerminalMode(terminalId),
        error: success ? undefined : 'Failed to connect ZMQ, may be using file fallback',
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
  // Connection Management Handlers
  // -------------------------------------------------------------------------

  // List all connection snapshots
  ipcMain.handle('connections:list', () => {
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
      await fetchSessionMetrics(accountId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to refresh' 
      };
    }
  });

  // Scan for running EAs and auto-reconnect accounts
  ipcMain.handle('connections:reconnect', async () => {
    console.log('[Main] Manual reconnect triggered');
    try {
      await autoReconnectFromEAFiles();
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

  // Refresh data for a specific account by re-reading EA file
  ipcMain.handle('connections:refreshFromEA', async (_event, accountId: unknown) => {
    if (typeof accountId !== 'string' || !accountId) {
      return { success: false, error: 'Account ID is required' };
    }
    
    const session = connectionSessions.get(accountId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    // Try to refresh from EA file
    if (session.platform === 'mt5') {
      try {
        const detectionResult = await detectTerminals();
        if (detectionResult.success && detectionResult.terminals) {
          const mt5Terminals = detectionResult.terminals.filter((t: { type: string }) => t.type === 'mt5');
          
          for (const terminal of mt5Terminals) {
            if (!terminal.dataPath) continue;
            
            const snapshotResult = await readMT5Snapshot(terminal.dataPath);
            if (snapshotResult.success && snapshotResult.data) {
              const data = snapshotResult.data;
              
              if (String(data.accountId) === String(session._credentials?.login || accountId)) {
                // Update metrics
                const metrics: ConnectionMetrics = {
                  balance: data.balance ?? 0,
                  equity: data.equity ?? 0,
                  profit: data.floatingPnL ?? 0,
                  positionCount: data.positions?.length ?? 0,
                  margin: data.margin,
                  freeMargin: data.freeMargin,
                  marginLevel: data.marginLevel,
                };
                connectionMetrics.set(accountId, metrics);
                
                // Update session status
                session.status = 'connected';
                session.lastUpdate = new Date().toISOString();
                session.error = undefined;
                connectionSessions.set(accountId, session);
                
                // Update positions
                if (data.positions) {
                  const positions: ConnectionPosition[] = data.positions.map((p: any) => ({
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
          }
        }
        
        // EA file not found
        session.status = 'error';
        session.error = 'EA not running or data file not found';
        session.lastUpdate = new Date().toISOString();
        connectionSessions.set(accountId, session);
        
        return { success: false, error: 'EA not running or data file not found' };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to refresh from EA' 
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

  // Read agent snapshot from MT5 file channel
  ipcMain.handle('agent:readSnapshot', async (_event, terminalId: unknown) => {
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
      
      if (terminal.type === 'mt5' || terminal.type === 'mt4') {
        const result = await readMT5Snapshot(dataPath);
        return result;
      } else if (terminal.type === 'ctrader') {
        const result = await readCTraderSnapshot();
        return result;
      }
      
      return { success: false, error: 'Unsupported terminal type' };
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
  
  // Auto-reconnect accounts from running EAs (restore connections on restart)
  try {
    await autoReconnectFromEAFiles();
    console.log('[Main] Auto-reconnect from EA files complete');
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
