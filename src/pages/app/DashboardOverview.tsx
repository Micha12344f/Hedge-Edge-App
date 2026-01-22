import { useState } from 'react';
import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { AddAccountModal } from '@/components/dashboard/AddAccountModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Target, 
  BarChart3,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';

const DashboardOverview = () => {
  const { accounts, loading, createAccount, deleteAccount } = useTradingAccounts();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const filteredAccounts = accounts.filter((account) => {
    if (activeTab === 'all') return true;
    return account.phase === activeTab;
  });

  // Calculate stats
  const totalBalance = accounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || Number(acc.account_size) || 0), 0);
  const totalPnL = accounts.reduce((sum, acc) => sum + (Number(acc.pnl) || 0), 0);
  const totalAccountValue = accounts.reduce((sum, acc) => sum + (Number(acc.account_size) || 0), 0);
  const avgPnLPercent = accounts.length > 0 
    ? accounts.reduce((sum, acc) => sum + (Number(acc.pnl_percent) || 0), 0) / accounts.length 
    : 0;

  const evaluationCount = accounts.filter(a => a.phase === 'evaluation').length;
  const fundedCount = accounts.filter(a => a.phase === 'funded').length;
  const hedgeCount = accounts.filter(a => a.phase === 'live').length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground">Manage all your trading accounts in one place</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <PlayCircle className="mr-2 h-4 w-4" />
            Tutorials
          </Button>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
            {totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-primary" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(totalPnL)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Return</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={`text-2xl font-bold ${avgPnLPercent >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {avgPnLPercent.toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-foreground">{accounts.length}</p>
                <p className="text-sm text-muted-foreground">
                  ({evaluationCount} eval, {fundedCount} funded, {hedgeCount} hedge)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Accounts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All Accounts</TabsTrigger>
                <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                <TabsTrigger value="funded">Funded</TabsTrigger>
                <TabsTrigger value="live">Hedge</TabsTrigger>
              </TabsList>
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All
              </Button>
            </div>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-border/50 bg-card/50">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-2 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredAccounts.length === 0 ? (
                <Card className="border-border/50 bg-card/50 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Plus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No accounts yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Add your first trading account to start tracking your performance
                    </p>
                    <Button onClick={() => setAddModalOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Account
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onDelete={deleteAccount}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AddAccountModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSubmit={createAccount}
      />
    </div>
  );
};

export default DashboardOverview;
