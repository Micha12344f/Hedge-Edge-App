import { useEffect, useState, useCallback } from "react";
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
export interface UseMT5LiveFeedReturn {
  snapshot: MT5Snapshot | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Configuration options for the hook
 */
export interface UseMT5LiveFeedOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number;
  /** Whether to start polling automatically (default: true) */
  autoStart?: boolean;
  /** API base URL (default: http://localhost:5000) */
  apiBaseUrl?: string;
  /** Show toast notifications for errors (default: true) */
  showToasts?: boolean;
}

const DEFAULT_OPTIONS: Required<UseMT5LiveFeedOptions> = {
  pollingInterval: 2000,
  autoStart: true,
  apiBaseUrl: "http://localhost:5000",
  showToasts: true,
};

/**
 * Custom hook to fetch live MT5 data from the Flask API server
 * 
 * @param accountId - Optional account identifier for future multi-account support
 * @param options - Configuration options
 * @returns MT5 snapshot data, loading state, and error information
 * 
 * @example
 * ```tsx
 * const { snapshot, isLoading, error, isConnected } = useMT5LiveFeed();
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * 
 * return <div>Balance: ${snapshot?.balance}</div>;
 * ```
 */
export function useMT5LiveFeed(
  accountId?: string | null,
  options?: UseMT5LiveFeedOptions
): UseMT5LiveFeedReturn {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [snapshot, setSnapshot] = useState<MT5Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const { toast } = useToast();

  /**
   * Fetch latest snapshot from Flask API
   */
  const fetchLatestSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/mt5/snapshot`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: MT5Snapshot = await response.json();
      
      setSnapshot(data);
      setError(null);
      setIsConnected(true);
      setLastUpdate(new Date());
      
    } catch (err: any) {
      console.error("Error fetching MT5 snapshot:", err);
      const errorMessage = err.message || "Failed to connect to MT5 API";
      setError(errorMessage);
      setIsConnected(false);
      
      // Only show toast on first error or if it's a new error
      if (config.showToasts && !error) {
        toast({
          title: "MT5 Connection Error",
          description: "Failed to connect to MT5 API. Make sure the Flask server is running on port 5000.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [config.apiBaseUrl, config.showToasts, error, toast]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchLatestSnapshot();
  }, [fetchLatestSnapshot]);

  /**
   * Set up polling effect
   */
  useEffect(() => {
    if (!config.autoStart) {
      setIsLoading(false);
      return;
    }

    // Fetch immediately on mount
    fetchLatestSnapshot();

    // Set up polling interval
    const interval = setInterval(fetchLatestSnapshot, config.pollingInterval);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
    };
  }, [config.autoStart, config.pollingInterval, fetchLatestSnapshot]);

  return {
    snapshot,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    refresh,
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
  return `${value.toFixed(2)}%`;
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
