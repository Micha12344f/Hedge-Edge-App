/**
 * Mock License States for Front-End Testing
 * ==========================================
 * Simulated license configurations matching different user scenarios.
 */

import type { LicenseInfo, DeviceInfo, ConnectedAgent, LicenseTier } from '@/contexts/LicenseContext';

// ============================================================================
// License State Types
// ============================================================================

export type MockLicenseState = 
  | 'valid'
  | 'expired'
  | 'expiring_soon'
  | 'invalid'
  | 'not_configured'
  | 'checking'
  | 'error'
  | 'demo';

// ============================================================================
// Mock License Data
// ============================================================================

const NOW = new Date().toISOString();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const mockLicenses: Record<MockLicenseState, LicenseInfo> = {
  valid: {
    status: 'valid',
    maskedKey: 'HEDG-****-****-DEMO',
    lastChecked: NOW,
    nextCheckAt: new Date(Date.now() + 60000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * ONE_DAY_MS).toISOString(),
    daysRemaining: 365,
    features: ['hedge_mapping', 'trade_copier', 'analytics', 'multi_account', 'priority_support'],
    email: 'user@example.com',
    tier: 'professional',
    plan: 'Professional Annual',
    deviceId: 'mock-device-001',
    connectedAgents: 3,
    secureStorage: true,
  },

  expired: {
    status: 'expired',
    maskedKey: 'HEDG-****-****-EXPR',
    lastChecked: NOW,
    expiresAt: new Date(Date.now() - 15 * ONE_DAY_MS).toISOString(),
    daysRemaining: 0,
    errorMessage: 'Your license has expired. Please renew to continue using premium features.',
    features: [],
    email: 'expired@example.com',
    tier: 'professional',
    plan: 'Professional Annual',
    deviceId: 'mock-device-002',
    connectedAgents: 0,
    secureStorage: true,
  },

  expiring_soon: {
    status: 'valid',
    maskedKey: 'HEDG-****-****-WARN',
    lastChecked: NOW,
    nextCheckAt: new Date(Date.now() + 60000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * ONE_DAY_MS).toISOString(),
    daysRemaining: 3,
    features: ['hedge_mapping', 'trade_copier', 'analytics', 'multi_account'],
    email: 'expiring@example.com',
    tier: 'professional',
    plan: 'Professional Monthly',
    deviceId: 'mock-device-003',
    connectedAgents: 2,
    secureStorage: true,
  },

  invalid: {
    status: 'invalid',
    maskedKey: 'XXXX-****-****-XXXX',
    lastChecked: NOW,
    errorMessage: 'Invalid license key. Please check your key and try again.',
    features: [],
    deviceId: 'mock-device-004',
    connectedAgents: 0,
    secureStorage: false,
  },

  not_configured: {
    status: 'not-configured',
    features: [],
    deviceId: 'mock-device-005',
    connectedAgents: 0,
    secureStorage: false,
  },

  checking: {
    status: 'checking',
    maskedKey: 'HEDG-****-****-CHCK',
    features: [],
    deviceId: 'mock-device-006',
    connectedAgents: 0,
    secureStorage: false,
  },

  error: {
    status: 'error',
    maskedKey: 'HEDG-****-****-ERRR',
    lastChecked: NOW,
    errorMessage: 'Unable to verify license. Please check your internet connection.',
    features: [],
    deviceId: 'mock-device-007',
    connectedAgents: 0,
    secureStorage: false,
  },

  demo: {
    status: 'valid',
    maskedKey: 'DEMO-****-****-FREE',
    lastChecked: NOW,
    nextCheckAt: new Date(Date.now() + 60000).toISOString(),
    expiresAt: new Date(Date.now() + 14 * ONE_DAY_MS).toISOString(),
    daysRemaining: 14,
    features: ['hedge_mapping', 'analytics'],
    email: 'demo@example.com',
    tier: 'demo',
    plan: 'Demo (14-day trial)',
    deviceId: 'mock-device-008',
    connectedAgents: 1,
    secureStorage: false,
  },
};

// ============================================================================
// Mock Devices
// ============================================================================

