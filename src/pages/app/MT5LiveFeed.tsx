import { MT5LiveDashboard } from "@/components/dashboard/MT5LiveDashboard";

/**
 * MT5 Live Feed Page
 * Displays real-time trading data from MetaTrader 5
 */
const MT5LiveFeed = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-foreground">MT5 Live Feed</h1>
        <p className="text-muted-foreground">
          Real-time account data and market prices from MetaTrader 5
        </p>
      </div>

      {/* MT5 Dashboard Component */}
      <MT5LiveDashboard />
    </div>
  );
};

export default MT5LiveFeed;
