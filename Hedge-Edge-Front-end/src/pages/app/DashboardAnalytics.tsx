import { useState } from 'react';
import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { Card, CardContent } from '@/components/ui/card';
import { PageBackground } from '@/components/ui/page-background';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Uniform bar color - dark themed with 50% transparency
const BAR_COLOR = 'hsla(120, 70%, 35%, 0.5)'; // Darker green with 50% opacity
const BAR_STROKE = 'hsl(120, 70%, 40%)'; // Darker green for border

const DashboardAnalytics = () => {
  const { accounts, loading } = useTradingAccounts();
  const [performanceTab, setPerformanceTab] = useState('instrument');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Get selected account or all accounts
  const selectedAccount = selectedAccountId === 'all' 
    ? null 
    : accounts.find(a => a.id === selectedAccountId);

  // Calculate stats based on selection
  const relevantAccounts = selectedAccount ? [selectedAccount] : accounts;
  
  const totalPnL = relevantAccounts.reduce((sum, acc) => sum + (Number(acc.pnl) || 0), 0);
  const totalInvestment = relevantAccounts.reduce((sum, acc) => sum + (Number(acc.account_size) || 0), 0);
  const roi = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  // Calculate hedge discrepancy (difference between hedge accounts and prop accounts P&L)
  const propAccounts = accounts.filter(a => a.phase === 'funded' || a.phase === 'evaluation');
  const hedgeAccounts = accounts.filter(a => a.phase === 'live');
  const propPnL = propAccounts.reduce((sum, acc) => sum + (Number(acc.pnl) || 0), 0);
  const hedgePnL = hedgeAccounts.reduce((sum, acc) => sum + (Number(acc.pnl) || 0), 0);
  const hedgeDiscrepancy = propPnL + hedgePnL; // Should be close to 0 if properly hedged

  // Calculate totals for the chart header - funded and evaluation account balances
  const fundedAccounts = accounts.filter(a => a.phase === 'funded');
  const evaluationAccounts = accounts.filter(a => a.phase === 'evaluation');
  const totalFunded = fundedAccounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || Number(acc.account_size) || 0), 0);
  const totalEvaluation = evaluationAccounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || Number(acc.account_size) || 0), 0);

  // Get unique prop firms from connected accounts and aggregate profit by firm
  // Get unique prop firms from connected accounts (excluding hedge accounts) and aggregate balance by firm
  const propFirmData = accounts
    .filter(account => account.phase !== 'live') // Exclude hedge accounts
    .reduce((acc, account) => {
      const firmName = account.prop_firm || 'Unknown';
      if (!acc[firmName]) {
        acc[firmName] = { name: firmName, balance: 0, count: 0 };
      }
      acc[firmName].balance += Number(account.current_balance) || Number(account.account_size) || 0;
      acc[firmName].count += 1;
      return acc;
    }, {} as Record<string, { name: string; balance: number; count: number }>);

  const barChartData = Object.values(propFirmData);

  // Get starting balance for selected account
  const startingBalance = selectedAccount 
    ? Number(selectedAccount.account_size) || 0
    : 0;

  // Calculate current P&L (profit/loss relative to starting balance)
  const currentPnL = selectedAccount 
    ? (Number(selectedAccount.current_balance) || Number(selectedAccount.account_size) || 0) - startingBalance
    : 0;
  
  // Generate chart data for selected account (single account view) - using P&L
  const areaChartData = selectedAccount 
    ? [{ trades: 0, pnl: currentPnL, name: selectedAccount.account_name }]
    : [{ trades: 0, pnl: 0, name: 'Sample' }];

  // Calculate max trades for X-axis domain
  const maxTrades = Math.max(...areaChartData.map(d => d.trades), 0);

  // Calculate profit target and max loss as P&L values
  const profitTargetPnL = selectedAccount 
    ? ((Number(selectedAccount.profit_target) || 0) / 100 * startingBalance)
    : 0;
  
  const maxLossPnL = selectedAccount 
    ? -((Number(selectedAccount.max_loss) || 0) / 100 * startingBalance)
    : 0;

  const dailyMaxLossPnL = selectedAccount 
    ? -((Number(selectedAccount.max_daily_loss) || 0) / 100 * startingBalance)
    : 0;

  // Calculate custom ticks at 50% intervals of profit target/max loss
  const getCustomTicks = () => {
    if (!selectedAccount || profitTargetPnL === 0) return [0];
    
    const tickInterval = profitTargetPnL / 2; // 50% of profit target
    const ticks: number[] = [0]; // Always include $0 line
    
    // Add positive ticks (profit side)
    for (let tick = tickInterval; tick <= profitTargetPnL * 1.1; tick += tickInterval) {
      ticks.push(Math.round(tick));
    }
    
    // Add negative ticks (loss side)
    for (let tick = -tickInterval; tick >= maxLossPnL * 1.1; tick -= tickInterval) {
      ticks.push(Math.round(tick));
    }
    
    return ticks.sort((a, b) => a - b);
  };

  // Calculate Y-axis domain for individual account
  const getIndividualAccountYDomain = () => {
    if (!selectedAccount) return ['auto', 'auto'];
    
    const allValues = [currentPnL, 0, profitTargetPnL, maxLossPnL, dailyMaxLossPnL];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    
    // Add padding (10% on each side)
    const range = maxValue - minValue;
    const padding = Math.max(range * 0.15, 500);
    
    return [Math.floor(minValue - padding), Math.ceil(maxValue + padding)];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatYAxis = (value: number) => {
    return formatCurrency(value);
  };

  // Custom dot component for the area chart
  const CustomDot = (props: { cx?: number; cy?: number }) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        fill="url(#dotGradient)"
        fillOpacity={0.8}
      />
    );
  };

  return (
    <PageBackground>
      <div className="p-6 pt-16 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Tracking your overall hedging performance</p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* Daily P/L */}
          <div className="flex-1 flex flex-col justify-between p-4 rounded-lg bg-card border border-border/50">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily P/L</h3>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-semibold ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(0)}
                  </span>
                  <span className={`text-sm font-medium ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    (+0.00%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Total P/L */}
          <div className="flex-1 flex flex-col justify-between p-4 rounded-lg bg-card border border-border/50">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Total P/L</h3>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-semibold ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(totalPnL)}
                  </span>
                  <span className={`text-sm font-medium ${roi >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ROI */}
          <div className="flex-1 flex flex-col justify-between p-4 rounded-lg bg-card border border-border/50">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">ROI</h3>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-semibold ${roi >= 0 ? 'text-primary' : 'text-destructive'}`}>{roi.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hedge Discrepancy */}
          <div className="flex-1 flex flex-col justify-between p-4 rounded-lg bg-card border border-border/50">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Hedge Discrepancy</h3>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-semibold ${Math.abs(hedgeDiscrepancy) < 100 ? 'text-primary' : 'text-secondary'}`}>{formatCurrency(hedgeDiscrepancy)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hedge Win/Loss & Prop Win/Loss */}
          <div className="flex-1 flex flex-col justify-center items-center p-4 rounded-lg bg-card border border-border/50">
            <div className="text-center">
              {/* Hedge Win/Loss */}
              <div className="mb-3">
                <span className="text-sm text-muted-foreground">Hedge Win/Loss</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-sm text-primary">0.00%</span>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm text-destructive">0.00%</span>
                </div>
              </div>
              
              {/* Prop Win/Loss */}
              <div>
                <span className="text-sm text-muted-foreground">Prop Win/Loss</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-sm text-primary">0.00%</span>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm text-destructive">0.00%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart and Performance Grid */}
        <div className="grid grid-cols-7 gap-4">
          {/* Main Chart - 5 columns */}
          <div className="col-span-7 lg:col-span-5">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-[530px]">
              <CardContent className="px-6 py-8 h-full flex flex-col">
                {/* Chart Header with Account Selector */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-16">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Total Funded</h3>
                      <span className="text-2xl font-semibold text-foreground">{formatCurrency(totalFunded)}</span>
                    </div>
                    <Separator orientation="vertical" className="h-12" />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Total Evaluation</h3>
                      <span className="text-2xl font-semibold text-foreground">{formatCurrency(totalEvaluation)}</span>
                    </div>
                  </div>
                  
                  {/* Account Selector Dropdown */}
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="w-[200px] bg-card border-border/50">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts
                        .filter((account) => account.phase !== 'live')
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="mb-4" />

                {/* Chart */}
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {selectedAccountId === 'all' ? (
                      // Bar chart for all accounts - grouped by prop firm
                      <BarChart 
                        data={barChartData.length > 0 ? barChartData : [{ name: 'No accounts', balance: 0, count: 0 }]} 
                        margin={{ top: 10, right: 10, bottom: 50, left: 10 }}
                      >
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(120, 70%, 35%)" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="hsl(120, 70%, 35%)" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          strokeDasharray="5 5" 
                          stroke="hsl(var(--border))" 
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis 
                          dataKey="name" 
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval={0}
                        />
                        <YAxis 
                          tickFormatter={formatYAxis}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          width={80}
                          label={{ 
                            value: 'Balance', 
                            angle: -90, 
                            position: 'insideLeft',
                            offset: 0,
                            fill: 'hsl(var(--muted-foreground))',
                            fontSize: 12,
                            style: { textAnchor: 'middle' }
                          }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                                  <p className="text-foreground text-sm font-medium">{data.name}</p>
                                  <p className="text-sm flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BAR_STROKE }}></span>
                                    <span className="text-foreground">
                                      Balance: {formatCurrency(data.balance)}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground text-xs mt-1">
                                    {data.count} account{data.count !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="balance" 
                          radius={[4, 4, 0, 0]} 
                          fill="url(#barGradient)" 
                          stroke={BAR_STROKE} 
                          strokeWidth={1} 
                        />
                      </BarChart>
                    ) : (
                      // Area chart for individual account
                      <AreaChart 
                        data={areaChartData} 
                        margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
                      >
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="dotGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          strokeDasharray="5 5" 
                          stroke="hsl(var(--border))" 
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis 
                          dataKey="trades" 
                          type="number"
                          domain={maxTrades === 0 ? [-0.5, 0.5] : [0, maxTrades]}
                          allowDecimals={false}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={{ stroke: 'hsl(var(--border))' }}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          ticks={maxTrades === 0 ? [0] : undefined}
                          label={{ 
                            value: 'Number of Trades', 
                            position: 'bottom', 
                            offset: 15,
                            fill: 'hsl(var(--muted-foreground))',
                            fontSize: 12
                          }}
                        />
                        <YAxis 
                          dataKey="pnl" 
                          type="number"
                          domain={getIndividualAccountYDomain()}
                          ticks={getCustomTicks()}
                          tickFormatter={formatYAxis}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          width={80}
                          label={{ 
                            value: 'P&L', 
                            angle: -90, 
                            position: 'insideLeft',
                            offset: 0,
                            fill: 'hsl(var(--muted-foreground))',
                            fontSize: 12,
                            style: { textAnchor: 'middle' }
                          }}
                        />
                        {/* Profit Target Reference Line */}
                        {profitTargetPnL > 0 && (
                          <ReferenceLine 
                            y={profitTargetPnL} 
                            stroke="#22c55e" 
                            strokeDasharray="4 4" 
                            strokeWidth={1.5}
                            label={{ 
                              value: `Target: ${formatCurrency(profitTargetPnL)}`, 
                              position: 'insideTopLeft',
                              fill: '#22c55e',
                              fontSize: 11,
                              fontWeight: 500
                            }}
                          />
                        )}
                        {/* Daily Max Loss Reference Line */}
                        {dailyMaxLossPnL < 0 && (
                          <ReferenceLine 
                            y={dailyMaxLossPnL} 
                            stroke="#eab308" 
                            strokeDasharray="4 4" 
                            strokeWidth={1.5}
                            label={{ 
                              value: `Daily Limit: ${formatCurrency(dailyMaxLossPnL)}`, 
                              position: 'insideBottomLeft',
                              fill: '#eab308',
                              fontSize: 11,
                              fontWeight: 500
                            }}
                          />
                        )}
                        {/* Max Loss Reference Line */}
                        {maxLossPnL < 0 && (
                          <ReferenceLine 
                            y={maxLossPnL} 
                            stroke="#ef4444" 
                            strokeDasharray="4 4" 
                            strokeWidth={1.5}
                            label={{ 
                              value: `Max Loss: ${formatCurrency(maxLossPnL)}`, 
                              position: 'insideBottomLeft',
                              fill: '#ef4444',
                              fontSize: 11,
                              fontWeight: 500
                            }}
                          />
                        )}
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--border))' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                                  <p className="text-foreground text-sm">Number of trades: {data.trades}</p>
                                  <p className={`text-sm flex items-center gap-2 ${data.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                    <span className={`w-2 h-2 rounded-full ${data.pnl >= 0 ? 'bg-primary' : 'bg-destructive'}`}></span>
                                    P&L: {formatCurrency(data.pnl)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone"
                          dataKey="pnl" 
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#areaGradient)"
                          fillOpacity={0.6}
                          dot={<CustomDot />}
                          activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--primary))' }}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Panel - 2 columns */}
          <div className="col-span-7 lg:col-span-2">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-[530px]">
              <CardContent className="p-4 h-full">
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-foreground">Performance</h3>
                  <Tabs value={performanceTab} onValueChange={setPerformanceTab} className="mt-2">
                    <TabsList className="bg-muted/50 text-xs rounded-md w-full">
                      <TabsTrigger value="instrument" className="flex-1 text-xs">By Instrument</TabsTrigger>
                      <TabsTrigger value="weekday" className="flex-1 text-xs">By Weekday</TabsTrigger>
                      <TabsTrigger value="average" className="flex-1 text-xs">Avg Win/Loss</TabsTrigger>
                    </TabsList>

                    <TabsContent value="instrument" className="mt-4">
                      <div className="flex items-center justify-center h-60">
                        <div className="text-center text-muted-foreground">
                          <p className="text-sm">No instrument data yet</p>
                          <p className="text-xs mt-1">Add trades to see performance by instrument</p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="weekday" className="mt-4">
                      <div className="flex items-center justify-center h-60">
                        <div className="text-center text-muted-foreground">
                          <p className="text-sm">No weekday data yet</p>
                          <p className="text-xs mt-1">Add trades to see performance by weekday</p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="average" className="mt-4">
                      <div className="flex items-center justify-center h-60">
                        <div className="text-center text-muted-foreground">
                          <p className="text-sm">No win/loss data yet</p>
                          <p className="text-xs mt-1">Add trades to see average win/loss</p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageBackground>
  );
};

export default DashboardAnalytics;
