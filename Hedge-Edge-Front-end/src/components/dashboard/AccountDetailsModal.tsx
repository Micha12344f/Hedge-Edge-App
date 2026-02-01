import { useEffect, useRef, useState } from "react";
import { TradingAccount } from "@/hooks/useTradingAccounts";
import { useVPSMT5Feed } from "@/hooks/useVPSMT5Feed";
import { getCachedPassword, cachePassword } from "@/lib/mt5-password-cache";
import { mt5, ctrader, isBridgeAvailable, type TradingPlatform } from "@/lib/local-trading-bridge";
import type { Position } from "@/lib/local-trading-bridge";
import type { ConnectionSnapshot, ConnectionStatus as ConnectionStatusType } from "@/types/connections";
import { getStatusBadgeClass, formatConnectionStatus } from "@/lib/desktop";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  WifiOff,
  Lock,
  Server,
  Power,
  PowerOff,
} from "lucide-react";

// Type alias for backwards compatibility  
type MT5Position = Position;

// Formatting utilities
const formatCurrency = (value: number, currency = "USD"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatLots = (volume: number): string => volume.toFixed(2);
const formatPrice = (price: number): string => price.toFixed(5);
const formatPercent = (value: number): string => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};
const calculatePnLPercent = (currentBalance: number, startingBalance: number): number => {
  if (startingBalance === 0) return 0;
  return ((currentBalance - startingBalance) / startingBalance) * 100;
};

