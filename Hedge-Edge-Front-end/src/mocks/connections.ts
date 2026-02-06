/**
 * Mock Trading Connections for Front-End Testing
 * ===============================================
 * Simulated connection states for testing the connection management UI.
 */

import type {
  ConnectionSession,
  ConnectionSnapshot,
  ConnectionPlatform,
  ConnectionRole,
  ConnectionStatus,
} from '@/types/connections';
import { mockPositions, mockMetrics } from './positions';

// ============================================================================
// Mock Connection Sessions
// ============================================================================

const NOW = new Date().toISOString();
const ONE_MINUTE_MS = 60 * 1000;

export const mockConnections: ConnectionSession[] = [
  {
    id: 'conn-001',
    accountId: 'acc-mt5-primary',
    platform: 'mt5',
    role: 'local',
    endpoint: { host: 'localhost', port: 5555 },
    status: 'connected',
    lastUpdate: NOW,
    lastConnected: NOW,
    autoReconnect: true,
    reconnectAttempts: 0,
    licenseStatus: 'valid',
  },
  {
    id: 'conn-002',
    accountId: 'acc-mt5-hedge',
    platform: 'mt5',
    role: 'vps',
    endpoint: { host: '192.168.1.100', port: 5555 },
    status: 'connected',
    lastUpdate: new Date(Date.now() - 30000).toISOString(),
    lastConnected: new Date(Date.now() - 30000).toISOString(),
    autoReconnect: true,
    reconnectAttempts: 0,
    licenseStatus: 'valid',
  },
  {
    id: 'conn-003',
    accountId: 'acc-mt5-demo',
    platform: 'mt5',
    role: 'local',
    endpoint: { host: 'localhost', port: 5556 },
    status: 'disconnected',
    lastUpdate: new Date(Date.now() - 2 * 60 * ONE_MINUTE_MS).toISOString(),
    lastConnected: new Date(Date.now() - 2 * 60 * ONE_MINUTE_MS).toISOString(),
    autoReconnect: false,
    reconnectAttempts: 0,
    licenseStatus: 'valid',
  },
  {
    id: 'conn-004',
    accountId: 'acc-ctrader-main',
    platform: 'ctrader',
    role: 'cloud',
    status: 'connecting',
    lastUpdate: NOW,
    autoReconnect: true,
    reconnectAttempts: 1,
    licenseStatus: 'valid',
  },
  {
    id: 'conn-005',
    accountId: 'acc-mt5-error',
    platform: 'mt5',
    role: 'local',
    endpoint: { host: 'localhost', port: 5557 },
    status: 'error',
    lastUpdate: new Date(Date.now() - 5 * ONE_MINUTE_MS).toISOString(),
    error: 'Connection refused: Terminal not running',
    autoReconnect: true,
    reconnectAttempts: 3,
    licenseStatus: 'valid',
  },
  {
    id: 'conn-006',
    accountId: 'acc-mt5-license-error',
    platform: 'mt5',
    role: 'local',
    endpoint: { host: 'localhost', port: 5558 },
    status: 'error',
    lastUpdate: NOW,
    error: 'License validation failed',
    autoReconnect: false,
    reconnectAttempts: 0,
    licenseStatus: 'invalid',
    licenseError: 'License key not found or invalid',
  },
];

// ============================================================================
// Mock Connection Snapshots (with metrics)
// ============================================================================

export const mockSnapshots: ConnectionSnapshot[] = [
  {
    session: mockConnections[0],
    metrics: mockMetrics.medium,
    positions: mockPositions.slice(0, 3),
    timestamp: NOW,
  },
  {
    session: mockConnections[1],
    metrics: mockMetrics.small,
    positions: mockPositions.slice(3, 5),
    timestamp: NOW,
  },
  {
    session: mockConnections[2],
    metrics: mockMetrics.empty,
    positions: [],
    timestamp: new Date(Date.now() - 2 * 60 * ONE_MINUTE_MS).toISOString(),
  },
];

// ============================================================================
// Mock Trading Accounts (linked to connections)
// ============================================================================

