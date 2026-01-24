/**
 * MetaAPI Cloud Service
 * Provides cloud-based MT5 connection for SaaS applications
 * Documentation: https://metaapi.cloud/docs/client/
 */

const METAAPI_TOKEN = import.meta.env.VITE_METAAPI_TOKEN;
// Fixed API URLs - removed duplicate domain
const METAAPI_BASE_URL = 'https://mt-provisioning-api-v1.agiliumtrade.ai';
const METAAPI_CLIENT_URL = 'https://mt-client-api-v1.agiliumtrade.ai';

export interface MetaApiAccount {
  _id: string;
  name: string;
  type: string;
  login: string;
  server: string;
  state: string;
  connectionStatus: string;
  platform: 'mt4' | 'mt5';
}

export interface MetaApiAccountInfo {
  broker: string;
  currency: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  name: string;
  login: number;
  credit: number;
  tradeAllowed: boolean;
  investorMode: boolean;
  marginMode: string;
}

export interface MetaApiPosition {
  id: string;
  symbol: string;
  type: 'POSITION_TYPE_BUY' | 'POSITION_TYPE_SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  commission: number;
  currentTickValue?: number;
  openTime: string;
  magic?: number;
  comment?: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface MetaApiOrder {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  state: string;
  openTime: string;
  comment?: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ProvisionAccountRequest {
  name: string;
  login: string;
  password: string;
  server: string;
  platform: 'mt4' | 'mt5';
  type?: 'cloud' | 'cloud-g1' | 'cloud-g2';
  magic?: number;
}

export interface ValidationResult {
  success: boolean;
  accountId?: string;
  error?: string;
  accountInfo?: MetaApiAccountInfo;
}

export interface AccountSnapshot {
  accountInfo: MetaApiAccountInfo;
  positions: MetaApiPosition[];
  orders: MetaApiOrder[];
  connected: boolean;
  timestamp: string;
}

/**
 * MetaAPI Service Class
 * Handles all MetaAPI cloud operations
 */
class MetaApiService {
  private token: string;

  constructor() {
    this.token = METAAPI_TOKEN || '';
    if (!this.token) {
      console.warn('MetaAPI token not found. Set VITE_METAAPI_TOKEN in .env');
    }
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'auth-token': this.token,
    };
  }

  /**
   * Provision a new MT5 account in MetaAPI
   * This validates credentials and creates a cloud connection
   */
  async provisionAccount(request: ProvisionAccountRequest): Promise<ValidationResult> {
    try {
      // First, check if account already exists with this login
      const existingAccount = await this.findAccountByLogin(request.login, request.server);
      
      if (existingAccount) {
        console.log('Found existing account:', existingAccount._id, 'State:', existingAccount.state);
        
        // Account exists, try to deploy and connect
        if (existingAccount.state !== 'DEPLOYED') {
          await this.deployAccount(existingAccount._id);
        }
        
        const accountInfo = await this.waitForConnection(existingAccount._id, 60); // Wait up to 2 minutes
        
        if (accountInfo) {
          return {
            success: true,
            accountId: existingAccount._id,
            accountInfo,
          };
        } else {
          // Account exists but not connecting - might just need more time
          return {
            success: true,
            accountId: existingAccount._id,
            error: 'Account is deploying. It may take 1-2 minutes to connect.',
          };
        }
      }

      // Create new account
      console.log('Creating new MetaAPI account...');
      const response = await fetch(`${METAAPI_BASE_URL}/users/current/accounts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: request.name || `MT5-${request.login}`,
          login: request.login,
          password: request.password,
          server: request.server,
          platform: request.platform || 'mt5',
          type: request.type || 'cloud-g2',
          magic: request.magic || 0,
          application: 'MetaApi',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('MetaAPI create account error:', error);
        return {
          success: false,
          error: error.message || error.error || `Failed to provision account: ${response.status}`,
        };
      }

      const account = await response.json();
      console.log('Account created:', account.id);
      
      // Deploy the account (make it ready for trading)
      console.log('Deploying account...');
      await this.deployAccount(account.id);
      
      // Wait for connection and get account info (up to 2 minutes)
      console.log('Waiting for connection...');
      const accountInfo = await this.waitForConnection(account.id, 60);
      
      if (accountInfo) {
        return {
          success: true,
          accountId: account.id,
          accountInfo,
        };
      }

      // Account created but not yet connected - this is OK, it might just need more time
      return {
        success: true,
        accountId: account.id,
        error: 'Account created and deploying. Connection may take 1-2 minutes.',
      };
    } catch (error) {
      console.error('MetaAPI provision error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to MetaAPI',
      };
    }
  }

  /**
   * Find existing account by login and server
   */
  async findAccountByLogin(login: string, server: string): Promise<MetaApiAccount | null> {
    try {
      const accounts = await this.getAccounts();
      return accounts.find(a => a.login === login && a.server === server) || null;
    } catch (error) {
      console.error('Error finding account:', error);
      return null;
    }
  }

  /**
   * Get all provisioned accounts
   */
  async getAccounts(): Promise<MetaApiAccount[]> {
    try {
      const response = await fetch(`${METAAPI_BASE_URL}/users/current/accounts`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get accounts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting accounts:', error);
      return [];
    }
  }

  /**
   * Deploy an account (enable trading)
   */
  async deployAccount(accountId: string): Promise<boolean> {
    try {
      console.log('Deploying account:', accountId);
      const response = await fetch(`${METAAPI_BASE_URL}/users/current/accounts/${accountId}/deploy`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      console.log('Deploy response status:', response.status);
      
      if (response.ok || response.status === 409) {
        // 409 = already deployed, which is fine
        return true;
      }
      
      const error = await response.text();
      console.error('Deploy error:', error);
      return false;
    } catch (error) {
      console.error('Error deploying account:', error);
      return false;
    }
  }

  /**
   * Wait for account to connect and return account info
   * MetaAPI can take 1-3 minutes for initial deployment
   */
  async waitForConnection(accountId: string, maxAttempts = 60): Promise<MetaApiAccountInfo | null> {
    console.log(`Waiting for connection (up to ${maxAttempts * 2} seconds)...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // First check if the account is deployed
        const accountState = await this.getAccountState(accountId);
        console.log(`Attempt ${i + 1}: Account state: ${accountState?.state}, connection: ${accountState?.connectionStatus}`);
        
        if (accountState?.connectionStatus === 'CONNECTED') {
          // Account is connected, get account info
          const accountInfo = await this.getAccountInfo(accountId);
          if (accountInfo) {
            console.log('Successfully connected! Balance:', accountInfo.balance);
            return accountInfo;
          }
        }
      } catch (error) {
        // Account not yet connected, wait and retry
        console.log(`Attempt ${i + 1}: Not yet connected...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
    
    console.log('Connection timeout reached');
    return null;
  }

  /**
   * Get account state (deployed, connection status)
   */
  async getAccountState(accountId: string): Promise<{ state: string; connectionStatus: string } | null> {
    try {
      const response = await fetch(
        `${METAAPI_BASE_URL}/users/current/accounts/${accountId}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        state: data.state,
        connectionStatus: data.connectionStatus,
      };
    } catch (error) {
      console.error('Error getting account state:', error);
      return null;
    }
  }

  /**
   * Get account information (balance, equity, etc.)
   */
  async getAccountInfo(accountId: string): Promise<MetaApiAccountInfo | null> {
    try {
      const response = await fetch(
        `${METAAPI_CLIENT_URL}/users/current/accounts/${accountId}/account-information`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting account info:', error);
      return null;
    }
  }

  /**
   * Get open positions for an account
   */
  async getPositions(accountId: string): Promise<MetaApiPosition[]> {
    try {
      const response = await fetch(
        `${METAAPI_CLIENT_URL}/users/current/accounts/${accountId}/positions`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  /**
   * Get pending orders for an account
   */
  async getOrders(accountId: string): Promise<MetaApiOrder[]> {
    try {
      const response = await fetch(
        `${METAAPI_CLIENT_URL}/users/current/accounts/${accountId}/orders`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting orders:', error);
      return [];
    }
  }

  /**
   * Get full account snapshot (info + positions + orders)
   */
  async getAccountSnapshot(accountId: string): Promise<AccountSnapshot | null> {
    try {
      const [accountInfo, positions, orders] = await Promise.all([
        this.getAccountInfo(accountId),
        this.getPositions(accountId),
        this.getOrders(accountId),
      ]);

      if (!accountInfo) {
        return null;
      }

      return {
        accountInfo,
        positions,
        orders,
        connected: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting account snapshot:', error);
      return null;
    }
  }

  /**
   * Delete/undeploy an account
   */
  async removeAccount(accountId: string): Promise<boolean> {
    try {
      // First undeploy
      await fetch(`${METAAPI_BASE_URL}/users/current/accounts/${accountId}/undeploy`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      // Then delete
      const response = await fetch(`${METAAPI_BASE_URL}/users/current/accounts/${accountId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return response.ok;
    } catch (error) {
      console.error('Error removing account:', error);
      return false;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return Boolean(this.token);
  }
}

// Export singleton instance
export const metaApiService = new MetaApiService();

// Export types and service
export default metaApiService;
