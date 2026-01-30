import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * MT5 Position data structure
 */
export interface MT5Position {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  sl: number;
  tp: number;
  time: string;
  magic: number;
  comment: string;
}

/**
 * MT5 Order data structure
 */
export interface MT5Order {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price_open: number;
  sl: number;
  tp: number;
  time: string;
  magic: number;
  comment: string;
}

/**
 * MT5 Tick data structure
 */
export interface MT5Tick {
  bid: number;
  ask: number;
  last: number;
  volume: number;
  time: string;
}

/**
 * MT5 Snapshot - Complete account state from the Flask API
 */
export interface MT5Snapshot {
  // Account info
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  margin_level: number | null;
  profit: number;
  leverage: number;
  currency: string;
  server: string;
  login: number;
  
  // Trading data
  positions: MT5Position[];
  orders: MT5Order[];
  ticks: Record<string, MT5Tick>;
  
  // Counts
  positions_count: number;
  orders_count: number;
  
  // Timestamp
  timestamp: string;
}

/**
 * Hook return type
 */
export interface UseMT5AccountFeedReturn {
  snapshot: MT5Snapshot | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

/**
 * Configuration options for the hook
 */
export interface UseMT5AccountFeedOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number;
  /** Whether to start polling automatically (default: false for account-specific) */
  autoStart?: boolean;
  /** API base URL (default: http://localhost:5000) */
  apiBaseUrl?: string;
  /** Show toast notifications for errors (default: true) */
  showToasts?: boolean;
}

const DEFAULT_OPTIONS: Required<UseMT5AccountFeedOptions> = {
  pollingInterval: 2000,
  autoStart: false,
  apiBaseUrl: "http://localhost:5000",
  showToasts: true,
};

/**
 * Custom hook to fetch live MT5 data for a specific account
 * 
 * @param accountLogin - The MT5 login number for this account
 * @param accountServer - The MT5 server name
 * @param options - Configuration options
 * @returns MT5 snapshot data, loading state, and error information
 */
export function useMT5AccountFeed(
  accountLogin: string | number | null | undefined,
  accountServer: string | null | undefined,
  options?: UseMT5AccountFeedOptions
): UseMT5AccountFeedReturn {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [snapshot, setSnapshot] = useState<MT5Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const { toast } = useToast();

  /**
   * Fetch latest snapshot from Flask API for this specific account
   */
  const fetchLatestSnapshot = useCallback(async () => {
    if (!accountLogin) {
      setError("No account login provided");
      return;
    }

    try {
      setIsLoading(true);
      
      // Pass account credentials to the API
      const response = await fetch(
        `${config.apiBaseUrl}/api/mt5/snapshot?login=${accountLogin}&server=${encodeURIComponent(accountServer || '')}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: MT5Snapshot = await response.json();
      
      // Verify this data is for the correct account
      if (data.login && data.login.toString() !== accountLogin.toString()) {
        throw new Error(`Data returned for wrong account: ${data.login} vs ${accountLogin}`);
      }
      
      setSnapshot(data);
      setError(null);
      setIsConnected(true);
      setLastUpdate(new Date());
      
    } catch (err: any) {
      console.error("Error fetching MT5 snapshot:", err);
      const errorMessage = err.message || "Failed to connect to MT5 API";
      setError(errorMessage);
      setIsConnected(false);
      
      if (config.showToasts && !error) {
        toast({
          title: "MT5 Connection Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [accountLogin, accountServer, config.apiBaseUrl, config.showToasts, error, toast]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchLatestSnapshot();
  }, [fetchLatestSnapshot]);

  /**
   * Start polling for updates
   */
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  /**
   * Stop polling for updates
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  /**
   * Set up polling effect
   */
  useEffect(() => {
    if (!isPolling || !accountLogin) {
      return;
    }

    // Fetch immediately when polling starts
    fetchLatestSnapshot();

    // Set up polling interval
    const interval = setInterval(fetchLatestSnapshot, config.pollingInterval);

    // Cleanup on unmount or when polling stops
    return () => {
      clearInterval(interval);
    };
  }, [isPolling, accountLogin, config.pollingInterval, fetchLatestSnapshot]);

  /**
   * Auto-start polling if configured
   */
  useEffect(() => {
    if (config.autoStart && accountLogin) {
      setIsPolling(true);
    }
  }, [config.autoStart, accountLogin]);

  return {
    snapshot,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    refresh,
    startPolling,
    stopPolling,
  };
}

/**
 * Utility function to format currency values
 */
export function formatCurrency(value: number | null | undefined, currency = "USD"): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Utility function to format percentage values
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "0.00%";
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Utility function to format lot sizes
 */
export function formatLots(value: number | null | undefined): string {
  if (value == null) return "0.00";
  return value.toFixed(2);
}

/**
 * Utility function to format price with appropriate decimals
 */
export function formatPrice(value: number | null | undefined, decimals = 5): string {
  if (value == null) return "0.00000";
  return value.toFixed(decimals);
}

/**
 * Calculate P&L percentage based on initial balance
 */
export function calculatePnLPercent(currentBalance: number, initialBalance: number): number {
  if (initialBalance <= 0) return 0;
  return ((currentBalance - initialBalance) / initialBalance) * 100;
}
