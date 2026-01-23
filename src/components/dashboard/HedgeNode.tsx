import { TradingAccount } from '@/hooks/useTradingAccounts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertTriangle, 
  Clock,
  Target,
  Shield,
  Flame
} from 'lucide-react';

interface HedgeNodeProps {
  account: TradingAccount;
  isSelected?: boolean;
  isDragging?: boolean;
  isLinkSource?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  position?: { x: number; y: number };
}

type ConnectionStatus = 'connected' | 'lagging' | 'risk';

export const HedgeNode = ({ account, isSelected, isDragging, isLinkSource, onClick, onMouseDown, position }: HedgeNodeProps) => {
  const pnl = Number(account.pnl) || 0;
  const pnlPercent = Number(account.pnl_percent) || 0;
  const isProfit = pnl >= 0;
  
  const profitTarget = Number(account.profit_target) || 0;
  const maxLoss = Number(account.max_loss) || 0;
  const maxDailyLoss = Number(account.max_daily_loss) || 0;
  const accountSize = Number(account.account_size) || 0;
  const currentBalance = Number(account.current_balance) || accountSize;
  
  // Calculate distances
  const equity = currentBalance;
  const distanceToFail = maxLoss > 0 
    ? Math.max(((equity - (accountSize * (1 - maxLoss / 100))) / accountSize) * 100, 0)
    : null;
  const distanceToPass = profitTarget > 0 
    ? Math.max(profitTarget - pnlPercent, 0)
    : null;

  // Determine connection status based on account health
  const getConnectionStatus = (): ConnectionStatus => {
    if (distanceToFail !== null && distanceToFail < 2) return 'risk';
    if (account.last_sync_at) {
      const lastSync = new Date(account.last_sync_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);
      if (diffMinutes > 5) return 'lagging';
    }
    return 'connected';
  };

  const connectionStatus = getConnectionStatus();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    return `${value.toFixed(1)}%`;
  };

  const typeConfig = {
    evaluation: {
      badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      border: 'border-yellow-500/40',
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]',
      hoverGlow: 'hover:shadow-[0_0_25px_rgba(234,179,8,0.25)]',
      label: 'EVALUATION',
      icon: TrendingUp,
    },
    funded: {
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      border: 'border-emerald-500/40',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      hoverGlow: 'hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]',
      label: 'FUNDED',
      icon: TrendingUp,
    },
    live: {
      badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
      border: 'border-blue-500/40',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
      hoverGlow: 'hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]',
      label: 'HEDGE',
      icon: TrendingUp,
    },
  };

  const statusConfig = {
    connected: {
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      icon: Zap,
      label: 'Connected',
      pulse: true,
    },
    lagging: {
      badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      icon: Clock,
      label: 'Lagging',
      pulse: false,
    },
    risk: {
      badge: 'bg-red-500/20 text-red-400 border-red-500/40',
      icon: AlertTriangle,
      label: 'Risk',
      pulse: true,
    },
  };

  const config = typeConfig[account.phase];
  const StatusIcon = statusConfig[connectionStatus].icon;
  const TypeIcon = config.icon;

  // Render simplified version for hedge accounts
  if (account.phase === 'live') {
    return (
      <div
        onClick={onClick}
        onMouseDown={onMouseDown}
        style={position ? { 
          position: 'absolute', 
          left: position.x, 
          top: position.y,
          transform: 'translate(-50%, -50%)',
          filter: isDragging ? 'drop-shadow(0 20px 30px rgba(0,0,0,0.4))' : undefined,
        } : undefined}
        className={cn(
          'w-72 rounded-xl border-2 bg-card/90 backdrop-blur-md cursor-grab active:cursor-grabbing transition-all duration-300 select-none',
          config.border,
          config.glow,
          config.hoverGlow,
          isDragging && 'scale-105 z-50',
          !isDragging && 'hover:scale-[1.02]',
          isSelected && 'ring-2 ring-offset-2 ring-offset-background ring-white/50',
          isLinkSource && 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse'
        )}
      >
        <div className="px-4 py-3">
          {/* Header Row */}
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              config.badge
            )}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', config.badge)}>
              {config.label}
            </Badge>
          </div>

          {/* Platform Info */}
          <p className="text-sm text-muted-foreground mb-3">
            {account.platform || 'MT5'} - {account.login ? account.login.toString().charAt(0) : 'f'}
          </p>

          {/* Connection Details */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 text-muted-foreground mt-0.5">👤</div>
              <div>
                <p className="text-[10px] text-muted-foreground">Login</p>
                <p className="text-xs font-medium text-foreground">{account.login || 'f'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 text-muted-foreground mt-0.5">🖥️</div>
              <div>
                <p className="text-[10px] text-muted-foreground">Server</p>
                <p className="text-xs font-medium text-foreground truncate">{account.server || 'f'}</p>
              </div>
            </div>
          </div>

          {/* Footer Status */}
          <div className="flex items-center justify-between pt-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="outline" className={cn(
              'text-[10px] px-2 py-0.5 flex items-center gap-1',
              statusConfig[connectionStatus].badge,
              statusConfig[connectionStatus].pulse && 'animate-pulse'
            )}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig[connectionStatus].label}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Regular node for evaluation and funded accounts
  return (
    <div
      onClick={onClick}
      onMouseDown={onMouseDown}
      style={position ? { 
        position: 'absolute', 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -50%)',
        filter: isDragging ? 'drop-shadow(0 20px 30px rgba(0,0,0,0.4))' : undefined,
      } : undefined}
      className={cn(
        'w-72 rounded-xl border-2 bg-card/90 backdrop-blur-md cursor-grab active:cursor-grabbing transition-all duration-300 select-none',
        config.border,
        config.glow,
        config.hoverGlow,
        isDragging && 'scale-105 z-50',
        !isDragging && 'hover:scale-[1.02]',
        isSelected && 'ring-2 ring-offset-2 ring-offset-background ring-white/50',
        isLinkSource && 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse',
        connectionStatus === 'risk' && 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            config.badge
          )}>
            <TypeIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground truncate max-w-[120px]">
                {account.account_name}
              </span>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', config.badge)}>
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {account.prop_firm || account.platform || 'Personal'}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={cn(
          'text-[10px] px-1.5 py-0.5 flex items-center gap-1',
          statusConfig[connectionStatus].badge,
          statusConfig[connectionStatus].pulse && 'animate-pulse'
        )}>
          <StatusIcon className="w-3 h-3" />
          {statusConfig[connectionStatus].label}
        </Badge>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Account Size & Equity Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(accountSize)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Equity</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(equity)}</p>
          </div>
        </div>

        {/* Rule Context */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-1.5 rounded-md bg-muted/30">
            <p className="text-[9px] uppercase text-muted-foreground">Daily DD</p>
            <p className="text-xs font-medium text-foreground">{formatPercent(maxDailyLoss)}</p>
          </div>
          <div className="p-1.5 rounded-md bg-muted/30">
            <p className="text-[9px] uppercase text-muted-foreground">Max DD</p>
            <p className="text-xs font-medium text-foreground">{formatPercent(maxLoss)}</p>
          </div>
          <div className="p-1.5 rounded-md bg-muted/30">
            <p className="text-[9px] uppercase text-muted-foreground">Target</p>
            <p className="text-xs font-medium text-foreground">{formatPercent(profitTarget)}</p>
          </div>
        </div>

        {/* Distance Indicators */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
              distanceToFail !== null && distanceToFail < 3 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-muted/30 text-muted-foreground'
            )}>
              <Flame className="w-3 h-3" />
              <span>Fail: {distanceToFail !== null ? `${distanceToFail.toFixed(1)}%` : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
              distanceToPass !== null && distanceToPass < 2 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-muted/30 text-muted-foreground'
            )}>
              <Target className="w-3 h-3" />
              <span>Pass: {distanceToPass !== null ? `${distanceToPass.toFixed(1)}%` : '—'}</span>
            </div>
          </div>
        </div>

        {/* P&L Indicator */}
        <div className={cn(
          'flex items-center justify-center gap-1 py-1.5 rounded-md',
          isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'
        )}>
          {isProfit ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span className={cn(
            'text-sm font-bold',
            isProfit ? 'text-emerald-400' : 'text-red-400'
          )}>
            {isProfit ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
