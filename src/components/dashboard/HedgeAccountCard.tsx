import { TradingAccount } from '@/hooks/useTradingAccounts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Zap, 
  AlertTriangle, 
  Clock,
  Server,
  User,
  Settings2,
  RefreshCw
} from 'lucide-react';

interface HedgeAccountCardProps {
  account: TradingAccount;
  linkedCount: number;
  onManageLinks: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

type ConnectionStatus = 'connected' | 'lagging' | 'disconnected';

export const HedgeAccountCard = ({ 
  account, 
  linkedCount, 
  onManageLinks,
  onSelect,
  isSelected 
}: HedgeAccountCardProps) => {
  // Determine connection status
  const getConnectionStatus = (): ConnectionStatus => {
    if (account.last_sync_at) {
      const lastSync = new Date(account.last_sync_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);
      if (diffMinutes > 10) return 'disconnected';
      if (diffMinutes > 5) return 'lagging';
    }
    return 'connected';
  };

  const connectionStatus = getConnectionStatus();

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
    disconnected: {
      badge: 'bg-red-500/20 text-red-400 border-red-500/40',
      icon: AlertTriangle,
      label: 'Disconnected',
      pulse: false,
    },
  };

  const status = statusConfig[connectionStatus];
  const StatusIcon = status.icon;

  const formatLastSync = () => {
    if (!account.last_sync_at) return 'Never';
    const date = new Date(account.last_sync_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-xl border-2 bg-card/80 backdrop-blur-sm transition-all duration-300 cursor-pointer',
        'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.2)]',
        'hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:border-blue-500/60',
        isSelected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background'
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{account.account_name}</h3>
            <p className="text-xs text-muted-foreground">{account.platform || 'MT5'}</p>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            'text-[10px] px-2 py-0.5 flex items-center gap-1',
            status.badge,
            status.pulse && 'animate-pulse'
          )}
        >
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </Badge>
      </div>

      {/* Connection Details */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground">Login</p>
            <p className="text-xs font-medium text-foreground">{account.login || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
          <Server className="w-3.5 h-3.5 text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground">Server</p>
            <p className="text-xs font-medium text-foreground truncate max-w-[80px]">{account.server || '—'}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {formatLastSync()}
          </span>
          <span className="text-blue-400 font-medium">
            {linkedCount} linked
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onManageLinks();
          }}
          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Manage
        </Button>
      </div>
    </div>
  );
};
