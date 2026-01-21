import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';

const DashboardAnalytics = () => {
  const { accounts, loading } = useTradingAccounts();

  const totalPnL = accounts.reduce((sum, acc) => sum + (Number(acc.pnl) || 0), 0);
  const avgReturn = accounts.length > 0 
    ? accounts.reduce((sum, acc) => sum + (Number(acc.pnl_percent) || 0), 0) / accounts.length 
    : 0;
  
  const winningAccounts = accounts.filter(a => Number(a.pnl) > 0).length;
  const winRate = accounts.length > 0 ? (winningAccounts / accounts.length) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Track your overall trading performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(totalPnL)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Return</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${avgReturn >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {avgReturn.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{winRate.toFixed(0)}%</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{accounts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Performance Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : accounts.length === 0 ? 'Add accounts to see performance data' : 'Performance visualization coming soon'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardAnalytics;
