/**
 * Preload script for secure IPC communication between main and renderer processes.
 * This script runs in a sandboxed context with access to some Node.js APIs
 * but exposes only safe, validated functions to the renderer.
 */
import { contextBridge, ipcRenderer } from 'electron';

// ============================================================================
// Types for Trading Bridge IPC
// ============================================================================

type TradingPlatform = 'mt5' | 'ctrader';
type AgentMode = 'bundled' | 'external' | 'not-configured';
type AgentStatus = 'stopped' | 'starting' | 'running' | 'connected' | 'error' | 'not-available';

interface TradingCredentials {
  login: string;
  password: string;
  server: string;
}

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

interface CloseOrderRequest {
  ticket: number;
  volume?: number;
}

interface AgentConfigUpdate {
  mode?: AgentMode;
  host?: string;
  port?: number;
}

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

interface AgentConfigSummary {
  mt5: { mode: AgentMode; endpoint: string; hasBundled: boolean };
  ctrader: { mode: AgentMode; endpoint: string; hasBundled: boolean };
}

// ============================================================================
// Trading Bridge API
// ============================================================================

const tradingAPI = {
  /**
   * Get terminal connection status
   */
  getStatus: (platform: TradingPlatform): Promise<any> => {
    return ipcRenderer.invoke('trading:getStatus', platform);
  },

  /**
   * Validate trading credentials
   */
  validateCredentials: (platform: TradingPlatform, credentials: TradingCredentials): Promise<any> => {
    // Basic validation before sending
    if (!credentials.login || !credentials.server) {
      return Promise.resolve({ success: false, error: 'Login and server are required' });
    }
    return ipcRenderer.invoke('trading:validateCredentials', platform, credentials);
  },

  /**
   * Get full account snapshot
   */
  getSnapshot: (platform: TradingPlatform, credentials?: TradingCredentials): Promise<any> => {
    return ipcRenderer.invoke('trading:getSnapshot', platform, credentials);
  },

  /**
   * Get balance info (lightweight)
   */
  getBalance: (platform: TradingPlatform, credentials?: TradingCredentials): Promise<any> => {
    return ipcRenderer.invoke('trading:getBalance', platform, credentials);
  },

  /**
   * Get open positions
   */
  getPositions: (platform: TradingPlatform, credentials?: TradingCredentials): Promise<any> => {
    return ipcRenderer.invoke('trading:getPositions', platform, credentials);
  },

  /**
   * Get symbol tick data
   */
  getTick: (platform: TradingPlatform, symbol: string): Promise<any> => {
    if (!symbol || typeof symbol !== 'string') {
      return Promise.resolve({ success: false, error: 'Valid symbol required' });
    }
    return ipcRenderer.invoke('trading:getTick', platform, symbol);
  },

  /**
   * Get available symbols
   */
  getSymbols: (platform: TradingPlatform): Promise<any> => {
    return ipcRenderer.invoke('trading:getSymbols', platform);
  },

  /**
   * Place a new order
   */
  placeOrder: (platform: TradingPlatform, order: OrderRequest, credentials?: TradingCredentials): Promise<any> => {
    // Validate order basics
    if (!order.symbol || !order.type || !order.volume) {
      return Promise.resolve({ success: false, error: 'Symbol, type, and volume are required' });
    }
    if (!['BUY', 'SELL'].includes(order.type)) {
      return Promise.resolve({ success: false, error: 'Order type must be BUY or SELL' });
    }
    if (order.volume <= 0) {
      return Promise.resolve({ success: false, error: 'Volume must be positive' });
    }
    return ipcRenderer.invoke('trading:placeOrder', platform, order, credentials);
  },

  /**
   * Close an existing order/position
   */
  closeOrder: (platform: TradingPlatform, request: CloseOrderRequest, credentials?: TradingCredentials): Promise<any> => {
    if (!request.ticket || request.ticket <= 0) {
      return Promise.resolve({ success: false, error: 'Valid ticket number required' });
    }
    return ipcRenderer.invoke('trading:closeOrder', platform, request, credentials);
  },
};

