/**
 * Mock User Accounts for Front-End Testing
 * =========================================
 * Simulated user accounts representing different subscription states and user types.
 * Use these to test UI states without backend connectivity.
 */

import { User, Session } from '@supabase/supabase-js';

// ============================================================================
// Mock Account Types
// ============================================================================

export type MockAccountType = 
  | 'free_user'
  | 'premium_user'
  | 'trial_user'
  | 'expired_user'
  | 'new_user'
  | 'power_user'
  | 'admin_user';

export interface MockAccount {
  id: string;
  email: string;
  fullName: string;
  type: MockAccountType;
  description: string;
  user: Partial<User>;
  session: Partial<Session>;
  metadata: {
    subscriptionTier: string;
    subscriptionStatus: 'active' | 'trial' | 'expired' | 'cancelled' | 'none';
    trialEndsAt?: string;
    subscriptionEndsAt?: string;
    accountCreatedAt: string;
    lastLoginAt: string;
    totalLogins: number;
    connectedAccounts: number;
  };
}

// ============================================================================
// Mock Account Data
// ============================================================================

const NOW = new Date().toISOString();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const mockAccounts: Record<MockAccountType, MockAccount> = {
  free_user: {
    id: 'mock-free-001',
    email: 'free.user@example.com',
    fullName: 'Alex Free',
    type: 'free_user',
    description: 'Free tier user - limited features, sees upgrade prompts',
    user: {
      id: 'mock-free-001',
      email: 'free.user@example.com',
      created_at: new Date(Date.now() - 30 * ONE_DAY_MS).toISOString(),
      user_metadata: {
        full_name: 'Alex Free',
        subscription_tier: 'free',
      },
    },
    session: {
      access_token: 'mock-access-token-free',
      refresh_token: 'mock-refresh-token-free',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'free',
      subscriptionStatus: 'none',
      accountCreatedAt: new Date(Date.now() - 30 * ONE_DAY_MS).toISOString(),
      lastLoginAt: NOW,
      totalLogins: 15,
      connectedAccounts: 1,
    },
  },

  premium_user: {
    id: 'mock-premium-001',
    email: 'premium.user@example.com',
    fullName: 'Jordan Premium',
    type: 'premium_user',
    description: 'Paid premium user - full feature access',
    user: {
      id: 'mock-premium-001',
      email: 'premium.user@example.com',
      created_at: new Date(Date.now() - 180 * ONE_DAY_MS).toISOString(),
      user_metadata: {
        full_name: 'Jordan Premium',
        subscription_tier: 'professional',
      },
    },
    session: {
      access_token: 'mock-access-token-premium',
      refresh_token: 'mock-refresh-token-premium',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
      subscriptionEndsAt: new Date(Date.now() + 365 * ONE_DAY_MS).toISOString(),
      accountCreatedAt: new Date(Date.now() - 180 * ONE_DAY_MS).toISOString(),
      lastLoginAt: NOW,
      totalLogins: 245,
      connectedAccounts: 5,
    },
  },

  trial_user: {
    id: 'mock-trial-001',
    email: 'trial.user@example.com',
    fullName: 'Taylor Trial',
    type: 'trial_user',
    description: 'Trial user - 3 days remaining, sees expiry warnings',
    user: {
      id: 'mock-trial-001',
      email: 'trial.user@example.com',
      created_at: new Date(Date.now() - 11 * ONE_DAY_MS).toISOString(),
      user_metadata: {
        full_name: 'Taylor Trial',
        subscription_tier: 'professional',
        is_trial: true,
      },
    },
    session: {
      access_token: 'mock-access-token-trial',
      refresh_token: 'mock-refresh-token-trial',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'professional',
      subscriptionStatus: 'trial',
      trialEndsAt: new Date(Date.now() + 3 * ONE_DAY_MS).toISOString(),
      accountCreatedAt: new Date(Date.now() - 11 * ONE_DAY_MS).toISOString(),
      lastLoginAt: NOW,
      totalLogins: 8,
      connectedAccounts: 2,
    },
  },

  expired_user: {
    id: 'mock-expired-001',
    email: 'expired.user@example.com',
    fullName: 'Morgan Expired',
    type: 'expired_user',
    description: 'Expired subscription - sees renewal flows, locked premium features',
    user: {
      id: 'mock-expired-001',
      email: 'expired.user@example.com',
      created_at: new Date(Date.now() - 400 * ONE_DAY_MS).toISOString(),
      user_metadata: {
        full_name: 'Morgan Expired',
        subscription_tier: 'professional',
        subscription_expired: true,
      },
    },
    session: {
      access_token: 'mock-access-token-expired',
      refresh_token: 'mock-refresh-token-expired',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'professional',
      subscriptionStatus: 'expired',
      subscriptionEndsAt: new Date(Date.now() - 15 * ONE_DAY_MS).toISOString(),
      accountCreatedAt: new Date(Date.now() - 400 * ONE_DAY_MS).toISOString(),
      lastLoginAt: NOW,
      totalLogins: 312,
      connectedAccounts: 3,
    },
  },

  new_user: {
    id: 'mock-new-001',
    email: 'new.user@example.com',
    fullName: 'Sam Newbie',
    type: 'new_user',
    description: 'Brand new user - empty states, onboarding, tutorials',
    user: {
      id: 'mock-new-001',
      email: 'new.user@example.com',
      created_at: NOW,
      user_metadata: {
        full_name: 'Sam Newbie',
        subscription_tier: 'free',
        is_new_user: true,
      },
    },
    session: {
      access_token: 'mock-access-token-new',
      refresh_token: 'mock-refresh-token-new',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'free',
      subscriptionStatus: 'none',
      accountCreatedAt: NOW,
      lastLoginAt: NOW,
      totalLogins: 1,
      connectedAccounts: 0,
    },
  },

  power_user: {
    id: 'mock-power-001',
    email: 'power.user@example.com',
    fullName: 'Casey Power',
    type: 'power_user',
    description: 'Enterprise user - large datasets, many accounts, stress testing',
    user: {
      id: 'mock-power-001',
      email: 'power.user@example.com',
      created_at: new Date(Date.now() - 730 * ONE_DAY_MS).toISOString(),
      user_metadata: {
        full_name: 'Casey Power',
        subscription_tier: 'enterprise',
      },
    },
    session: {
      access_token: 'mock-access-token-power',
      refresh_token: 'mock-refresh-token-power',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'enterprise',
      subscriptionStatus: 'active',
      subscriptionEndsAt: new Date(Date.now() + 365 * ONE_DAY_MS).toISOString(),
      accountCreatedAt: new Date(Date.now() - 730 * ONE_DAY_MS).toISOString(),
      lastLoginAt: NOW,
      totalLogins: 1847,
      connectedAccounts: 25,
    },
  },

  admin_user: {
    id: 'mock-admin-001',
    email: 'admin@hedgeedge.com',
    fullName: 'Admin User',
    type: 'admin_user',
    description: 'Administrator - full access, admin panel, user management',
    user: {
      id: 'mock-admin-001',
      email: 'admin@hedgeedge.com',
      created_at: new Date(Date.now() - 1000 * ONE_DAY_MS).toISOString(),
      user_metadata: {
        full_name: 'Admin User',
        subscription_tier: 'enterprise',
        is_admin: true,
      },
    },
    session: {
      access_token: 'mock-access-token-admin',
      refresh_token: 'mock-refresh-token-admin',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    metadata: {
      subscriptionTier: 'enterprise',
      subscriptionStatus: 'active',
      subscriptionEndsAt: new Date(Date.now() + 365 * ONE_DAY_MS).toISOString(),
      accountCreatedAt: new Date(Date.now() - 1000 * ONE_DAY_MS).toISOString(),
      lastLoginAt: NOW,
      totalLogins: 5420,
      connectedAccounts: 50,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a mock account by type
 */
export function getMockAccount(type: MockAccountType): MockAccount {
  return mockAccounts[type];
}

/**
 * Get all mock accounts as an array
 */
export function getAllMockAccounts(): MockAccount[] {
  return Object.values(mockAccounts);
}

/**
 * Check if a mock account has premium features
 */
export function hasPremiumAccess(account: MockAccount): boolean {
  return (
    account.metadata.subscriptionStatus === 'active' ||
    account.metadata.subscriptionStatus === 'trial'
  ) && account.metadata.subscriptionTier !== 'free';
}

/**
 * Check if account is in trial period
 */
export function isTrialAccount(account: MockAccount): boolean {
  return account.metadata.subscriptionStatus === 'trial';
}

/**
 * Get days remaining in trial or subscription
 */
export function getDaysRemaining(account: MockAccount): number | null {
  const endDate = account.metadata.trialEndsAt || account.metadata.subscriptionEndsAt;
  if (!endDate) return null;
  
  const remaining = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / ONE_DAY_MS));
}

/**
 * Check if account is an admin
 */
export function isAdminAccount(account: MockAccount): boolean {
  return account.type === 'admin_user';
}

// Default export for easy switching
export const defaultMockAccount = mockAccounts.premium_user;
