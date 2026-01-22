import { TradingAccount } from '@/hooks/useTradingAccounts';
import { cn } from '@/lib/utils';
import { 
  Zap, 
  Target,
  Shield,
  AlertTriangle
} from 'lucide-react';

interface MapNodeProps {
  account: TradingAccount;
  isSelected?: boolean;
  isDragging?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const MapNode = ({ account, isSelected, isDragging, onMouseDown }: MapNodeProps) => {
  const pnl = Number(account.pnl) || 0;
  const isProfit = pnl >= 0;
  const isRisk = (Number(account.max_loss) || 0) > 0 && 
    Math.abs(Number(account.pnl_percent) || 0) > (Number(account.max_loss) || 10) * 0.8;

  const typeConfig = {
    evaluation: {
      gradient: 'from-yellow-500 to-amber-600',
      border: 'border-yellow-500',
      shadow: 'shadow-yellow-500/40',
      glow: '0 0 40px rgba(234, 179, 8, 0.4)',
      icon: Target,
      label: 'PROP',
    },
    funded: {
      gradient: 'from-emerald-500 to-green-600',
      border: 'border-emerald-500',
      shadow: 'shadow-emerald-500/40',
      glow: '0 0 40px rgba(16, 185, 129, 0.4)',
      icon: Shield,
      label: 'FUNDED',
    },
    live: {
      gradient: 'from-blue-500 to-indigo-600',
      border: 'border-blue-500',
      shadow: 'shadow-blue-500/40',
      glow: '0 0 40px rgba(59, 130, 246, 0.4)',
      icon: Zap,
      label: 'HEDGE',
    },
  };

  const config = typeConfig[account.phase];
  const Icon = config.icon;

  // Get initials for broker/firm logo placeholder
  const getInitials = () => {
    const name = account.prop_firm || account.platform || account.account_name;
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'relative cursor-grab active:cursor-grabbing transition-transform duration-150',
        isDragging && 'scale-105 z-50',
        isSelected && 'z-40'
      )}
      style={{
        filter: isDragging ? 'drop-shadow(0 20px 30px rgba(0,0,0,0.3))' : undefined,
      }}
    >
      {/* Main circular node */}
      <div
        className={cn(
          'w-20 h-20 rounded-full relative transition-all duration-300',
          `bg-gradient-to-br ${config.gradient}`,
          isSelected && 'ring-4 ring-white/50 ring-offset-4 ring-offset-background',
        )}
        style={{
          boxShadow: isSelected ? config.glow : `0 8px 32px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Logo placeholder - will be replaced with actual broker logos */}
        <div className="absolute inset-2 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <span className="text-white font-bold text-lg">{getInitials()}</span>
        </div>

        {/* Status indicator */}
        <div className={cn(
          'absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center',
          isRisk ? 'bg-red-500' : isProfit ? 'bg-emerald-500' : 'bg-yellow-500'
        )}>
          {isRisk ? (
            <AlertTriangle className="w-3 h-3 text-white" />
          ) : (
            <Icon className="w-3 h-3 text-white" />
          )}
        </div>

        {/* Connection indicator - shows active state */}
        <div className={cn(
          'absolute -top-1 -right-1 w-4 h-4 rounded-full',
          'bg-emerald-400 animate-pulse'
        )} />
      </div>

      {/* Label below node */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-center whitespace-nowrap">
        <p className="text-xs font-semibold text-foreground truncate max-w-[100px]">
          {account.account_name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {account.prop_firm || account.platform || config.label}
        </p>
      </div>

      {/* Type badge */}
      <div className={cn(
        'absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold',
        'bg-background/90 backdrop-blur-sm border',
        config.border
      )}>
        {config.label}
      </div>
    </div>
  );
};
