import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageBackground } from '@/components/ui/page-background';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { CopierGroupCard } from '@/components/dashboard/CopierGroupCard';
import { CreateCopierGroupModal } from '@/components/dashboard/CreateCopierGroupModal';
import { ConfigureCopierGroupModal } from '@/components/dashboard/ConfigureCopierGroupModal';
import { useCopierGroupsContext } from '@/contexts/CopierGroupsContext';
import type { CopierGroup } from '@/types/copier';
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
  Search,
  Activity,
  Power,
  Users,
} from 'lucide-react';

// ─── Features & Setup Steps for Empty State ─────────────────────────────────

const features = [
  {
    icon: Zap,
    title: 'Ultra-Low Latency',
    description: 'Trades copied in under 50ms via local IPC connection',
  },
  {
    icon: Shield,
    title: 'Account Protection',
    description: 'Set min/max thresholds to auto-close positions and stop copying',
  },
  {
    icon: ArrowRightLeft,
    title: 'Reverse Copying',
    description: 'Copy trades in reverse for hedging strategies across accounts',
  },
  {
    icon: Settings,
    title: 'Symbol Mapping',
    description: 'Map symbols between different brokers with suffix and alias support',
  },
];

const setupSteps = [
  {
    step: 1,
    title: 'Create a Copier Group',
    description: 'Give it a name and select a leader (master) account',
    icon: Plus,
  },
  {
    step: 2,
    title: 'Add Follower Accounts',
    description: 'Choose one or more accounts to receive copied trades',
    icon: Users,
  },
  {
    step: 3,
    title: 'Configure Risk Settings',
    description: 'Set volume sizing, lot multipliers, and SL/TP rules',
    icon: Shield,
  },
  {
    step: 4,
    title: 'Enable & Monitor',
    description: 'Activate the group and track performance in real-time',
    icon: Activity,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

const TradeCopier = () => {
  const {
    groups,
    summary,
    accounts,
    accountsLoading: loading,
    toggleGroup,
    toggleFollower,
    toggleGlobal,
    deleteGroup,
    addGroup,
    updateGroup,
  } = useCopierGroupsContext();

  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [configureGroup, setConfigureGroup] = useState<CopierGroup | null>(null);

  // ── Handlers (delegate to shared context) ──────────────────────

  const handleToggleGroup = (groupId: string) => toggleGroup(groupId);

  const handleToggleFollower = (groupId: string, followerId: string) => toggleFollower(groupId, followerId);

  const handleDeleteGroup = (groupId: string) => deleteGroup(groupId);

  const handleGroupCreated = (group: CopierGroup) => addGroup(group);

  const handleConfigureSave = (updated: CopierGroup) => updateGroup(updated);

  const handleToggleGlobal = (enabled: boolean) => {
    setGlobalEnabled(enabled);
    toggleGlobal(enabled);
  };

  // ── Filtered groups ────────────────────────────────────────────

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      g =>
        g.name.toLowerCase().includes(q) ||
        g.leaderAccountName.toLowerCase().includes(q) ||
        g.followers.some(f => f.accountName.toLowerCase().includes(q)),
    );
  }, [groups, searchQuery]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <PageBackground>
      <div className="p-6 pt-16 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Trade Copier
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </h1>
            <p className="text-muted-foreground">
              Copy trades from leader accounts to followers automatically
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in-up">
          {/* Left: search + global toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search groups..."
                className="pl-9"
              />
            </div>
            {groups.length > 0 && (
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Power className={`h-4 w-4 ${globalEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <Switch
                          checked={globalEnabled}
                          onCheckedChange={handleToggleGlobal}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{globalEnabled ? 'All copying active' : 'All copying paused'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
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
            <Button onClick={() => setCreateOpen(true)} disabled={accounts.length < 2}>
              <Plus className="mr-2 h-4 w-4" />
              New Copier Group
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {groups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            <TooltipProvider>
              <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Groups</CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <Copy className="h-4 w-4 text-primary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Leader-to-follower copy groups running</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{summary.activeGroups}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.totalGroups} total · {summary.activeFollowers} active follower{summary.activeFollowers !== 1 ? 's' : ''}
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
                      <p>Total trades copied today across all groups</p>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Copier P&L</CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <TrendingUp className={`h-4 w-4 ${summary.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Combined profit/loss from all copied trades</p>
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {summary.totalProfit >= 0 ? '+' : ''}${Math.abs(summary.totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
              </Card>
            </TooltipProvider>
          </div>
        )}

        {/* Copier Group Cards */}
        {filteredGroups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Copier Groups</h2>
              <Badge variant="outline" className="text-xs">{filteredGroups.length}</Badge>
            </div>
            <div className="space-y-3">
              {filteredGroups.map(group => (
                <CopierGroupCard
                  key={group.id}
                  group={group}
                  onToggleGroup={handleToggleGroup}
                  onToggleFollower={handleToggleFollower}
                  onEdit={(groupId) => {
                    const g = groups.find(gr => gr.id === groupId);
                    if (g) setConfigureGroup(g);
                  }}
                  onDelete={handleDeleteGroup}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty search result */}
        {groups.length > 0 && filteredGroups.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No groups match "{searchQuery}"</p>
          </div>
        )}

        {/* Empty State */}
        {groups.length === 0 && !loading && (
          <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 overflow-hidden">
            <CardHeader className="border-b border-border/30">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Get Started with Trade Copying
              </CardTitle>
              <CardDescription>
                Follow these steps to set up your first copier group
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
                {accounts.length < 2 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    You need at least 2 accounts to create a copier group
                  </div>
                ) : (
                  <Button size="lg" className="group" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Copier Group
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Modal */}
        <CreateCopierGroupModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          accounts={accounts}
          onCreated={handleGroupCreated}
        />

        {/* Configure Modal */}
        <ConfigureCopierGroupModal
          open={configureGroup !== null}
          onOpenChange={(open) => { if (!open) setConfigureGroup(null); }}
          group={configureGroup}
          onSave={handleConfigureSave}
        />
      </div>
    </PageBackground>
  );
};

export default TradeCopier;
