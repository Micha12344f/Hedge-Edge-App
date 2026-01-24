/**
 * React Hook for VPS MT5 Account Data
 * ====================================
 * Use this hook to fetch live MT5 data from your Windows VPS.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAccountSnapshot,
  getAccountBalance,
  validateMT5Credentials,
  checkVPSHealth,
  type MT5Snapshot,
  type MT5Position,
} from '@/lib/vps-mt5-api';

interface UseVPSMT5FeedOptions {
  login: string;
  password: string;
  server: string;
  enabled?: boolean;
  pollInterval?: number; // milliseconds
  fullSnapshot?: boolean; // if false, only fetch balance (faster)
}

interface UseVPSMT5FeedResult {
  // Data
  snapshot: MT5Snapshot | null;
  positions: MT5Position[];
  balance: number;
  equity: number;
  profit: number;
  
  // Status
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdate: Date | null;
  
  // Actions
  refresh: () => Promise<void>;
  validate: () => Promise<boolean>;
}

export function useVPSMT5Feed({
  login,
  password,
  server,
  enabled = true,
  pollInterval = 5000,
  fullSnapshot = true,
}: UseVPSMT5FeedOptions): UseVPSMT5FeedResult {
  const [snapshot, setSnapshot] = useState<MT5Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!login || !password || !server) {
      setError('Missing credentials');
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      if (fullSnapshot) {
        // Get full data including positions
        const result = await getAccountSnapshot(login, password, server);
        
        if (result.success && result.data) {
          setSnapshot(result.data);
          setIsConnected(true);
          setError(null);
          setLastUpdate(new Date());
        } else {
          setError(result.error || 'Failed to fetch data');
          setIsConnected(false);
        }
      } else {
        // Just get balance (faster)
        const result = await getAccountBalance(login, password, server);
        
        if (result.success && result.data) {
          // Update snapshot with balance data
          setSnapshot(prev => prev ? {
            ...prev,
            balance: result.data!.balance,
            equity: result.data!.equity,
            margin: result.data!.margin,
            margin_free: result.data!.margin_free,
            profit: result.data!.profit,
            positions_count: result.data!.positions_count,
            timestamp: result.data!.timestamp,
          } : null);
          setIsConnected(true);
          setError(null);
          setLastUpdate(new Date());
        } else {
          setError(result.error || 'Failed to fetch balance');
          setIsConnected(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [login, password, server, fullSnapshot]);

  const validate = useCallback(async (): Promise<boolean> => {
    if (!login || !password || !server) {
      return false;
    }

    try {
      const result = await validateMT5Credentials(login, password, server);
      return result.success && result.valid === true;
    } catch {
      return false;
    }
  }, [login, password, server]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up polling
    const interval = setInterval(fetchData, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, fetchData, pollInterval]);

  return {
    snapshot,
    positions: snapshot?.positions || [],
    balance: snapshot?.balance || 0,
    equity: snapshot?.equity || 0,
    profit: snapshot?.profit || 0,
    isLoading,
    isConnected,
    error,
    lastUpdate,
    refresh: fetchData,
    validate,
  };
}

/**
 * Hook to check VPS server health
 */
export function useVPSHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [mt5Connected, setMT5Connected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkHealth = useCallback(async () => {
    try {
      setIsChecking(true);
      const result = await checkVPSHealth();
      setIsHealthy(result.status === 'healthy');
      setMT5Connected(result.mt5_connected);
    } catch {
      setIsHealthy(false);
      setMT5Connected(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { isHealthy, mt5Connected, isChecking, checkHealth };
}
