/**
 * TypeScript type declarations for HedgeEdge desktop application
 * 
 * This is a desktop-only (Electron) application. These types define
 * the IPC bridge between renderer and main process.
 * 
 * NOTE: Canonical trading types are defined in src/lib/local-trading-bridge.ts
 * This file only provides ambient declarations for window.electronAPI
 */

// Vite environment variables (desktop build)
interface ImportMetaEnv {
  // Supabase is optional for cloud sync/auth
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Re-declare minimal types for ambient window interface
// (Full types with documentation are in local-trading-bridge.ts)
type TradingPlatform = 'mt5' | 'ctrader';
type AgentMode = 'bundled' | 'external' | 'not-configured';
type AgentStatus = 'stopped' | 'starting' | 'running' | 'connected' | 'error' | 'not-available';

// Agent Health Status
interface AgentHealthStatus {
  platform: TradingPlatform;
  status: AgentStatus;
  port: number;
  pid: number | null;
  uptime: number | null;
  restartCount: number;
  lastError: string | null;
  isBundled: boolean;
  isExternal: boolean;
}

// Agent Configuration Summary
interface AgentConfigSummary {
  mt5: { mode: AgentMode; endpoint: string; hasBundled: boolean };
  ctrader: { mode: AgentMode; endpoint: string; hasBundled: boolean };
}

// Agent Configuration Update
interface AgentConfigUpdate {
  mode?: AgentMode;
  host?: string;
  port?: number;
}

// Trading Credentials
interface TradingCredentials {
  login: string;
  password: string;
  server: string;
}

// Order Request
interface OrderRequest {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price?: number;
  sl?: number;
  tp?: number;
  magic?: number;
  comment?: string;
}

// Close Order Request
interface CloseOrderRequest {
  ticket: number;
  volume?: number;
}

// Generic Bridge Result
interface BridgeResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Terminal Detection Types
type TerminalType = 'mt4' | 'mt5' | 'ctrader';

interface DetectedTerminal {
  id: string;
  type: TerminalType;
  name: string;
  executablePath: string;
  installPath: string;
  terminalId?: string;
  broker?: string;
  isRunning?: boolean;
  dataPath?: string;
}

interface DetectionResult {
  success: boolean;
  terminals: DetectedTerminal[];
  error?: string;
  deepScan?: boolean;
}

interface LaunchCredentials {
  login?: string;
  password?: string;
  server?: string;
}

interface TerminalsAPI {
  detect: () => Promise<DetectionResult>;
  detectDeep: () => Promise<DetectionResult>;
  launch: (executablePath: string, credentials?: LaunchCredentials) => Promise<{ success: boolean; error?: string }>;
}

// Trading API exposed via Electron preload
interface TradingAPI {
  getStatus: (platform: TradingPlatform) => Promise<BridgeResult>;
  validateCredentials: (platform: TradingPlatform, credentials: TradingCredentials) => Promise<BridgeResult>;
  getSnapshot: (platform: TradingPlatform, credentials?: TradingCredentials) => Promise<BridgeResult>;
  getBalance: (platform: TradingPlatform, credentials?: TradingCredentials) => Promise<BridgeResult>;
  getPositions: (platform: TradingPlatform, credentials?: TradingCredentials) => Promise<BridgeResult>;
  getTick: (platform: TradingPlatform, symbol: string) => Promise<BridgeResult>;
  getSymbols: (platform: TradingPlatform) => Promise<BridgeResult>;
  placeOrder: (platform: TradingPlatform, order: OrderRequest, credentials?: TradingCredentials) => Promise<BridgeResult>;
  closeOrder: (platform: TradingPlatform, request: CloseOrderRequest, credentials?: TradingCredentials) => Promise<BridgeResult>;
}

// Agent Management API exposed via Electron preload
interface AgentAPI {
  getConfig: () => Promise<AgentConfigSummary>;
  getHealthStatus: () => Promise<{ mt5: AgentHealthStatus; ctrader: AgentHealthStatus }>;
  getPlatformHealth: (platform: TradingPlatform) => Promise<{ success: boolean; data?: AgentHealthStatus; error?: string }>;
  setConfig: (platform: TradingPlatform, config: AgentConfigUpdate) => Promise<{ success: boolean; error?: string }>;
  resetConfig: (platform: TradingPlatform) => Promise<{ success: boolean; error?: string }>;
  start: (platform: TradingPlatform) => Promise<{ success: boolean; error?: string }>;
  stop: (platform: TradingPlatform) => Promise<{ success: boolean; error?: string }>;
  restart: (platform: TradingPlatform) => Promise<{ success: boolean; error?: string }>;
  getLogPath: (platform: TradingPlatform) => Promise<{ success: boolean; data?: string; error?: string }>;
  hasBundled: (platform: TradingPlatform) => Promise<{ success: boolean; data?: boolean; error?: string }>;
  onStatusChange: (
    callback: (status: { mt5: AgentHealthStatus; ctrader: AgentHealthStatus }) => void,
    intervalMs?: number
  ) => () => void;
}

// Secure Storage API for encrypted credential storage
interface SecureStorageResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface SecureStorageAPI {
  isAvailable: () => Promise<boolean>;
  encrypt: (plainText: string) => Promise<SecureStorageResult>;
  decrypt: (encryptedBase64: string) => Promise<SecureStorageResult>;
}

// Connection Management Types (mirrors src/types/connections.ts)
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
}

