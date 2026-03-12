import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageBackground } from '@/components/ui/page-background';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { CopierGroupCard } from '@/components/dashboard/CopierGroupCard';
import { CreateCopierGroupModal } from '@/components/dashboard/CreateCopierGroupModal';
import { ConfigureCopierGroupModal } from '@/components/dashboard/ConfigureCopierGroupModal';
import { NotificationPreferencesPanel } from '@/components/dashboard/NotificationPreferencesPanel';
import { PROP_FIRMS } from '@/components/dashboard/AddAccountModal';
import { useCopierGroupsContext } from '@/contexts/CopierGroupsContext';
import type { CopierGroup } from '@/types/copier';
import {
  Route,
  PlusCircle,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Activity,
  UsersRound,
} from 'lucide-react';

// ─── Setup Steps for Empty State ─────────────────────────────────

const setupSteps = [
  {
    step: 1,
    title: 'Create a Copier Group',
    description: 'Give it a name and select a leader (master) account',
    icon: PlusCircle,
  },
  {
    step: 2,
    title: 'Add Follower Accounts',
    description: 'Choose one or more accounts to receive copied trades',
    icon: UsersRound,
  },
  {
    step: 3,
    title: 'Configure Risk Settings',
    description: 'Set volume sizing and lot multipliers for each follower',
    icon: Route,
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
    accounts,
    accountsLoading: loading,
    toggleGroup,
    toggleFollower,
    deleteGroup,
    addGroup,
    updateGroup,
    activityLog,
    resetCircuitBreaker,
  } = useCopierGroupsContext();

  // Only non-archived accounts are valid for copier groups
  const activeAccounts = useMemo(() => accounts.filter(a => !a.is_archived), [accounts]);

  const [createOpen, setCreateOpen] = useState(false);
  const [configureGroup, setConfigureGroup] = useState<CopierGroup | null>(null);

  const handleToggleGroup = async (groupId: string) => {
    await toggleGroup(groupId);
  };

  const handleToggleFollower = async (groupId: string, accountId: string) => {
    await toggleFollower(groupId, accountId);
  };

  const handleDeleteGroup = async (groupId: string) => {
    await deleteGroup(groupId);
  };

  const handleGroupCreated = async (group: CopierGroup) => {
    await addGroup(group);
  };

  const handleConfigureSave = async (group: CopierGroup) => {
    await updateGroup(group);
    setConfigureGroup(null);
  };

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
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => setCreateOpen(true)}
                      disabled={loading || activeAccounts.length < 2}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      New Copier Group
                    </Button>
                  </span>
                </TooltipTrigger>
                {!loading && activeAccounts.length < 2 && (
                  <TooltipContent>
                    <p>You need at least 2 active accounts to create a copier group</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Copier Group Cards */}
        {groups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Copier Groups</h2>
              <Badge variant="outline" className="text-xs">{groups.length}</Badge>
            </div>
            <div className="space-y-3">
              {groups.map(group => (
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

        {/* Live Activity Log */}
        {groups.length > 0 && activityLog.length > 0 && (
          <Card className="border-border/50 bg-card/50 overflow-hidden">
            <div className="gradient-divider" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Copy Activity
                <Badge variant="outline" className="text-xs">{activityLog.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {activityLog.slice(0, 20).map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                      entry.status === 'failed'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {entry.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <ShieldAlert className="h-3 w-3 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-medium">{entry.symbol}</span>
                      <span className={entry.action === 'buy' ? 'text-green-400' : 'text-red-400'}>
                        {entry.action.toUpperCase()}
                      </span>
                      <span>{entry.volume} lots</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{entry.latency}ms</span>
                      <span className="text-muted-foreground/60">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notification Preferences */}
        {groups.length > 0 && (
          <NotificationPreferencesPanel />
        )}

        {/* Empty State */}
        {groups.length === 0 && !loading && (
          <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 overflow-hidden">
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/10 transition-all">
                      <span className="text-2xl font-black text-primary leading-none">{step.step}</span>
                    </div>
                    <h4 className="font-medium text-foreground text-sm">{step.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                ))}
              </div>

              {/* Prop Firms Showcase */}
              <div className="relative mt-2 mb-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">Compatible with 35+ prop firms</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                  {PROP_FIRMS.map((firm) => (
                    <div
                      key={firm.name}
                      title={firm.name}
                      className="group/firm relative flex items-center justify-center p-2.5 rounded-xl bg-muted/20 border border-border/20 hover:bg-primary/8 hover:border-primary/25 hover:scale-110 transition-all duration-200 cursor-default"
                    >
                      <img
                        src={firm.logo}
                        alt={firm.name}
                        className="w-7 h-7 rounded-lg object-contain opacity-60 group-hover/firm:opacity-100 transition-opacity duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 rounded-xl opacity-0 group-hover/firm:opacity-100 transition-opacity duration-200 bg-primary/5 ring-1 ring-primary/20" />
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6 pt-6 border-t border-border/30">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4 animate-pulse text-primary" />
                    Loading accounts...
                  </div>
                ) : activeAccounts.length < 2 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldAlert className="h-4 w-4 text-yellow-500" />
                    You need at least 2 active accounts to create a copier group
                  </div>
                ) : (
                  <Button size="lg" className="group" onClick={() => setCreateOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Your First Copier Group
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Modal */}
        <CreateCopierGroupModal
          key={createOpen ? 'create-open' : 'create-closed'}
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
          accounts={accounts}
        />
      </div>
    </PageBackground>
  );
};

export default TradeCopier;
