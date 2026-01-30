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

// Trading API exposed via Electron preload
interface TradingAPI {
  getStatus: (platform: TradingPlatform) => Promise<any>;
  validateCredentials: (platform: TradingPlatform, credentials: any) => Promise<any>;
  getSnapshot: (platform: TradingPlatform, credentials?: any) => Promise<any>;
  getBalance: (platform: TradingPlatform, credentials?: any) => Promise<any>;
  getPositions: (platform: TradingPlatform, credentials?: any) => Promise<any>;
  getTick: (platform: TradingPlatform, symbol: string) => Promise<any>;
  getSymbols: (platform: TradingPlatform) => Promise<any>;
  placeOrder: (platform: TradingPlatform, order: any, credentials?: any) => Promise<any>;
  closeOrder: (platform: TradingPlatform, request: any, credentials?: any) => Promise<any>;
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
}

// Extend Window interface for Electron
interface Window {
  electronAPI?: ElectronAPI;
}