interface ConnectionSnapshot {
  session: ConnectionSession;
  metrics?: ConnectionMetrics;
  positions?: ConnectionPosition[];
  timestamp: string;
}

type ConnectionSnapshotMap = Record<string, ConnectionSnapshot>;

interface ConnectParams {
  accountId: string;
  platform: ConnectionPlatform;
  role: ConnectionRole;
  credentials: {
    login: string;
    password: string;
    server: string;
  };
  endpoint?: ConnectionEndpoint;
  autoReconnect?: boolean;
}

interface DisconnectParams {
  accountId: string;
  reason?: string;
}

interface ConnectionsAPI {
  list: () => Promise<ConnectionSnapshotMap>;
  connect: (params: ConnectParams) => Promise<{ success: boolean; error?: string }>;
  disconnect: (params: DisconnectParams) => Promise<{ success: boolean; error?: string }>;
  status: (accountId: string) => Promise<ConnectionSnapshot | null>;
  refresh: (accountId: string) => Promise<{ success: boolean; error?: string }>;
  onSnapshotUpdate: (
    callback: (snapshots: ConnectionSnapshotMap) => void,
    intervalMs?: number
  ) => () => void;
}

// License Management API
interface LicenseStatusData {
  valid?: boolean;
  status?: 'valid' | 'invalid' | 'expired' | 'not-configured' | 'checking' | 'error';
  maskedKey?: string;
  expiresAt?: string;
  tier?: string;
  lastChecked?: string;
  nextCheckAt?: string;
  daysRemaining?: number;
  features?: string[];
  email?: string;
  errorMessage?: string;
  secureStorage?: boolean;
}

interface LicenseAPI {
  activate: (licenseKey: string) => Promise<{ success: boolean; data?: LicenseStatusData; error?: string }>;
  refresh: () => Promise<{ success: boolean; data?: LicenseStatusData; error?: string }>;
  getStatus: () => Promise<{ success: boolean; data?: LicenseStatusData; error?: string }>;
  remove: () => Promise<{ success: boolean; error?: string }>;
}

// Installer API for EA/DLL installation
interface InstallerAPI {
  precheck: (terminalId: string) => Promise<{ 
    success: boolean; 
    data?: { 
      passed: boolean; 
      checks: { 
        terminalInstalled: boolean;
        terminalClosed: boolean;
        dataFolderWritable: boolean;
        assetsAvailable: boolean;
      }; 
      messages: string[]; 
    }; 
    error?: string; 
  }>;
  installAsset: (terminalId: string, assetType: string) => Promise<{ 
    success: boolean; 
    data?: { 
      installedPath: string; 
      verified?: boolean; 
      hash?: string; 
    }; 
    error?: string; 
  }>;
  openDataFolder: (terminalId: string) => Promise<{ success: boolean; error?: string }>;
  selectPath: () => Promise<{ success: boolean; path?: string; error?: string }>;
  installToPath: (assetType: string, targetPath: string) => Promise<{ 
    success: boolean; 
    data?: { 
      installedPath: string; 
      verified?: boolean; 
      hash?: string; 
    }; 
    error?: string; 
  }>;
}

// MT5 WebRequest Whitelist API
interface MT5WhitelistAPI {
  check: (terminalDataPath: string) => Promise<{ 
    success: boolean; 
    data?: { 
      whitelisted: boolean; 
      currentUrls: string[]; 
    }; 
    error?: string; 
  }>;
  add: (terminalDataPath: string) => Promise<{ success: boolean; error?: string }>;
  getInstructions: () => Promise<{ 
    success: boolean; 
    data?: { 
      steps: string[]; 
      url: string; 
    }; 
    error?: string; 
  }>;
}

// Agent Data Channel API
interface AgentSnapshot {
  accountId?: string;
  licenseStatus?: string;
  positions?: Array<{
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    profit: number;
  }>;
  lastUpdate?: string;
}

interface AgentChannelAPI {
  readSnapshot: (platform: TradingPlatform) => Promise<{ 
    success: boolean; 
    data?: AgentSnapshot; 
    error?: string; 
  }>;
  sendCommand: (platform: TradingPlatform, command: string, params?: Record<string, unknown>) => Promise<{ 
    success: boolean; 
    data?: unknown; 
    error?: string; 
  }>;
}

// Electron API exposed via preload script
interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<{
    platform: string;
    arch: string;
    isPackaged: boolean;
  }>;
  openExternal: (url: string) => Promise<boolean>;
  isElectron: boolean;
  trading: TradingAPI;
  agent: AgentAPI;
  terminals: TerminalsAPI;
  secureStorage: SecureStorageAPI;
  connections: ConnectionsAPI;
  license: LicenseAPI;
  installer: InstallerAPI;
  mt5Whitelist: MT5WhitelistAPI;
  agentChannel: AgentChannelAPI;
}

// Extend Window interface for Electron
interface Window {
  electronAPI?: ElectronAPI;
}
