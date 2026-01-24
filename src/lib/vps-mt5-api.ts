/**
 * VPS MT5 API Service
 * ====================
 * This connects your web app to your Windows VPS running MT5.
 * 
 * Configuration:
 * - Set VITE_MT5_VPS_URL in .env to your VPS IP/domain
 * - Set VITE_MT5_API_KEY in .env to your API key
 */

// VPS Configuration
const VPS_URL = import.meta.env.VITE_MT5_VPS_URL || 'http://localhost:5000';
const API_KEY = import.meta.env.VITE_MT5_API_KEY || 'your-secret-api-key-change-this';

export interface MT5Account {
  login: number;
  name: string;
  broker: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  leverage: number;
}

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  commission: number;
  sl: number;
  tp: number;
  time: string;
  magic: number;
  comment: string;
}

export interface MT5Snapshot {
  login: number;
  server: string;
  name: string;
  broker: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  profit: number;
  leverage: number;
  positions: MT5Position[];
  positions_count: number;
  orders: any[];
  orders_count: number;
  timestamp: string;
}

export interface ValidationResult {
  success: boolean;
  valid?: boolean;
  error?: string;
  account?: MT5Account;
}

export interface SnapshotResult {
  success: boolean;
  error?: string;
  data?: MT5Snapshot;
}

/**
 * Make an API request to the VPS server
 */
async function vpsRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${VPS_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Check if the VPS server is healthy
 */
export async function checkVPSHealth(): Promise<{
  status: string;
  mt5_connected: boolean;
  message: string;
}> {
  const response = await fetch(`${VPS_URL}/api/health`);
  return response.json();
}

/**
 * Validate MT5 credentials
 * Returns account info if valid, error if invalid
 */
export async function validateMT5Credentials(
  login: string,
  password: string,
  server: string
): Promise<ValidationResult> {
  try {
    const result = await vpsRequest<ValidationResult>('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ login, password, server }),
    });
    return result;
  } catch (error) {
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get full account snapshot (balance, equity, positions, orders)
 */
export async function getAccountSnapshot(
  login: string,
  password: string,
  server: string
): Promise<SnapshotResult> {
  try {
    const result = await vpsRequest<SnapshotResult>('/api/account/snapshot', {
      method: 'POST',
      body: JSON.stringify({ login, password, server }),
    });
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get just balance info (faster, for frequent polling)
 */
export async function getAccountBalance(
  login: string,
  password: string,
  server: string
): Promise<{
  success: boolean;
  error?: string;
  data?: {
    login: number;
    balance: number;
    equity: number;
    margin: number;
    margin_free: number;
    profit: number;
    positions_count: number;
    timestamp: string;
  };
}> {
  try {
    return await vpsRequest('/api/account/balance', {
      method: 'POST',
      body: JSON.stringify({ login, password, server }),
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get live tick for a symbol
 */
export async function getSymbolTick(symbol: string): Promise<{
  success: boolean;
  error?: string;
  data?: {
    symbol: string;
    bid: number;
    ask: number;
    last: number;
    volume: number;
    time: string;
  };
}> {
  try {
    return await vpsRequest(`/api/tick?symbol=${encodeURIComponent(symbol)}`);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get available trading symbols
 */
export async function getSymbols(): Promise<{
  success: boolean;
  error?: string;
  symbols?: string[];
}> {
  try {
    return await vpsRequest('/api/symbols');
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Export VPS URL for debugging
export const getVPSUrl = () => VPS_URL;
