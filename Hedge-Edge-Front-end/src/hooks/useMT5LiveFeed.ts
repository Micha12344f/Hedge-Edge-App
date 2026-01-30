/**
 * MT5 Live Feed Hook (Backwards Compatibility)
 * =============================================
 * This file re-exports from the new unified useTradingFeed hook
 * for backwards compatibility with existing code.
 * 
 * @deprecated Import from '@/hooks/useTradingFeed' directly
 */

// Re-export everything from the new unified hook
export {
  useTradingFeed as useMT5LiveFeed,
  useTerminalStatus,
  formatCurrency,
  formatPercent,
  formatLots,
  formatPrice,
  type MT5Snapshot,
  type MT5Position,
  type MT5Order,
  type MT5Tick,
  type UseTradingFeedReturn as UseMT5LiveFeedReturn,
  type UseTradingFeedOptions as UseMT5LiveFeedOptions,
} from './useTradingFeed';

// Default export for backwards compatibility
export { useTradingFeed as default } from './useTradingFeed';
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