export const mockDevices: DeviceInfo[] = [
  {
    deviceId: 'mock-device-001',
    platform: 'desktop',
    name: 'Work PC - Windows 11',
    registeredAt: new Date(Date.now() - 90 * ONE_DAY_MS).toISOString(),
    lastSeenAt: NOW,
    version: '1.0.0',
    isCurrentDevice: true,
  },
  {
    deviceId: 'mock-device-mt5-001',
    platform: 'mt5',
    name: 'MT5 Terminal - VPS Server',
    registeredAt: new Date(Date.now() - 60 * ONE_DAY_MS).toISOString(),
    lastSeenAt: new Date(Date.now() - 5 * 60000).toISOString(),
    version: '5.00 build 4150',
    isCurrentDevice: false,
  },
  {
    deviceId: 'mock-device-mt5-002',
    platform: 'mt5',
    name: 'MT5 Terminal - Home PC',
    registeredAt: new Date(Date.now() - 30 * ONE_DAY_MS).toISOString(),
    lastSeenAt: new Date(Date.now() - 2 * ONE_DAY_MS).toISOString(),
    version: '5.00 build 4150',
    isCurrentDevice: false,
  },
  {
    deviceId: 'mock-device-ctrader-001',
    platform: 'ctrader',
    name: 'cTrader - Laptop',
    registeredAt: new Date(Date.now() - 15 * ONE_DAY_MS).toISOString(),
    lastSeenAt: new Date(Date.now() - 60000).toISOString(),
    version: '4.8.30',
    isCurrentDevice: false,
  },
];

// ============================================================================
// Mock Connected Agents
// ============================================================================

export const mockConnectedAgents: ConnectedAgent[] = [
  {
    id: 'agent-mt5-001',
    platform: 'mt5',
    accountId: '12345678',
    connectedAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
    lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: 'agent-mt5-002',
    platform: 'mt5',
    accountId: '87654321',
    connectedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    lastHeartbeat: new Date(Date.now() - 15000).toISOString(),
  },
  {
    id: 'agent-ctrader-001',
    platform: 'ctrader',
    accountId: 'CT-99887766',
    connectedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    lastHeartbeat: new Date(Date.now() - 10000).toISOString(),
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get mock license by state
 */
export function getMockLicense(state: MockLicenseState): LicenseInfo {
  return mockLicenses[state];
}

/**
 * Get mock devices with optional filter
 */
export function getMockDevices(platform?: DeviceInfo['platform']): DeviceInfo[] {
  if (!platform) return mockDevices;
  return mockDevices.filter(d => d.platform === platform);
}

/**
 * Get mock connected agents with optional filter
 */
export function getMockConnectedAgents(platform?: ConnectedAgent['platform']): ConnectedAgent[] {
  if (!platform) return mockConnectedAgents;
  return mockConnectedAgents.filter(a => a.platform === platform);
}

/**
 * Simulate license activation (returns success/failure)
 */
export async function simulateLicenseActivation(
  key: string,
  simulateDelay = 1500
): Promise<{ success: boolean; license?: LicenseInfo; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, simulateDelay));
  
  // Simulate different responses based on key patterns
  if (key.startsWith('INVALID')) {
    return { success: false, error: 'Invalid license key format' };
  }
  if (key.startsWith('EXPIRED')) {
    return { success: false, error: 'This license key has expired' };
  }
  if (key.startsWith('USED')) {
    return { success: false, error: 'This license key is already activated on another device' };
  }
  if (key.startsWith('DEMO')) {
    return { success: true, license: mockLicenses.demo };
  }
  
  // Default: return valid license
  return { success: true, license: mockLicenses.valid };
}

/**
 * Check if license has specific feature
 */
export function hasFeature(license: LicenseInfo, feature: string): boolean {
  return license.features?.includes(feature) ?? false;
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: LicenseTier | null | undefined): string {
  switch (tier) {
    case 'demo': return 'Demo';
    case 'professional': return 'Professional';
    case 'enterprise': return 'Enterprise';
    default: return 'Free';
  }
}