export interface MockTradingAccount {
  id: string;
  name: string;
  broker: string;
  login: string;
  server: string;
  platform: ConnectionPlatform;
  isDemo: boolean;
  currency: string;
  leverage: number;
  createdAt: string;
}

export const mockTradingAccounts: MockTradingAccount[] = [
  {
    id: 'acc-mt5-primary',
    name: 'Primary Live Account',
    broker: 'IC Markets',
    login: '12345678',
    server: 'ICMarkets-Live05',
    platform: 'mt5',
    isDemo: false,
    currency: 'USD',
    leverage: 500,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * ONE_MINUTE_MS).toISOString(),
  },
  {
    id: 'acc-mt5-hedge',
    name: 'Hedge Account',
    broker: 'Pepperstone',
    login: '87654321',
    server: 'Pepperstone-MT5-Live01',
    platform: 'mt5',
    isDemo: false,
    currency: 'USD',
    leverage: 200,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * ONE_MINUTE_MS).toISOString(),
  },
  {
    id: 'acc-mt5-demo',
    name: 'Demo Account',
    broker: 'IC Markets',
    login: '55555555',
    server: 'ICMarkets-Demo01',
    platform: 'mt5',
    isDemo: true,
    currency: 'USD',
    leverage: 500,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * ONE_MINUTE_MS).toISOString(),
  },
  {
    id: 'acc-ctrader-main',
    name: 'cTrader Account',
    broker: 'Pepperstone',
    login: 'CT-99887766',
    server: 'cTrader-Live',
    platform: 'ctrader',
    isDemo: false,
    currency: 'USD',
    leverage: 400,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * ONE_MINUTE_MS).toISOString(),
  },
  {
    id: 'acc-mt5-error',
    name: 'Offline Account',
    broker: 'FxPro',
    login: '11111111',
    server: 'FxPro-MT5-01',
    platform: 'mt5',
    isDemo: false,
    currency: 'EUR',
    leverage: 100,
    createdAt: new Date(Date.now() - 365 * 24 * 60 * ONE_MINUTE_MS).toISOString(),
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get connection by account ID
 */
export function getConnectionByAccountId(accountId: string): ConnectionSession | undefined {
  return mockConnections.find(c => c.accountId === accountId);
}

/**
 * Get connections by status
 */
export function getConnectionsByStatus(status: ConnectionStatus): ConnectionSession[] {
  return mockConnections.filter(c => c.status === status);
}

/**
 * Get connections by platform
 */
export function getConnectionsByPlatform(platform: ConnectionPlatform): ConnectionSession[] {
  return mockConnections.filter(c => c.platform === platform);
}

/**
 * Get trading account by ID
 */
export function getTradingAccount(accountId: string): MockTradingAccount | undefined {
  return mockTradingAccounts.find(a => a.id === accountId);
}

/**
 * Get snapshot for an account
 */
export function getSnapshotByAccountId(accountId: string): ConnectionSnapshot | undefined {
  return mockSnapshots.find(s => s.session.accountId === accountId);
}

/**
 * Simulate connection state change
 */
export function simulateConnectionChange(
  accountId: string,
  newStatus: ConnectionStatus,
  error?: string
): ConnectionSession | null {
  const connection = mockConnections.find(c => c.accountId === accountId);
  if (!connection) return null;
  
  return {
    ...connection,
    status: newStatus,
    lastUpdate: new Date().toISOString(),
    error: error || undefined,
    reconnectAttempts: newStatus === 'reconnecting' 
      ? (connection.reconnectAttempts || 0) + 1 
      : connection.reconnectAttempts,
  };
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  total: number;
  connected: number;
  disconnected: number;
  error: number;
  connecting: number;
} {
  return {
    total: mockConnections.length,
    connected: mockConnections.filter(c => c.status === 'connected').length,
    disconnected: mockConnections.filter(c => c.status === 'disconnected').length,
    error: mockConnections.filter(c => c.status === 'error').length,
    connecting: mockConnections.filter(c => 
      c.status === 'connecting' || c.status === 'reconnecting'
    ).length,
  };
}

// ============================================================================
// Empty States
// ============================================================================

export const emptyConnections: ConnectionSession[] = [];
export const emptyTradingAccounts: MockTradingAccount[] = [];
