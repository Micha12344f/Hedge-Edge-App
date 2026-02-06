/**
 * Mock Data Module for Front-End Testing
 * =======================================
 * Central export for all mock data and utilities.
 * 
 * Usage:
 *   import { mockAccounts, mockPositions, simulateApiCall } from '@/mocks';
 * 
 * Enable mocks via environment variable:
 *   VITE_USE_MOCKS=true
 */

// ============================================================================
// Re-exports
// ============================================================================

// Accounts
export {
  mockAccounts,
  getMockAccount,
  getAllMockAccounts,
  hasPremiumAccess,
  isTrialAccount,
  getDaysRemaining,
  isAdminAccount,
  defaultMockAccount,
  type MockAccount,
  type MockAccountType,
} from './accounts';

// Licenses
export {
  mockLicenses,
  mockDevices,
  mockConnectedAgents,
  getMockLicense,
  getMockDevices,
  getMockConnectedAgents,
  simulateLicenseActivation,
  hasFeature,
  getTierDisplayName,
  type MockLicenseState,
} from './licenses';

// Positions
export {
  mockPositions,
  mockMetrics,
  generateRandomPositions,
  getPositionsBySymbol,
  getPositionsByType,
  calculateTotalProfit,
  calculateNetExposure,
  groupPositionsBySymbol,
} from './positions';

// Hedges
export {
  mockHedges,
  emptyHedges,
  getHedgeById,
  getActiveHedges,
  getHedgesByStatus,
  getHedgesByAccount,
  getHedgesBySymbol,
  calculateHedgeRatio,
  getHedgeSummary,
  generateHedgeId,
  type HedgeMapping,
  type HedgeLeg,
  type HedgeStatus,
} from './hedges';

// Connections
export {
  mockConnections,
  mockSnapshots,
  mockTradingAccounts,
  emptyConnections,
  emptyTradingAccounts,
  getConnectionByAccountId,
  getConnectionsByStatus,
  getConnectionsByPlatform,
  getTradingAccount,
  getSnapshotByAccountId,
  simulateConnectionChange,
  getConnectionStats,
  type MockTradingAccount,
} from './connections';

// API Responses
export {
  createSuccessResponse,
  createErrorResponse,
  mockErrors,
  simulateApiCall,
  mockApi,
  createMockWebSocket,
  type ApiResponse,
  type ApiError,
  type ResponseMeta,
  type MockApiOptions,
  type MockWebSocketOptions,
} from './api-responses';

// Trading Accounts (Dashboard)
export {
  mockTradingAccountPresets,
  loadMockTradingAccounts,
  clearMockTradingAccounts,
  getCurrentMockAccounts,
  addMockAccount,
  getPresetSummary,
  type MockPresetType,
} from './trading-accounts';

// Trade Copier
export {
  getStoredCopiers,
  saveCopiers,
  getStoredActivity,
  saveActivity,
  createCopierFromRelationship,
  syncCopiersWithRelationships,
  getCopiersSummary,
  populateMockCopierStats,
  type TradeCopierConfig,
  type CopierStats,
  type CopierActivity,
  type CopierLogic,
  type CopierStatus,
} from './trade-copier';

// ============================================================================
// Mock Mode Detection
// ============================================================================

/**
 * Check if mock mode is enabled via environment variable
 */
export function isMockModeEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

/**
 * Get configured mock delay (for simulating network latency)
 */
export function getMockDelay(): number {
  const delay = parseInt(import.meta.env.VITE_MOCK_DELAY || '500', 10);
  return isNaN(delay) ? 500 : delay;
}

/**
 * Get configured mock error rate (for testing error handling)
 */
export function getMockErrorRate(): number {
  const rate = parseFloat(import.meta.env.VITE_MOCK_ERROR_RATE || '0');
  return isNaN(rate) ? 0 : Math.min(1, Math.max(0, rate / 100));
}

// ============================================================================
// Quick Setup Presets
// ============================================================================

import { mockTradingAccountPresets } from './trading-accounts';

/**
 * Get mock data preset for a specific user scenario
 */
export function getMockPreset(scenario: 'new_user' | 'active_trader' | 'power_user' | 'expired') {
  switch (scenario) {
    case 'new_user':
      return {
        account: getMockAccount('new_user'),
        license: getMockLicense('demo'),
        positions: [],
        hedges: [],
        metrics: mockMetrics.empty,
        tradingAccounts: mockTradingAccountPresets.new_user,
      };
    
    case 'active_trader':
      return {
        account: getMockAccount('premium_user'),
        license: getMockLicense('valid'),
        positions: mockPositions,
        hedges: mockHedges.filter(h => h.isActive),
        metrics: mockMetrics.medium,
        tradingAccounts: mockTradingAccountPresets.active_trader,
      };
    
    case 'power_user':
      return {
        account: getMockAccount('power_user'),
        license: getMockLicense('valid'),
        positions: generateRandomPositions(50),
        hedges: mockHedges,
        metrics: mockMetrics.large,
        tradingAccounts: mockTradingAccountPresets.power_user,
      };
    
    case 'expired':
      return {
        account: getMockAccount('expired_user'),
        license: getMockLicense('expired'),
        positions: [],
        hedges: [],
        metrics: mockMetrics.empty,
        tradingAccounts: mockTradingAccountPresets.beginner,
      };
  }
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Log all available mock data (for debugging)
 */
export function logMockDataSummary(): void {
  console.group('📦 Mock Data Summary');
  console.log('Mock Mode:', isMockModeEnabled() ? 'ENABLED' : 'DISABLED');
  console.log('Mock Delay:', getMockDelay(), 'ms');
  console.log('Mock Error Rate:', getMockErrorRate() * 100, '%');
  console.log('---');
  console.log('Accounts:', Object.keys(mockAccounts).length);
  console.log('License States:', Object.keys(mockLicenses).length);
  console.log('Positions:', mockPositions.length);
  console.log('Hedges:', mockHedges.length);
  console.log('Devices:', mockDevices.length);
  console.log('Connected Agents:', mockConnectedAgents.length);
  console.groupEnd();
}