// ============================================================================
// Agent Management API
// ============================================================================

const agentAPI = {
  /**
   * Get configuration summary for all agents
   */
  getConfig: (): Promise<AgentConfigSummary> => {
    return ipcRenderer.invoke('agent:getConfig');
  },

  /**
   * Get health status for all agents
   */
  getHealthStatus: (): Promise<{ mt5: AgentHealthStatus; ctrader: AgentHealthStatus }> => {
    return ipcRenderer.invoke('agent:getHealthStatus');
  },

  /**
   * Get health status for a specific platform
   */
  getPlatformHealth: (platform: TradingPlatform): Promise<{ success: boolean; data?: AgentHealthStatus; error?: string }> => {
    return ipcRenderer.invoke('agent:getPlatformHealth', platform);
  },

  /**
   * Update agent configuration for a platform
   */
  setConfig: (platform: TradingPlatform, config: AgentConfigUpdate): Promise<{ success: boolean; error?: string }> => {
    // Basic validation before sending
    if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
      return Promise.resolve({ success: false, error: 'Port must be between 1 and 65535' });
    }
    return ipcRenderer.invoke('agent:setConfig', platform, config);
  },

  /**
   * Reset agent configuration to defaults
   */
  resetConfig: (platform: TradingPlatform): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('agent:resetConfig', platform);
  },

  /**
   * Start an agent (bundled mode only)
   */
  start: (platform: TradingPlatform): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('agent:start', platform);
  },

  /**
   * Stop an agent
   */
  stop: (platform: TradingPlatform): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('agent:stop', platform);
  },

  /**
   * Restart an agent
   */
  restart: (platform: TradingPlatform): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('agent:restart', platform);
  },

  /**
   * Get agent log file path
   */
  getLogPath: (platform: TradingPlatform): Promise<{ success: boolean; data?: string; error?: string }> => {
    return ipcRenderer.invoke('agent:getLogPath', platform);
  },

  /**
   * Check if bundled agent exists for a platform
   */
  hasBundled: (platform: TradingPlatform): Promise<{ success: boolean; data?: boolean; error?: string }> => {
    return ipcRenderer.invoke('agent:hasBundled', platform);
  },

  /**
   * Subscribe to agent status changes (polling-based for simplicity)
   * Returns an unsubscribe function
   */
  onStatusChange: (callback: (status: { mt5: AgentHealthStatus; ctrader: AgentHealthStatus }) => void, intervalMs = 5000): () => void => {
    let active = true;
    
    const poll = async () => {
      if (!active) return;
      
      try {
        const status = await ipcRenderer.invoke('agent:getHealthStatus');
        if (active) {
          callback(status);
        }
      } catch (error) {
        console.error('Failed to get agent status:', error);
      }
      
      if (active) {
        setTimeout(poll, intervalMs);
      }
    };
    
    // Start polling
    poll();
    
    // Return unsubscribe function
    return () => {
      active = false;
    };
  },
};

// ============================================================================
// Core App API
// ============================================================================

const electronAPI = {
  /**
   * Get the application version
   */
  getVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:getVersion');
  },

  /**
   * Get platform information
   */
  getPlatform: (): Promise<{
    platform: string;
    arch: string;
    isPackaged: boolean;
  }> => {
    return ipcRenderer.invoke('app:getPlatform');
  },

  /**
   * Open an external URL in the default browser
   * @param url - The URL to open (must be http or https)
   */
  openExternal: (url: string): Promise<boolean> => {
    // Validate URL before sending to main process
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.warn('Invalid protocol for openExternal:', parsedUrl.protocol);
        return Promise.resolve(false);
      }
    } catch {
      console.warn('Invalid URL for openExternal:', url);
      return Promise.resolve(false);
    }
    return ipcRenderer.invoke('app:openExternal', url);
  },

  /**
   * Check if running in Electron desktop environment
   */
  isElectron: true,

  /**
   * Trading bridge for MT5/cTrader operations via IPC
   */
  trading: tradingAPI,

  /**
   * Agent management for controlling bundled/external agents
   */
  agent: agentAPI,
};

// Expose the API to the renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
