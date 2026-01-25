import { useState } from 'react';
import { useTradingAccounts, TradingAccount } from '@/hooks/useTradingAccounts';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { AddAccountModal } from '@/components/dashboard/AddAccountModal';
import { AccountDetailsModal } from '@/components/dashboard/AccountDetailsModal';
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
  Sparkles,
} from 'lucide-react';

const DashboardOverview = () => {
  const { accounts, loading, createAccount, deleteAccount, syncAccountFromMT5 } = useTradingAccounts();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const handleAccountClick = (account: TradingAccount) => {
    setSelectedAccount(account);
    setDetailsModalOpen(true);
  };

  const filteredAccounts = accounts.filter((account) => {
    if (activeTab === 'all') return true;
    return account.phase === activeTab;
  });

  // Calculate stats
  const propAccounts = accounts.filter(a => a.phase === 'funded' || a.phase === 'evaluation');
  const propBalance = propAccounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || Number(acc.account_size) || 0), 0);
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

  const statsCards = [
    {
      title: 'Prop Balance',
      icon: Wallet,
      value: formatCurrency(propBalance),
      className: 'text-foreground',
      iconClassName: 'text-muted-foreground',
    },
    {
      title: 'Total P&L',
      icon: totalPnL >= 0 ? TrendingUp : TrendingDown,
      value: formatCurrency(totalPnL),
      className: totalPnL >= 0 ? 'text-primary' : 'text-destructive',
      iconClassName: totalPnL >= 0 ? 'text-primary' : 'text-destructive',
    },
    {
      title: 'Avg. Return',
      icon: BarChart3,
      value: `${avgPnLPercent.toFixed(2)}%`,
      className: avgPnLPercent >= 0 ? 'text-primary' : 'text-destructive',
      iconClassName: 'text-muted-foreground',
    },
    {
      title: 'Active Accounts',
      icon: Target,
      value: accounts.length.toString(),
      subtitle: `(${evaluationCount} eval, ${fundedCount} funded, ${hedgeCount} hedge)`,
      className: 'text-foreground',
      iconClassName: 'text-muted-foreground',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Overview
            <Sparkles className="w-5 h-5 text-secondary animate-pulse" />
          </h1>
          <p className="text-muted-foreground">Manage all your trading accounts in one place</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="group">
            <PlayCircle className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
            Tutorials
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="group">
            <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {statsCards.map((stat, index) => (
          <Card 
            key={stat.title}
            className="border-border/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-primary/30 group cursor-default"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 transition-all duration-300 group-hover:scale-110 ${stat.iconClassName}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24 animate-shimmer" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-bold transition-colors ${stat.className}`}>{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-sm text-muted-foreground">
                      {stat.subtitle}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs & Accounts */}
      <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList className="bg-muted/50 backdrop-blur-sm">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">
                  All Accounts
                </TabsTrigger>
                <TabsTrigger value="evaluation" className="data-[state=active]:bg-secondary/20 data-[state=active]:text-secondary transition-all">
                  Evaluation
                </TabsTrigger>
                <TabsTrigger value="funded" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">
                  Funded
                </TabsTrigger>
                <TabsTrigger value="live" className="data-[state=active]:bg-accent/40 data-[state=active]:text-foreground transition-all">
                  Hedge
                </TabsTrigger>
              </TabsList>
              <Button variant="outline" size="sm" className="hidden sm:flex group">
                <RefreshCw className="mr-2 h-4 w-4 transition-transform group-hover:rotate-180 duration-500" />
                Sync All
              </Button>
            </div>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-border/30 bg-card/50">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-32 animate-shimmer" />
                        <Skeleton className="h-4 w-24 animate-shimmer" />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Skeleton className="h-12 w-full animate-shimmer" />
                          <Skeleton className="h-12 w-full animate-shimmer" />
                        </div>
                        <Skeleton className="h-2 w-full animate-shimmer" />
                        <Skeleton className="h-2 w-full animate-shimmer" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredAccounts.length === 0 ? (
                <Card className="border-border/30 bg-gradient-to-br from-card/80 to-card/40 border-dashed hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setAddModalOpen(true)}>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-muted flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
                      <Plus className="w-6 h-6 text-primary transition-transform group-hover:rotate-90" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No accounts yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Add your first trading account to start tracking your performance
                    </p>
                    <Button className="group/btn">
                      <Plus className="mr-2 h-4 w-4 transition-transform group-hover/btn:rotate-90" />
                      Add Account
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAccounts.map((account, index) => (
                    <div
                      key={account.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 75}ms` }}
                    >
                      <AccountCard
                        account={account}
                        onDelete={deleteAccount}
                        onClick={handleAccountClick}
                      />
                    </div>
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

      <AccountDetailsModal
        account={selectedAccount}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onSyncAccount={syncAccountFromMT5}
      />
    </div>
  );
};

export default DashboardOverview;