import { TradingAccount } from '@/hooks/useTradingAccounts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MoreHorizontal, TrendingUp, TrendingDown, RefreshCw, Trash2, Server, User, Zap, ExternalLink, Wifi, WifiOff, Loader2, Power, PowerOff, Key, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ConnectionSnapshot, ConnectionStatus, LicenseStatus } from '@/types/connections';
import { getStatusBadgeClass, formatConnectionStatus } from '@/lib/desktop';

interface AccountCardProps {
  account: TradingAccount;
  onDelete: (id: string) => void;
  onSync?: (id: string) => void;
  onClick?: (account: TradingAccount) => void;
  /** Connection snapshot for this account (from useConnectionsFeed) */
  connectionSnapshot?: ConnectionSnapshot | null;
  /** Callback to connect the account */
  onConnect?: (account: TradingAccount) => void;
  /** Callback to disconnect the account */
  onDisconnect?: (account: TradingAccount) => void;
  /** Whether a connection operation is in progress */
  isConnecting?: boolean;
}

export const AccountCard = ({ 
  account, 
  onDelete, 
  onSync, 
  onClick,
  connectionSnapshot,
  onConnect,
  onDisconnect,
  isConnecting = false,
}: AccountCardProps) => {
  const pnl = Number(account.pnl) || 0;
  const pnlPercent = Number(account.pnl_percent) || 0;
  const isProfit = pnl >= 0;
  
  const profitTarget = Number(account.profit_target) || 0;
  const maxLoss = Number(account.max_loss) || 0;
  const accountSize = Number(account.account_size) || 0;
  
  // Calculate progress towards profit target
  const progressPercent = profitTarget > 0 ? Math.min((pnlPercent / profitTarget) * 100, 100) : 0;
  
  // Calculate remaining drawdown
  const drawdownUsed = pnl < 0 ? Math.abs(pnlPercent) : 0;
  const drawdownRemaining = maxLoss > 0 ? Math.max(maxLoss - drawdownUsed, 0) : maxLoss;

  // Connection state
  const connectionStatus: ConnectionStatus = connectionSnapshot?.session.status || 'disconnected';
  const isConnected = connectionStatus === 'connected';
  const isConnectionActive = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';
  const hasConnectionError = connectionStatus === 'error';
  
  // License state from connection snapshot
  const licenseStatus: LicenseStatus = connectionSnapshot?.license?.status || connectionSnapshot?.session.licenseStatus || 'not-configured';
  const isLicenseValid = licenseStatus === 'valid';
  const isLicenseExpired = licenseStatus === 'expired';
  const hasLicenseError = licenseStatus === 'error' || licenseStatus === 'invalid';
  const licenseErrorMsg = connectionSnapshot?.license?.errorMessage || connectionSnapshot?.session.licenseError;
  
  // Live metrics from connection (if connected)
  const liveBalance = connectionSnapshot?.metrics?.balance;
  const liveEquity = connectionSnapshot?.metrics?.equity;
  const liveProfit = connectionSnapshot?.metrics?.profit;
  const positionCount = connectionSnapshot?.metrics?.positionCount ?? 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const phaseConfig = {
    evaluation: {
      badge: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      border: 'hover:border-yellow-500/50 hover:shadow-yellow-500/10',
      glow: 'group-hover:shadow-yellow-500/20',
      label: 'Evaluation',
    },
    funded: {
      badge: 'bg-primary/20 text-primary border-primary/30',
      border: 'hover:border-primary/50 hover:shadow-primary/10',
      glow: 'group-hover:shadow-primary/20',
      label: 'Funded',
    },
    live: {
      badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      border: 'hover:border-blue-500/50 hover:shadow-blue-500/10',
      glow: 'group-hover:shadow-blue-500/20',
      label: 'Hedge',
    },
  };

  const config = phaseConfig[account.phase];
  const isHedgeAccount = account.phase === 'live';

  const handleCardClick = () => {
    if (onClick) {
      onClick(account);
    }
  };

  return (
    <Card 
      className={cn(
        "border-border/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm transition-all duration-300 group hover:shadow-lg",
        config.border,
        config.glow,
        onClick && "cursor-pointer"
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{account.account_name}</h3>
            <Badge variant="outline" className={cn('text-xs transition-all group-hover:scale-105', config.badge)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isHedgeAccount 
              ? `${account.platform} - ${account.server}`
              : `${account.prop_firm || 'Personal'} - ${account.platform}`
            }
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="animate-scale-in">
            {onSync && (
              <DropdownMenuItem onClick={() => onSync(account.id)} className="cursor-pointer">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Account
              </DropdownMenuItem>
            )}
            {/* Connection controls */}
            {isHedgeAccount && onConnect && !isConnected && !isConnectionActive && (
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onConnect(account); }} 
                className="cursor-pointer"
              >
                <Power className="mr-2 h-4 w-4" />
                Connect
              </DropdownMenuItem>
            )}
            {isHedgeAccount && onDisconnect && isConnected && (
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDisconnect(account); }} 
                className="cursor-pointer"
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(account.id)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        {isHedgeAccount ? (
          /* Hedge Account Display */
          <>
            {/* License Status Banner (show only when there's an issue or not valid) */}
            {isConnected && licenseStatus !== 'not-configured' && !isLicenseValid && (
              <div className={cn(
                "flex items-center justify-between p-2 rounded-lg mb-3 transition-colors",
                isLicenseExpired ? "bg-yellow-500/10" :
                hasLicenseError ? "bg-destructive/10" : "bg-muted/30"
              )}>
                <div className="flex items-center gap-2">
                  {isLicenseExpired ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                  ) : hasLicenseError ? (
                    <Key className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    isLicenseExpired ? "text-yellow-500" :
                    hasLicenseError ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {isLicenseExpired ? 'License Expired' :
                     hasLicenseError ? 'License Invalid' :
                     licenseStatus === 'checking' ? 'Checking License...' : 'No License'}
                  </span>
                </div>
                {connectionSnapshot?.license?.daysRemaining != null && connectionSnapshot.license.daysRemaining <= 7 && (
                  <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                    {connectionSnapshot.license.daysRemaining}d left
                  </Badge>
                )}
              </div>
            )}

            {/* License Valid Indicator (subtle when valid) */}
            {isConnected && isLicenseValid && connectionSnapshot?.license?.daysRemaining != null && connectionSnapshot.license.daysRemaining <= 30 && (
              <div className="flex items-center justify-between p-2 rounded-lg mb-3 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Licensed</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  {connectionSnapshot.license.daysRemaining}d remaining
                </Badge>
              </div>
            )}

            {/* Live Metrics (if connected) */}
            {isConnected && liveBalance != null && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-2 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(liveBalance)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">Equity</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(liveEquity ?? liveBalance)}
                  </p>
                </div>
              </div>
            )}

            {/* Live P&L (if connected and has floating) */}
            {isConnected && liveProfit != null && liveProfit !== 0 && (
              <div className={cn(
                "p-2 rounded-lg mb-3",
                liveProfit >= 0 ? "bg-primary/10" : "bg-destructive/10"
              )}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Floating P&L</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    liveProfit >= 0 ? "text-primary" : "text-destructive"
                  )}>
                    {liveProfit >= 0 ? '+' : ''}{formatCurrency(liveProfit)}
                  </span>
                </div>
              </div>
            )}

            {/* Account Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 transition-colors hover:bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Login</p>
                  <p className="text-sm font-medium text-foreground">{account.login || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 transition-colors hover:bg-muted/50">
                <Server className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Server</p>
                  <p className="text-sm font-medium text-foreground">{account.server || '—'}</p>
                </div>
              </div>
            </div>

            {/* Quick Connect Button (if not connected) */}
            {!isConnected && !isConnectionActive && onConnect && (
              <div className="pt-3 border-t border-border/30 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => { e.stopPropagation(); onConnect(account); }}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  ) : (
                    <Power className="w-3.5 h-3.5 mr-2" />
                  )}
                  Connect Account
                </Button>
              </div>
            )}

            {/* Connection Error */}
            {hasConnectionError && connectionSnapshot?.session.error && (
              <div className="pt-2 text-xs text-destructive">
                {connectionSnapshot.session.error}
              </div>
            )}
          </>
        ) : (
          /* Evaluation/Funded Account Display */
          <>
            {/* Balance & P&L */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-2 rounded-lg bg-muted/20 transition-all hover:bg-muted/30">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(Number(account.current_balance) || accountSize)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/20 transition-all hover:bg-muted/30">
                <p className="text-xs text-muted-foreground">P&L</p>
                <div className="flex items-center gap-1">
                  {isProfit ? (
                    <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={cn('text-lg font-semibold transition-colors', isProfit ? 'text-primary' : 'text-destructive')}>
                    {formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bars */}
            {(profitTarget > 0 || maxLoss > 0) && (
              <div className="space-y-3">
                {profitTarget > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit Target</span>
                      <span className="text-foreground font-medium">{pnlPercent.toFixed(1)}% / {profitTarget}%</span>
                    </div>
                    <div className="relative">
                      <Progress value={progressPercent} className="h-2 bg-muted/50" />
                      {progressPercent >= 100 && (
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                )}
                {maxLoss > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Drawdown Remaining</span>
                      <span className="text-foreground font-medium">{drawdownRemaining.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={(drawdownRemaining / maxLoss) * 100} 
                      className="h-2 bg-muted/50 [&>div]:bg-gradient-to-r [&>div]:from-destructive [&>div]:to-destructive/70" 
                    />
                  </div>
                )}
              </div>
            )}

            {/* Trading Days */}
            {account.min_trading_days && account.min_trading_days > 0 && (
              <div className="flex justify-between text-sm p-2 rounded-lg bg-muted/20">
                <span className="text-muted-foreground">Trading Days</span>
                <span className="text-foreground font-medium">
                  {account.trading_days_completed || 0} / {account.min_trading_days}
                </span>
              </div>
            )}

            {/* Account Size */}
            <div className="pt-2 border-t border-border/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Account Size</span>
                <span className="text-foreground font-semibold">{formatCurrency(accountSize)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};