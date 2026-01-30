import { useState, useEffect, useCallback, useRef } from 'react';
import { metaApiService, AccountSnapshot, MetaApiAccountInfo, MetaApiPosition, MetaApiOrder } from '@/lib/metaapi';

export interface UseMetaApiAccountResult {
  // Data
  accountInfo: MetaApiAccountInfo | null;
  positions: MetaApiPosition[];
  orders: MetaApiOrder[];
  
  // Status
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdate: Date | null;
  
  // Actions
  refresh: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

/**
 * Hook for fetching live data from a MetaAPI-connected account
 * @param metaApiAccountId - The MetaAPI account ID (not the MT5 login)
 * @param autoStart - Whether to start polling automatically
 */
export function useMetaApiAccount(
  metaApiAccountId: string | null | undefined,
  autoStart = false
): UseMetaApiAccountResult {
  const [accountInfo, setAccountInfo] = useState<MetaApiAccountInfo | null>(null);
  const [positions, setPositions] = useState<MetaApiPosition[]>([]);
  const [orders, setOrders] = useState<MetaApiOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!metaApiAccountId) {
      setError('No MetaAPI account ID provided');
      return;
    }

    if (!metaApiService.isConfigured()) {
      setError('MetaAPI is not configured. Please add VITE_METAAPI_TOKEN to .env');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snapshot = await metaApiService.getAccountSnapshot(metaApiAccountId);
      
      if (snapshot) {
        setAccountInfo(snapshot.accountInfo);
        setPositions(snapshot.positions);
        setOrders(snapshot.orders);
        setConnected(snapshot.connected);
        setLastUpdate(new Date());
      } else {
        setError('Failed to fetch account data');
        setConnected(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [metaApiAccountId]);

  const startPolling = useCallback((intervalMs = 5000) => {
    if (isPollingRef.current) return;
    
    isPollingRef.current = true;
    
    // Fetch immediately
    fetchData();
    
    // Then set up interval
    pollingRef.current = setInterval(() => {
      if (isPollingRef.current) {
        fetchData();
      }
    }, intervalMs);
  }, [fetchData]);

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart && metaApiAccountId) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [autoStart, metaApiAccountId, startPolling, stopPolling]);

  // Reset state when account ID changes
  useEffect(() => {
    setAccountInfo(null);
    setPositions([]);
    setOrders([]);
    setError(null);
    setConnected(false);
    setLastUpdate(null);
  }, [metaApiAccountId]);

  return {
    accountInfo,
    positions,
    orders,
    loading,
    error,
    connected,
    lastUpdate,
    refresh,
    startPolling,
    stopPolling,
  };
}

/**
 * Calculate total P&L from positions
 */
export function calculateTotalPnL(positions: MetaApiPosition[]): number {
  return positions.reduce((total, pos) => {
    return total + (pos.profit || 0) + (pos.swap || 0) + (pos.commission || 0);
  }, 0);
}

/**
 * Calculate account P&L from balance vs initial size
 */
export function calculateAccountPnL(balance: number, initialSize: number): number {
  return balance - initialSize;
}

/**
 * Calculate P&L percentage
 */
export function calculatePnLPercentage(balance: number, initialSize: number): number {
  if (initialSize === 0) return 0;
  return ((balance - initialSize) / initialSize) * 100;
}

export default useMetaApiAccount;