interface AccountDetailsModalProps {
  account: TradingAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncAccount?: (id: string, data: { balance: number; equity: number; profit: number }) => void;
  /** Connection snapshot for this account (from useConnectionsFeed) */
  connectionSnapshot?: ConnectionSnapshot | null;
  /** Callback to connect the account */
  onConnect?: (account: TradingAccount, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Callback to disconnect the account */
  onDisconnect?: (account: TradingAccount) => Promise<{ success: boolean; error?: string }>;
}

export function AccountDetailsModal({
  account,
  open,
  onOpenChange,
  onSyncAccount,
  connectionSnapshot,
  onConnect,
  onDisconnect,
}: AccountDetailsModalProps) {
  // Password state for accounts without cached password
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [cachedPassword, setCachedPassword] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  
  // Terminal status
  const [terminalStatus, setTerminalStatus] = useState<'checking' | 'running' | 'not-running'>('checking');
  
  // File-based EA status - when true, we can connect without password
  const [hasFileBasedEA, setHasFileBasedEA] = useState(false);

  // Get the appropriate bridge based on platform
  const getBridge = (platform: string | null | undefined) => {
    return platform?.toLowerCase() === 'ctrader' ? ctrader : mt5;
  };

  // Connection state from supervisor (if provided)
  const supervisedStatus: ConnectionStatusType = connectionSnapshot?.session.status || 'disconnected';
  const isSupervisedConnected = supervisedStatus === 'connected';
  const hasSupervisedMetrics = connectionSnapshot?.metrics != null;

  // Check for cached password, terminal status, and file-based EA when modal opens
  useEffect(() => {
    if (open && account?.login && account?.server) {
      const cached = getCachedPassword(account.login, account.server);
      if (cached) {
        setCachedPassword(cached);
        setNeedsPassword(false);
      } else {
        setCachedPassword(null);
        setNeedsPassword(true);
      }
      
      // Check terminal status via IPC
      if (isBridgeAvailable()) {
        setTerminalStatus('checking');
        setHasFileBasedEA(false);
        const bridge = getBridge(account.platform);
        
        // Check terminal status
        bridge.getStatus()
          .then(async (result) => {
            setTerminalStatus(result.success && result.data?.terminalRunning ? 'running' : 'not-running');
            
            // If terminal is running, check if we can get a snapshot for this specific account
            // This means file-based EA is available for this account (no password needed)
            if (result.success && result.data?.terminalRunning && account.platform?.toLowerCase() === 'mt5') {
              try {
                // Ensure we pass proper strings to IPC
                const snapshotResult = await bridge.getSnapshot({ 
                  login: String(account.login || ''), 
                  password: '', 
                  server: String(account.server || '') 
                });
                if (snapshotResult.success && snapshotResult.data) {
                  // File-based EA has data for this account - no password needed
                  setHasFileBasedEA(true);
                  setNeedsPassword(false);
                }
              } catch {
                // Snapshot failed - may need password for direct connection
              }
            }
          })
          .catch(() => setTerminalStatus('not-running'));
      } else {
        setTerminalStatus('not-running');
      }
    }
  }, [open, account?.login, account?.server, account?.platform]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setPassword("");
      setIsSubmittingPassword(false);
      setHasFileBasedEA(false);
    }
  }, [open]);

  // Use VPS MT5 feed hook - enabled when:
  // 1. Modal is open AND terminal is running AND
  // 2. Either file-based EA is available (no password needed) OR we have cached password
  const {
    snapshot,
    positions,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    refresh,
  } = useVPSMT5Feed({
    login: account?.login || "",
    password: cachedPassword || "",
    server: account?.server || "",
    enabled: open && terminalStatus === 'running' && (hasFileBasedEA || (!!cachedPassword && !needsPassword)),
    pollInterval: 3000,
    fullSnapshot: true,
  });

  // Track if we've synced this session
  const hasSynced = useRef(false);

  // Reset sync flag when modal opens
  useEffect(() => {
    if (open) {
      hasSynced.current = false;
    }
  }, [open]);

  // Sync account data when we get MT5 snapshot
  useEffect(() => {
    if (snapshot && account && onSyncAccount && !hasSynced.current) {
      onSyncAccount(account.id, {
        balance: snapshot.balance,
        equity: snapshot.equity,
        profit: snapshot.profit,
      });
      hasSynced.current = true;
    }
  }, [snapshot, account, onSyncAccount]);

  // Handle password submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !account?.login || !account?.server) return;
    
    setIsSubmittingPassword(true);
    
    // If we have the connection supervisor callback, use it
    if (onConnect) {
      const result = await onConnect(account, password);
      if (result.success) {
        cachePassword(account.login, password, account.server);
        setCachedPassword(password);
        setNeedsPassword(false);
      }
    } else {
      // Legacy behavior - just cache the password
      cachePassword(account.login, password, account.server);
      setCachedPassword(password);
      setNeedsPassword(false);
    }
    
    setIsSubmittingPassword(false);
  };

  if (!account) return null;

  // Calculate actual P&L from MT5 data or account data
  const accountSize = Number(account.account_size) || 0;
  const mt5Balance = snapshot?.balance || 0;
  
  // Calculate P&L based on actual balance vs account size
  const actualPnL = mt5Balance > 0 ? mt5Balance - accountSize : Number(account.pnl) || 0;
  const actualPnLPercent = accountSize > 0 ? calculatePnLPercent(mt5Balance || accountSize, accountSize) : 0;
  const isProfit = actualPnL >= 0;

  const phaseConfig = {
    evaluation: {
      badge: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      label: "Evaluation",
    },
    funded: {
      badge: "bg-primary/20 text-primary border-primary/30",
      label: "Funded",
    },
    live: {
      badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      label: "Hedge",
    },
  };

  const config = phaseConfig[account.phase];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                {account.account_name}
                <Badge variant="outline" className={config.badge}>
                  {config.label}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {account.prop_firm || "Personal"} • {account.platform}
              </SheetDescription>
            </div>
          </div>

          {/* VPS and Connection Status */}
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg mt-2">
            <div className="flex items-center gap-2">
              {/* Supervised Connection Status (if using connection supervisor) */}
              {connectionSnapshot && (
                <Badge
                  variant="outline"
                  className={getStatusBadgeClass(supervisedStatus)}
                >
                  {isSupervisedConnected ? (
                    <Wifi className="h-3 w-3 mr-1" />
                  ) : supervisedStatus === 'connecting' || supervisedStatus === 'reconnecting' ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <WifiOff className="h-3 w-3 mr-1" />
                  )}
                  {formatConnectionStatus(supervisedStatus)}
                </Badge>
              )}
              
              {/* Legacy Connection Status (fallback when not using supervisor) */}
              {!connectionSnapshot && (
                <Badge
                  variant="outline"
                  className={
                    terminalStatus === 'running' 
                      ? "bg-primary/10 text-primary border-primary/20"
                      : terminalStatus === 'not-running'
                      ? "bg-red-500/10 text-red-500 border-red-500/20"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  <Server className="h-3 w-3 mr-1" />
                  {terminalStatus === 'checking' ? 'Connecting...' : terminalStatus === 'running' ? 'Connected' : 'Offline'}
                </Badge>
              )}
              
              {/* MT5 Connection (legacy) */}
              {!connectionSnapshot && !needsPassword && terminalStatus === 'running' && (
                (isConnected || snapshot) ? (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    <Wifi className="h-3 w-3 mr-1" />
                    MT5 Connected
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-red-500/10 text-red-500 border-red-500/20"
                  >
                    <WifiOff className="h-3 w-3 mr-1" />
                    Disconnected
                  </Badge>
                )
              )}
              
              {/* Live metrics indicator */}
              {hasSupervisedMetrics && connectionSnapshot?.metrics?.positionCount != null && (
                <Badge variant="secondary" className="text-xs">
                  {connectionSnapshot.metrics.positionCount} position{connectionSnapshot.metrics.positionCount !== 1 ? 's' : ''}
                </Badge>
              )}
              
              {snapshot && !connectionSnapshot && (
                <span className="text-xs text-muted-foreground">
                  #{snapshot.login}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Last update time */}
              {(connectionSnapshot?.timestamp || lastUpdate) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {connectionSnapshot?.timestamp 
                    ? new Date(connectionSnapshot.timestamp).toLocaleTimeString()
                    : lastUpdate?.toLocaleTimeString()}
                </span>
              )}
              
              {/* Connect/Disconnect buttons */}
              {onConnect && onDisconnect && !isSupervisedConnected && supervisedStatus !== 'connecting' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (cachedPassword && account) {
                      onConnect(account, cachedPassword);
                    } else {
                      setNeedsPassword(true);
                    }
                  }}
                  disabled={!cachedPassword && !needsPassword}
                >
                  <Power className="h-3.5 w-3.5 mr-1" />
                  Connect
                </Button>
              )}
              
              {onDisconnect && isSupervisedConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => account && onDisconnect(account)}
                >
                  <PowerOff className="h-3.5 w-3.5 mr-1" />
                  Disconnect
                </Button>
              )}
              
              {/* Refresh button (legacy) */}
              {!connectionSnapshot && !needsPassword && terminalStatus === 'running' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4">
          <div className="space-y-4 pr-4">
            
            {/* Password Required - only show if no file-based EA available */}
            {needsPassword && !hasFileBasedEA && (terminalStatus === 'running' || connectionSnapshot) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4" />
                    Enter MT5 Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      To view live account data, please enter your MT5 password.
                      It will be cached securely for this session.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="mt5-password">MT5 Password</Label>
                      <Input
                        id="mt5-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-muted/30 border-border/50"
                      />
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>Login: {account.login}</span>
                      <span>•</span>
                      <span>Server: {account.server}</span>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={!password || isSubmittingPassword}
                    >
                      {isSubmittingPassword ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4 mr-2" />
                      )}
                      Connect to Account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Live Metrics from Connection Supervisor */}
            {hasSupervisedMetrics && connectionSnapshot?.metrics && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="text-xl font-bold">
                        {formatCurrency(connectionSnapshot.metrics.balance)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <PiggyBank className="h-3 w-3" />
                        Equity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="text-xl font-bold">
                        {formatCurrency(connectionSnapshot.metrics.equity)}
                      </div>
                      {connectionSnapshot.metrics.freeMargin != null && (
                        <p className="text-xs text-muted-foreground">
                          Free: {formatCurrency(connectionSnapshot.metrics.freeMargin)}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Used Margin
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="text-xl font-bold">
                        {formatCurrency(connectionSnapshot.metrics.margin ?? 0)}
                      </div>
                      {connectionSnapshot.metrics.marginLevel != null && (
                        <p className="text-xs text-muted-foreground">
                          Level: {connectionSnapshot.metrics.marginLevel.toFixed(1)}%
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={connectionSnapshot.metrics.profit >= 0 ? "bg-primary/5" : "bg-red-500/5"}>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        {connectionSnapshot.metrics.profit >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-primary" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        Floating P&L
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className={`text-xl font-bold ${connectionSnapshot.metrics.profit >= 0 ? "text-primary" : "text-red-500"}`}>
                        {connectionSnapshot.metrics.profit >= 0 ? '+' : ''}{formatCurrency(connectionSnapshot.metrics.profit)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Positions from Connection Supervisor */}
                {connectionSnapshot.positions && connectionSnapshot.positions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Open Positions
                        <Badge variant="secondary" className="ml-auto">
                          {connectionSnapshot.positions.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {connectionSnapshot.positions.map((position) => (
                          <ConnectionPositionRow
                            key={position.ticket}
                            position={position}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Connection Unavailable */}
            {terminalStatus === 'not-running' && (
              <Card className="border-orange-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-500 text-sm">
                    <Server className="h-4 w-4" />
                    Connection Unavailable
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Unable to connect to your trading terminal. Make sure it's running locally.
                  </p>
                  <Button 
                    onClick={() => {
                      setTerminalStatus('checking');
                      const bridge = getBridge(account?.platform);
                      bridge.getStatus()
                        .then(result => setTerminalStatus(result.success && result.data?.terminalRunning ? 'running' : 'not-running'))
                        .catch(() => setTerminalStatus('not-running'));
                    }} 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Checking Connection */}
            {terminalStatus === 'checking' && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Checking connection...
                </p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && !snapshot && !needsPassword && terminalStatus === 'running' && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Connecting to MT5...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && !snapshot && !needsPassword && terminalStatus === 'running' && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Connection Error
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <div className="flex gap-2">
                    <Button onClick={refresh} variant="outline" size="sm" className="flex-1">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                    <Button 
                      onClick={() => {
                        setNeedsPassword(true);
                        setCachedPassword(null);
                      }} 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Re-enter Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Account Overview Cards (legacy - when not using connection supervisor) */}
            {!hasSupervisedMetrics && (snapshot || (!needsPassword && !error)) && terminalStatus === 'running' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="text-xl font-bold">
                        {snapshot
                          ? formatCurrency(snapshot.balance, snapshot.currency)
                          : formatCurrency(Number(account.current_balance) || accountSize)}
                      </div>
                      {snapshot && (
                        <p className="text-xs text-muted-foreground">
                          Leverage: 1:{snapshot.leverage}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <PiggyBank className="h-3 w-3" />
                        Equity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="text-xl font-bold">
                        {snapshot
                          ? formatCurrency(snapshot.equity, snapshot.currency)
                          : formatCurrency(Number(account.current_balance) || accountSize)}
                      </div>
                      {snapshot && (
                        <p className="text-xs text-muted-foreground">
                          Free: {formatCurrency(snapshot.margin_free, snapshot.currency)}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Used Margin
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="text-xl font-bold">
                        {snapshot
                          ? formatCurrency(snapshot.margin, snapshot.currency)
                          : "$0.00"}
                      </div>
                      {snapshot && (
                        <p className="text-xs text-muted-foreground">
                          Level: {snapshot.margin_level ? `${snapshot.margin_level.toFixed(1)}%` : "N/A"}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={isProfit ? "bg-primary/5" : "bg-red-500/5"}>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        {isProfit ? (
                          <TrendingUp className="h-3 w-3 text-primary" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        Total P&L
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className={`text-xl font-bold ${isProfit ? "text-primary" : "text-red-500"}`}>
                        {snapshot 
                          ? formatCurrency(actualPnL, snapshot.currency)
                          : formatCurrency(actualPnL)}
                      </div>
                      <p className={`text-xs ${isProfit ? "text-primary" : "text-red-500"}`}>
                        {formatPercent(actualPnLPercent)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Floating P&L (unrealized) */}
                {snapshot && snapshot.profit !== 0 && (
                  <Card className={snapshot.profit >= 0 ? "bg-primary/5 border-primary/20" : "bg-red-500/5 border-red-500/20"}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Floating P&L (Unrealized)</span>
                        <span className={`text-lg font-bold ${snapshot.profit >= 0 ? "text-primary" : "text-red-500"}`}>
                          {formatCurrency(snapshot.profit, snapshot.currency)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Account Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Account Size</span>
                      <span className="font-medium">{formatCurrency(accountSize)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Login</span>
                      <span className="font-mono">{account.login || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Server</span>
                      <span className="font-mono">{account.server || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform</span>
                      <span>{account.platform || "MT5"}</span>
                    </div>
                    {snapshot && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Broker</span>
                          <span>{snapshot.broker}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Account Name</span>
                          <span>{snapshot.name}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Open Positions */}
                {snapshot && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Open Positions
                        <Badge variant="secondary" className="ml-auto">
                          {snapshot.positions_count}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {positions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No open positions</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {positions.map((position) => (
                            <PositionRow
                              key={position.ticket}
                              position={position}
                              currency={snapshot.currency}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Position Row Component (for Connection Supervisor positions)
 */
function ConnectionPositionRow({
  position,
}: {
  position: {
    ticket: number;
    symbol: string;
    type: 'buy' | 'sell';
    volume: number;
    openPrice: number;
    currentPrice: number;
    profit: number;
  };
}) {
  const isBuy = position.type === 'buy';
  const isProfit = position.profit >= 0;

  return (
    <div className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <div
          className={`p-1.5 rounded-full ${
            isBuy ? "bg-primary/10" : "bg-red-500/10"
          }`}
        >
          {isBuy ? (
            <ArrowUpRight className="h-3 w-3 text-primary" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium flex items-center gap-1">
            {position.symbol}
            <Badge
              variant={isBuy ? "default" : "destructive"}
              className="text-[10px] px-1 py-0"
            >
              {position.type.toUpperCase()}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatLots(position.volume)} lots @ {formatPrice(position.openPrice)}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-medium">
          {formatPrice(position.currentPrice)}
        </div>
        <div
          className={`text-xs font-medium ${
            isProfit ? "text-primary" : "text-red-500"
          }`}
        >
          {isProfit ? "+" : ""}
          {formatCurrency(position.profit)}
        </div>
      </div>
    </div>
  );
}

/**
 * Position Row Component
 */
function PositionRow({
  position,
  currency,
}: {
  position: MT5Position;
  currency: string;
}) {
  const isBuy = position.type === "BUY";
  const isProfit = position.profit >= 0;

  return (
    <div className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <div
          className={`p-1.5 rounded-full ${
            isBuy ? "bg-primary/10" : "bg-red-500/10"
          }`}
        >
          {isBuy ? (
            <ArrowUpRight className="h-3 w-3 text-primary" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium flex items-center gap-1">
            {position.symbol}
            <Badge
              variant={isBuy ? "default" : "destructive"}
              className="text-[10px] px-1 py-0"
            >
              {position.type}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatLots(position.volume)} lots @ {formatPrice(position.price_open)}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-medium">
          {formatPrice(position.price_current)}
        </div>
        <div
          className={`text-xs font-medium ${
            isProfit ? "text-primary" : "text-red-500"
          }`}
        >
          {isProfit ? "+" : ""}
          {formatCurrency(position.profit, currency)}
        </div>
      </div>
    </div>
  );
}

export default AccountDetailsModal;

