import { TradingAccount } from '@/hooks/useTradingAccounts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MoreHorizontal, TrendingUp, TrendingDown, RefreshCw, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AccountCardProps {
  account: TradingAccount;
  onDelete: (id: string) => void;
  onSync?: (id: string) => void;
}

export const AccountCard = ({ account, onDelete, onSync }: AccountCardProps) => {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const phaseColors = {
    evaluation: 'bg-yellow-500/20 text-yellow-500',
    funded: 'bg-primary/20 text-primary',
    live: 'bg-blue-500/20 text-blue-500',
  };

  return (
    <Card className="border-border/50 bg-card/50 hover:border-primary/30 transition-colors">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{account.account_name}</h3>
            <Badge variant="outline" className={cn('text-xs capitalize', phaseColors[account.phase])}>
              {account.phase}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {account.prop_firm || 'Personal'} • {account.platform}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onSync && (
              <DropdownMenuItem onClick={() => onSync(account.id)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Account
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => onDelete(account.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance & P&L */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrency(Number(account.current_balance) || accountSize)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">P&L</p>
            <div className="flex items-center gap-1">
              {isProfit ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={cn('text-lg font-semibold', isProfit ? 'text-primary' : 'text-destructive')}>
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
                  <span className="text-foreground">{pnlPercent.toFixed(1)}% / {profitTarget}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}
            {maxLoss > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Drawdown Remaining</span>
                  <span className="text-foreground">{drawdownRemaining.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={(drawdownRemaining / maxLoss) * 100} 
                  className="h-2 [&>div]:bg-destructive" 
                />
              </div>
            )}
          </div>
        )}

        {/* Trading Days */}
        {account.min_trading_days && account.min_trading_days > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Trading Days</span>
            <span className="text-foreground">
              {account.trading_days_completed || 0} / {account.min_trading_days}
            </span>
          </div>
        )}

        {/* Account Size */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Account Size</span>
            <span className="text-foreground font-medium">{formatCurrency(accountSize)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
