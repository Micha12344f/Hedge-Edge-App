import { TradingAccount } from '@/hooks/useTradingAccounts';
import { cn } from '@/lib/utils';
import { PROP_FIRMS } from './AddAccountModal';
import { 
  Zap, 
  Target,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface MapNodeProps {
  account: TradingAccount;
  isSelected?: boolean;
  isDragging?: boolean;
  isLinkSource?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onDetailsClick?: () => void;
}

export const MapNode = ({ account, isSelected, isDragging, isLinkSource, onMouseDown, onClick, onDetailsClick }: MapNodeProps) => {
  const pnl = Number(account.pnl) || 0;
  const pnlPercent = Number(account.pnl_percent) || 0;
  const isProfit = pnl >= 0;
  const isRisk = (Number(account.max_loss) || 0) > 0 && 
    Math.abs(Number(account.pnl_percent) || 0) > (Number(account.max_loss) || 10) * 0.8;

  const typeConfig = {
    evaluation: {
      gradient: 'from-yellow-500 to-amber-600',
      border: 'border-yellow-500/60',
      shadow: 'shadow-yellow-500/40',
      glow: '0 0 30px rgba(234, 179, 8, 0.5)',
      glowSelected: '0 0 40px rgba(234, 179, 8, 0.7), 0 0 60px rgba(234, 179, 8, 0.4)',
      ringColor: 'ring-yellow-500/50',
      icon: Target,
      label: 'EVAL',
      bgColor: 'bg-yellow-500/10',
    },
    funded: {
      gradient: 'from-emerald-500 to-green-600',
      border: 'border-emerald-500/60',
      shadow: 'shadow-emerald-500/40',
      glow: '0 0 30px rgba(16, 185, 129, 0.5)',
      glowSelected: '0 0 40px rgba(16, 185, 129, 0.7), 0 0 60px rgba(16, 185, 129, 0.4)',
      ringColor: 'ring-emerald-500/50',
      icon: Shield,
      label: 'FUNDED',
      bgColor: 'bg-emerald-500/10',
    },
    live: {
      gradient: 'from-blue-500 to-indigo-600',
      border: 'border-blue-500/60',
      shadow: 'shadow-blue-500/40',
      glow: '0 0 30px rgba(59, 130, 246, 0.5)',
      glowSelected: '0 0 40px rgba(59, 130, 246, 0.7), 0 0 60px rgba(59, 130, 246, 0.4)',
      ringColor: 'ring-blue-500/50',
      icon: Zap,
      label: 'HEDGE',
      bgColor: 'bg-blue-500/10',
    },
  };

  const config = typeConfig[account.phase];
  const Icon = config.icon;

  // Get prop firm logo from PROP_FIRMS array
  const getPropFirmLogo = () => {
    if (account.prop_firm) {
      const firm = PROP_FIRMS.find(f => f.name === account.prop_firm);
      return firm?.logo || null;
    }
    return null;
  };

  // Get initials for broker/firm logo placeholder
  const getInitials = () => {
    const name = account.prop_firm || account.platform || account.account_name;
    return name?.substring(0, 2).toUpperCase() || 'AC';
  };

  const propFirmLogo = getPropFirmLogo();

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={cn(
        'relative cursor-grab active:cursor-grabbing transition-all duration-200 group',
        isDragging && 'scale-110 z-50',
        isSelected && 'z-40',
        isLinkSource && 'z-45'
      )}
      style={{
        filter: isDragging ? 'drop-shadow(0 25px 40px rgba(0,0,0,0.4))' : undefined,
      }}
    >
      {/* Outer glow ring for selected/link source state */}
      <div
        className={cn(
          'absolute inset-0 rounded-full transition-all duration-300 -z-10',
          (isSelected || isLinkSource) && 'scale-125 opacity-100',
          !isSelected && !isLinkSource && 'scale-100 opacity-0'
        )}
        style={{
          background: isLinkSource 
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)'
            : account.phase === 'evaluation'
              ? 'radial-gradient(circle, rgba(234, 179, 8, 0.3) 0%, transparent 70%)'
              : account.phase === 'funded'
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
        }}
      />

      {/* Main circular node */}
      <div
        className={cn(
          'w-24 h-24 rounded-full relative transition-all duration-300 border-2',
          config.border,
          isSelected && `ring-4 ${config.ringColor} ring-offset-2 ring-offset-background`,
          isLinkSource && 'ring-4 ring-purple-500/60 ring-offset-2 ring-offset-background animate-pulse',
          'group-hover:scale-105'
        )}
        style={{
          boxShadow: isSelected || isLinkSource ? config.glowSelected : config.glow,
          background: `linear-gradient(135deg, ${account.phase === 'evaluation' ? 'rgba(234, 179, 8, 0.15)' : account.phase === 'funded' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'} 0%, rgba(0,0,0,0.4) 100%)`,
        }}
      >
        {/* Prop firm logo or initials */}
        <div className="absolute inset-1.5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center overflow-hidden">
          {propFirmLogo ? (
            <img
              src={propFirmLogo}
              alt={account.prop_firm || ''}
              className="w-12 h-12 object-contain rounded-full"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span className={cn(
            'text-lg font-bold',
            account.phase === 'evaluation' ? 'text-yellow-500' : account.phase === 'funded' ? 'text-emerald-500' : 'text-blue-500',
            propFirmLogo && 'hidden'
          )}>
            {getInitials()}
          </span>
        </div>

        {/* P&L indicator badge */}
        <div className={cn(
          'absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-background flex items-center justify-center transition-colors',
          isRisk ? 'bg-red-500' : isProfit ? 'bg-emerald-500' : 'bg-red-500'
        )}>
          {isRisk ? (
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
          ) : isProfit ? (
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-white" />
          )}
        </div>

        {/* Connection indicator - shows active state */}
        <div className={cn(
          'absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background',
          'bg-emerald-400 animate-pulse'
        )} />
      </div>

      {/* Info card below node */}
      <div 
        className={cn(
          'absolute top-full left-1/2 -translate-x-1/2 mt-3 text-center transition-all duration-200',
          'px-3 py-2 rounded-lg backdrop-blur-md border',
          config.bgColor,
          config.border,
          'min-w-[140px] max-w-[160px]'
        )}
        style={{
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        <p className="text-xs font-semibold text-foreground truncate">
          {account.account_name}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {account.prop_firm || account.platform || config.label}
        </p>
        {/* P&L Display */}
        <div className={cn(
          'mt-1.5 pt-1.5 border-t border-border/30 flex items-center justify-center gap-1',
          isProfit ? 'text-emerald-400' : 'text-red-400'
        )}>
          {isProfit ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span className="text-xs font-bold">
            {isProfit ? '+' : ''}{formatCurrency(pnl)}
          </span>
          <span className="text-[10px] opacity-70">
            ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Type badge */}
      <div className={cn(
        'absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider',
        'border shadow-sm',
        account.phase === 'evaluation' && 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
        account.phase === 'funded' && 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
        account.phase === 'live' && 'bg-blue-500/20 border-blue-500/50 text-blue-400'
      )}>
        {config.label}
      </div>
    </div>
  );
};
