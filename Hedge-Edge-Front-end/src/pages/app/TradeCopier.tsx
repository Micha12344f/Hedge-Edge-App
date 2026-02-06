import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageBackground } from '@/components/ui/page-background';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { HedgeRelationship } from '@/components/dashboard/DraggableHedgeMap';
import { 
  TradeCopierConfig, 
  syncCopiersWithRelationships, 
  getCopiersSummary,
  populateMockCopierStats,
  getStoredCopiers,
} from '@/mocks/trade-copier';
import { 
  Copy, 
  Zap, 
  Shield, 
  ArrowRightLeft, 
  Plus, 
  Settings, 
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Pause,
  Play,
  MoreVertical,
  RefreshCw,
  Activity,
  CircleDot,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const features = [
  {
    icon: Zap,
    title: 'Ultra-Low Latency',
    description: 'Trades copied in under 50ms via local IPC connection',
  },
  {
    icon: Shield,
    title: 'Risk Management',
    description: 'Set custom lot multipliers and max position limits per follower',
  },
  {
    icon: ArrowRightLeft,
    title: 'Inverse Copying',
    description: 'Copy trades in reverse for hedging strategies across accounts',
  },
  {
    icon: Settings,
    title: 'Symbol Mapping',
    description: 'Map symbols between different brokers automatically',
  },
];

const setupSteps = [
  {
    step: 1,
    title: 'Install EA/cBot',
    description: 'Install the Hedge Edge component on your trading terminals',
    icon: Copy,
  },
  {
    step: 2,
    title: 'Select Master Account',
    description: 'Choose which account will be the source of trades',
    icon: TrendingUp,
  },
  {
    step: 3,
    title: 'Add Follower Accounts',
    description: 'Select accounts to receive copied trades',
    icon: Plus,
  },
  {
    step: 4,
    title: 'Configure Risk Settings',
    description: 'Set lot multipliers and risk limits for each follower',
    icon: Shield,
  },
];

// Local storage key for relationships (same as Accounts.tsx)
const RELATIONSHIPS_KEY = 'hedge_edge_relationships';

const getStoredRelationships = (): HedgeRelationship[] => {
  try {
    const stored = localStorage.getItem(RELATIONSHIPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const getLogicLabel = (logic: string) => {
  switch (logic) {
    case 'inverse': return 'Reverse Copy';
    case 'mirror': return 'Mirror Copy';
    case 'partial': return 'Partial Copy';
    default: return logic;
  }
};

const getLogicBadgeVariant = (logic: string) => {
  switch (logic) {
    case 'inverse': return 'default';
    case 'mirror': return 'secondary';
    case 'partial': return 'outline';
    default: return 'secondary';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'text-green-500';
    case 'paused': return 'text-yellow-500';
    case 'error': return 'text-red-500';
    case 'pending': return 'text-blue-500';
    default: return 'text-muted-foreground';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return CircleDot;
    case 'paused': return Pause;
    case 'error': return AlertTriangle;
    case 'pending': return RefreshCw;
    default: return CircleDot;
  }
};

const TradeCopier = () => {
  const { accounts, loading } = useTradingAccounts();
  const [copiers, setCopiers] = useState<TradeCopierConfig[]>([]);
  const [relationships, setRelationships] = useState<HedgeRelationship[]>([]);

  // Load relationships and sync copiers on mount
  useEffect(() => {
    const storedRelationships = getStoredRelationships();
    setRelationships(storedRelationships);
  }, []);

  // Sync copiers when accounts or relationships change
  useEffect(() => {
    if (!loading && accounts.length > 0 && relationships.length > 0) {
      // Sync copiers with current relationships
      const syncedCopiers = syncCopiersWithRelationships(relationships, accounts);
      // Add mock stats for demo
      const copiersWithStats = populateMockCopierStats(syncedCopiers);
      setCopiers(copiersWithStats);
    } else if (!loading && relationships.length === 0) {
      // Load any existing copiers from storage
      const storedCopiers = getStoredCopiers();
      if (storedCopiers.length > 0) {
        setCopiers(populateMockCopierStats(storedCopiers));
      }
    }
  }, [accounts, relationships, loading]);

  // Calculate summary stats
  const summary = useMemo(() => getCopiersSummary(copiers), [copiers]);

  const handleToggleCopier = (copierId: string) => {
    setCopiers(prev => prev.map(c => {
      if (c.id === copierId) {
        return { ...c, status: c.status === 'active' ? 'paused' : 'active' };
      }
      return c;
    }));
  };

  const handleDeleteCopier = (copierId: string) => {
    setCopiers(prev => prev.filter(c => c.id !== copierId));
  };

  const activeCopierCount = copiers.filter(c => c.status === 'active').length;

  return (
    <PageBackground>
      <div className="p-6 pt-16 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Trade Copier
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </h1>
            <p className="text-muted-foreground">Copy trades across multiple accounts automatically</p>
          </div>
        </div>

        {/* Action buttons row - below header to avoid logo overlap */}
        <div className="flex justify-end gap-2 animate-fade-in-up">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Learn how trade copying works</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New Copier
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <TooltipProvider>
            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Copiers</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Copy className="h-4 w-4 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of active copy relationships</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{summary.activeCopiers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.totalCopiers > 0 ? `${summary.totalCopiers} total configured` : 'No copiers configured'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Trades Copied</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total trades copied today</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{summary.tradesToday}</p>
                <p className="text-xs text-muted-foreground mt-1">Today</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Latency</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Zap className={`h-4 w-4 ${summary.avgLatency > 0 && summary.avgLatency < 50 ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average time to copy a trade</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {summary.avgLatency > 0 ? `${summary.avgLatency}ms` : '-'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avgLatency > 0 && summary.avgLatency < 50 ? 'Ultra-fast' : 'No data yet'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Risk Protection</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Shield className="h-4 w-4 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Risk management status</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">Active</p>
                <p className="text-xs text-muted-foreground mt-1">All limits enforced</p>
              </CardContent>
            </Card>
          </TooltipProvider>
        </div>

        {/* Active Copiers List - shown when there are copiers */}
        {copiers.length > 0 && (
          <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 overflow-hidden">
            <CardHeader className="border-b border-border/30">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Active Trade Copiers
              </CardTitle>
              <CardDescription>
                Reverse trade copying from prop accounts to hedge accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {copiers.map((copier) => {
                  const StatusIcon = getStatusIcon(copier.status);
                  return (
                    <div 
                      key={copier.id}
                      className="p-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Source & Target Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {/* Source Account */}
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${copier.sourcePhase === 'funded' ? 'bg-green-500' : copier.sourcePhase === 'evaluation' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                              <span className="font-medium text-foreground truncate max-w-[150px]" title={copier.sourceAccountName}>
                                {copier.sourceAccountName}
                              </span>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {copier.sourcePhase === 'evaluation' ? 'EVAL' : copier.sourcePhase === 'funded' ? 'FUNDED' : 'LIVE'}
                              </Badge>
                            </div>
                            
                            {/* Arrow with Logic Badge */}
                            <div className="flex items-center gap-1 shrink-0">
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Badge variant={getLogicBadgeVariant(copier.logic)} className="text-[10px]">
                                {getLogicLabel(copier.logic)}
                              </Badge>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            
                            {/* Target Account */}
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="font-medium text-foreground truncate max-w-[150px]" title={copier.targetAccountName}>
                                {copier.targetAccountName}
                              </span>
                              <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-500/10 text-blue-500 border-blue-500/30">
                                HEDGE
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Stats Row */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <StatusIcon className={`h-3 w-3 ${getStatusColor(copier.status)}`} />
                              <span className={getStatusColor(copier.status)}>
                                {copier.status.charAt(0).toUpperCase() + copier.status.slice(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Copy className="h-3 w-3" />
                              <span>{copier.stats.tradesToday} trades today</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              <span>{copier.stats.avgLatency}ms avg</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              <span className={copier.stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {copier.stats.totalProfit >= 0 ? '+' : ''}{copier.stats.totalProfit.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span>{copier.lotMultiplier}% lot size</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleToggleCopier(copier.id)}
                                >
                                  {copier.status === 'active' ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{copier.status === 'active' ? 'Pause copier' : 'Resume copier'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Configure
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Activity className="mr-2 h-4 w-4" />
                                View Activity
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDeleteCopier(copier.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State with Setup Guide - shown when no copiers */}
        {copiers.length === 0 && (
          <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 overflow-hidden">
            <CardHeader className="border-b border-border/30">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Get Started with Trade Copying
              </CardTitle>
              <CardDescription>
                {relationships.length > 0 
                  ? 'You have hedge relationships configured. Add accounts to the hedge map to enable trade copying.'
                  : 'Follow these steps to set up your first trade copier'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Setup Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {setupSteps.map((step, index) => (
                  <div 
                    key={step.step}
                    className="relative flex flex-col items-center text-center p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all group"
                  >
                    {index < setupSteps.length - 1 && (
                      <ArrowRight className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    )}
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                      <step.icon className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[10px] mb-2">Step {step.step}</Badge>
                    <h4 className="font-medium text-foreground text-sm">{step.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div className="border-t border-border/30 pt-6">
                <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  What you'll get
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {features.map((feature) => (
                    <div 
                      key={feature.title}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:border-primary/30 transition-colors"
                    >
                      <feature.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-foreground text-sm">{feature.title}</h5>
                        <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pt-6 border-t border-border/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Requires EA/cBot installation on trading terminals
                </div>
                <Button size="lg" className="group">
                  <Settings className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform" />
                  Open Installation Manager
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageBackground>
  );
};

export default TradeCopier;
