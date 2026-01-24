import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  useMT5LiveFeed, 
  formatCurrency, 
  formatLots, 
  formatPrice,
  type MT5Position,
  type MT5Tick
} from "@/hooks/useMT5LiveFeed";
import { 
  Loader2, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react";

/**
 * MT5 Live Dashboard Component
 * Displays real-time trading data from MetaTrader 5
 */
export function MT5LiveDashboard() {
  const { snapshot, isLoading, error, isConnected, lastUpdate, refresh } = useMT5LiveFeed();

  // Loading state
  if (isLoading && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to MT5...</p>
      </div>
    );
  }

  // Error state
  if (error && !snapshot) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Connection Error
          </CardTitle>
          <CardDescription>
            Failed to connect to MT5 API server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Troubleshooting steps:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Make sure MetaTrader 5 terminal is running</li>
              <li>Start the Flask API server: <code className="bg-background px-1 rounded">python mt5_api_server.py</code></li>
              <li>Verify the server is running on <code className="bg-background px-1 rounded">http://localhost:5000</code></li>
              <li>Check your MT5 credentials in <code className="bg-background px-1 rounded">.env.mt5</code></li>
            </ol>
          </div>
          <Button onClick={refresh} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!snapshot) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No live feed data available.</p>
          <Button onClick={refresh} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const profitColor = (snapshot.profit || 0) >= 0 ? "text-green-600" : "text-red-600";
  const profitBg = (snapshot.profit || 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10";

  return (
    <div className="space-y-6">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
              <WifiOff className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {snapshot.server} • Account #{snapshot.login}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Account Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(snapshot.balance, snapshot.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Leverage: 1:{snapshot.leverage}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equity</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(snapshot.equity, snapshot.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Free Margin: {formatCurrency(snapshot.margin_free, snapshot.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used Margin</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(snapshot.margin, snapshot.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Margin Level: {snapshot.margin_level ? `${snapshot.margin_level.toFixed(1)}%` : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card className={profitBg}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Floating P/L</CardTitle>
            {(snapshot.profit || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitColor}`}>
              {formatCurrency(snapshot.profit, snapshot.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {snapshot.positions_count} open position{snapshot.positions_count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Open Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Open Positions
            <Badge variant="secondary" className="ml-auto">
              {snapshot.positions_count}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot.positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No open positions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.positions.map((position: MT5Position) => (
                <PositionRow key={position.ticket} position={position} currency={snapshot.currency} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Market Prices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Live Market Prices
          </CardTitle>
          <CardDescription>
            Real-time bid/ask prices from MT5
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(snapshot.ticks).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No market data available</p>
              <p className="text-xs mt-1">Check MT5_TICKERS in .env.mt5</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(snapshot.ticks).map(([symbol, tick]: [string, MT5Tick]) => (
                <TickCard key={symbol} symbol={symbol} tick={tick} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Position Row Component
 */
function PositionRow({ position, currency }: { position: MT5Position; currency: string }) {
  const isBuy = position.type === "BUY";
  const isProfit = position.profit >= 0;
  
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isBuy ? (
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          )}
        </div>
        <div>
          <div className="font-medium flex items-center gap-2">
            {position.symbol}
            <Badge variant={isBuy ? "default" : "destructive"} className="text-xs">
              {position.type}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatLots(position.volume)} lots @ {formatPrice(position.price_open)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="font-medium">
          {formatPrice(position.price_current)}
        </div>
        <div className={`text-sm font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
          {isProfit ? '+' : ''}{formatCurrency(position.profit, currency)}
        </div>
      </div>
    </div>
  );
}

/**
 * Tick Card Component
 */
function TickCard({ symbol, tick }: { symbol: string; tick: MT5Tick }) {
  const spread = tick.ask - tick.bid;
  const decimals = symbol.includes("JPY") ? 3 : symbol.includes("XAU") ? 2 : 5;
  
  return (
    <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="font-medium mb-3 flex items-center justify-between">
        <span>{symbol}</span>
        <Badge variant="outline" className="text-xs">
          Spread: {(spread * (decimals === 3 ? 100 : decimals === 2 ? 10 : 100000)).toFixed(1)}
        </Badge>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Bid</span>
          <span className="font-mono text-red-600">{formatPrice(tick.bid, decimals)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Ask</span>
          <span className="font-mono text-green-600">{formatPrice(tick.ask, decimals)}</span>
        </div>
      </div>
    </div>
  );
}

export default MT5LiveDashboard;
