import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Crown,
  Users,
  Shield,
  ArrowRightLeft,
  Settings,
  Repeat2,
  Info,
  CircleDot,
  Pause,
  AlertTriangle,
  Clock,
  Zap,
  Save,
  BarChart3,
  Timer,
  Hash,
  ArrowRight,
} from 'lucide-react';
import type { CopierGroup, FollowerConfig, VolumeSizingMode, AccountProtectionMode } from '@/types/copier';

// ─── Config constants ───────────────────────────────────────────────────────

const volumeOptions: { value: VolumeSizingMode; label: string; hint: string }[] = [
  { value: 'equity-to-equity',    label: 'Equity-to-Equity',    hint: 'Same risk % as leader based on equity ratio' },
  { value: 'lot-multiplier',      label: 'Lot Multiplier',      hint: 'Multiply leader lot size by a factor' },
  { value: 'risk-multiplier',     label: 'Risk Multiplier',     hint: 'Multiply equity ratio by a factor' },
  { value: 'fixed-lot',           label: 'Fixed Lot',           hint: 'Use a fixed lot size for every trade' },
  { value: 'fixed-risk-percent',  label: 'Fixed Risk %',        hint: 'Risk a fixed % of equity (requires SL)' },
  { value: 'fixed-risk-nominal',  label: 'Fixed Risk $',        hint: 'Risk a fixed $ amount (requires SL)' },
];

const protectionOptions: { value: AccountProtectionMode; label: string; hint: string }[] = [
  { value: 'off',           label: 'Off',            hint: 'No account protection monitoring' },
  { value: 'balance-based', label: 'Balance-based',   hint: 'Monitor closed P&L only' },
  { value: 'equity-based',  label: 'Equity-based',    hint: 'Monitor balance + floating P&L in real-time' },
];

const statusConfig: Record<string, { color: string; icon: typeof CircleDot; label: string }> = {
  active:  { color: 'text-green-500',  icon: CircleDot,      label: 'Active' },
  paused:  { color: 'text-yellow-500', icon: Pause,          label: 'Paused' },
  error:   { color: 'text-red-500',    icon: AlertTriangle,  label: 'Error' },
  pending: { color: 'text-blue-500',   icon: Clock,          label: 'Pending' },
};

const phaseConfig: Record<string, { className: string; label: string }> = {
  evaluation: { className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', label: 'EVAL' },
  funded:     { className: 'bg-primary/20 text-primary border-primary/30',          label: 'FUNDED' },
  live:       { className: 'bg-blue-500/20 text-blue-500 border-blue-500/30',       label: 'HEDGE' },
};

// ─── Per-follower editable state ────────────────────────────────────────────

interface FollowerFormState {
  volumeSizing: VolumeSizingMode;
  lotMultiplier: string;
  riskMultiplier: string;
  fixedLot: string;
  fixedRiskPercent: string;
  fixedRiskNominal: string;
  copySL: boolean;
  copyTP: boolean;
  additionalSLPips: string;
  additionalTPPips: string;
  reverseMode: boolean;
  delayMs: string;
  symbolSuffix: string;
  symbolAliases: string;       // "DJ30.cash=US30|0.1;SpotCrude=WTI|10"
  symbolBlacklist: string;     // "-DJ30;-USDJPY" or "+BTCUSD;+ETHUSD"
  magicNumberFilter: string;   // "+111111;+222222;-333333"
  protectionMode: AccountProtectionMode;
  minThreshold: string;
  maxThreshold: string;
}

function followerToForm(f: FollowerConfig): FollowerFormState {
  return {
    volumeSizing: f.volumeSizing,
    lotMultiplier: String(f.lotMultiplier),
    riskMultiplier: String(f.riskMultiplier),
    fixedLot: String(f.fixedLot),
    fixedRiskPercent: String(f.fixedRiskPercent),
    fixedRiskNominal: String(f.fixedRiskNominal),
    copySL: f.copySL,
    copyTP: f.copyTP,
    additionalSLPips: String(f.additionalSLPips),
    additionalTPPips: String(f.additionalTPPips),
    reverseMode: f.reverseMode,
    delayMs: String(f.delayMs),
    symbolSuffix: f.symbolSuffix,
    symbolAliases: f.symbolAliases
      .map(a => `${a.masterSymbol}=${a.slaveSymbol}${a.lotMultiplier ? `|${a.lotMultiplier}` : ''}`)
      .join(';'),
    symbolBlacklist: [
      ...f.symbolWhitelist.map(s => `+${s}`),
      ...f.symbolBlacklist.map(s => `-${s}`),
    ].join(';'),
    magicNumberFilter: '',
    protectionMode: f.protectionMode,
    minThreshold: f.minThreshold > 0 ? String(f.minThreshold) : '',
    maxThreshold: f.maxThreshold > 0 ? String(f.maxThreshold) : '',
  };
}

function formToFollowerPatch(form: FollowerFormState): Partial<FollowerConfig> {
  // Parse symbol aliases string → SymbolMapping[]
  const symbolAliases = form.symbolAliases
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [left, right] = entry.split('=');
      if (!left || !right) return null;
      const [slaveSymbol, mult] = right.split('|');
      return {
        masterSymbol: left.trim(),
        slaveSymbol: slaveSymbol.trim(),
        lotMultiplier: mult ? parseFloat(mult) : undefined,
      };
    })
    .filter(Boolean) as FollowerConfig['symbolAliases'];

  // Parse blacklist/whitelist
  const symbolWhitelist: string[] = [];
  const symbolBlacklist: string[] = [];
  form.symbolBlacklist
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(entry => {
      if (entry.startsWith('+')) symbolWhitelist.push(entry.slice(1));
      else if (entry.startsWith('-')) symbolBlacklist.push(entry.slice(1));
      else symbolBlacklist.push(entry); // default to blacklist
    });

  return {
    volumeSizing: form.volumeSizing,
    lotMultiplier: parseFloat(form.lotMultiplier) || 1,
    riskMultiplier: parseFloat(form.riskMultiplier) || 1,
    fixedLot: parseFloat(form.fixedLot) || 0.01,
    fixedRiskPercent: parseFloat(form.fixedRiskPercent) || 1,
    fixedRiskNominal: parseFloat(form.fixedRiskNominal) || 50,
    copySL: form.copySL,
    copyTP: form.copyTP,
    additionalSLPips: parseFloat(form.additionalSLPips) || 0,
    additionalTPPips: parseFloat(form.additionalTPPips) || 0,
    reverseMode: form.reverseMode,
    delayMs: parseInt(form.delayMs) || 0,
    symbolSuffix: form.symbolSuffix,
    symbolAliases,
    symbolWhitelist,
    symbolBlacklist,
    protectionMode: form.protectionMode,
    minThreshold: parseFloat(form.minThreshold) || 0,
    maxThreshold: parseFloat(form.maxThreshold) || 0,
  };
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ConfigureCopierGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CopierGroup | null;
  onSave: (updated: CopierGroup) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConfigureCopierGroupModal({
  open,
  onOpenChange,
  group,
  onSave,
}: ConfigureCopierGroupModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [groupName, setGroupName] = useState('');
  const [leaderSuffixRemove, setLeaderSuffixRemove] = useState('');
  const [followerForms, setFollowerForms] = useState<Record<string, FollowerFormState>>({});
  const [expandedFollower, setExpandedFollower] = useState<string>('');

  // ── Initialise state from group ────────────────────────────────

  useEffect(() => {
    if (!group) return;
    setGroupName(group.name);
    setLeaderSuffixRemove(group.leaderSymbolSuffixRemove || '');
    const forms: Record<string, FollowerFormState> = {};
    group.followers.forEach(f => {
      forms[f.id] = followerToForm(f);
    });
    setFollowerForms(forms);
    setExpandedFollower(group.followers[0]?.id || '');
    setActiveTab('general');
  }, [group]);

  // ── Follower form updater ──────────────────────────────────────

  const updateFollower = useCallback(
    (followerId: string, patch: Partial<FollowerFormState>) => {
      setFollowerForms(prev => ({
        ...prev,
        [followerId]: { ...prev[followerId], ...patch },
      }));
    },
    [],
  );

  // ── Save ───────────────────────────────────────────────────────

  const handleSave = () => {
    if (!group) return;

    const updatedFollowers = group.followers.map(f => {
      const form = followerForms[f.id];
      if (!form) return f;
      return { ...f, ...formToFollowerPatch(form) };
    });

    const updated: CopierGroup = {
      ...group,
      name: groupName.trim() || group.name,
      leaderSymbolSuffixRemove: leaderSuffixRemove,
      followers: updatedFollowers,
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
    onOpenChange(false);
  };

  if (!group) return null;

  // ── Render ─────────────────────────────────────────────────────

  const lpc = phaseConfig[group.leaderPhase] || phaseConfig.evaluation;
  const sc = statusConfig[group.status] || statusConfig.active;
  const StatusIcon = sc.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configure Copier Group
          </DialogTitle>
          <DialogDescription>
            Edit group settings and per-follower configuration. Changes are applied to all followers individually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="general" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Settings className="h-3.5 w-3.5 mr-1" />
              General
            </TabsTrigger>
            <TabsTrigger value="followers" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-3.5 w-3.5 mr-1" />
              Followers ({group.followers.length})
            </TabsTrigger>
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Overview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-2" style={{ maxHeight: 'calc(90vh - 240px)' }}>
            {/* ─── TAB: General ─────────────────────────────────── */}
            <TabsContent value="general" className="mt-0 space-y-5">
              {/* Group Name */}
              <div className="space-y-2">
                <Label className="font-semibold">Group Name</Label>
                <Input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. FTMO 100k → IC Markets Hedge"
                />
              </div>

              <Separator />

              {/* Leader Info (read-only) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <Label className="font-semibold">Leader Account (Master)</Label>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${sc.color}`} />
                    <span className="font-medium text-foreground">{group.leaderAccountName}</span>
                    <Badge variant="outline" className={`text-[10px] ${lpc.className}`}>
                      {lpc.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">({group.leaderPlatform})</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Leader Symbol Suffix Remove */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">Remove Symbol Suffix (Leader)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>If the leader account has symbol suffixes (e.g. EURUSD_x), enter the suffix here to remove it before sending to followers.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  value={leaderSuffixRemove}
                  onChange={e => setLeaderSuffixRemove(e.target.value)}
                  placeholder="e.g. _x or .raw (leave blank if none)"
                />
                <p className="text-xs text-muted-foreground">
                  Strips this suffix from all leader symbols before processing on followers.
                </p>
              </div>

              {/* Group Status summary */}
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg border border-border/40 bg-muted/20 text-center">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`text-sm font-semibold ${sc.color}`}>{sc.label}</p>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-muted/20 text-center">
                  <p className="text-xs text-muted-foreground">Followers</p>
                  <p className="text-sm font-semibold">{group.stats.activeFollowers}/{group.stats.totalFollowers}</p>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-muted/20 text-center">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-semibold">{new Date(group.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </TabsContent>

            {/* ─── TAB: Followers (per-follower config) ───────── */}
            <TabsContent value="followers" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                Each follower has its own independent configuration, matching the{' '}
                <span className="text-primary font-medium">Heron Copier slave account</span> settings model.
              </p>

              <Accordion
                type="single"
                collapsible
                value={expandedFollower}
                onValueChange={setExpandedFollower}
              >
                {group.followers.map(follower => {
                  const form = followerForms[follower.id];
                  if (!form) return null;
                  const fsc = statusConfig[follower.status] || statusConfig.pending;
                  const FStatusIcon = fsc.icon;
                  const fpc = phaseConfig[follower.phase] || phaseConfig.live;

                  return (
                    <AccordionItem key={follower.id} value={follower.id} className="border border-border/40 rounded-lg mb-3 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20">
                        <div className="flex items-center gap-2 text-left">
                          <FStatusIcon className={`h-3.5 w-3.5 ${fsc.color}`} />
                          <span className="font-medium text-sm">{follower.accountName}</span>
                          <Badge variant="outline" className={`text-[10px] ${fpc.className}`}>
                            {fpc.label}
                          </Badge>
                          {form.reverseMode && (
                            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-500 border-purple-500/30">
                              <Repeat2 className="h-3 w-3 mr-0.5" />
                              Reverse
                            </Badge>
                          )}
                          {form.protectionMode !== 'off' && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              <Shield className="h-3 w-3 mr-0.5" />
                              Protected
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1">
                        <FollowerConfigPanel
                          follower={follower}
                          form={form}
                          onUpdate={(patch) => updateFollower(follower.id, patch)}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </TabsContent>

            {/* ─── TAB: Overview ──────────────────────────────── */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border/40 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Trades Today</p>
                  <p className="text-2xl font-bold">{group.stats.tradesToday}</p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Trades All Time</p>
                  <p className="text-2xl font-bold">{group.stats.tradesTotal}</p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Missed Hedges</p>
                  <p className={`text-2xl font-bold ${group.totalFailedCopies === 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {group.totalFailedCopies}
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
                  <p className={`text-2xl font-bold ${group.stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {group.stats.totalProfit >= 0 ? '+' : ''}${Math.abs(group.stats.totalProfit).toFixed(2)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Per-follower stats table */}
              <div className="space-y-2">
                <Label className="font-semibold">Per-Follower Statistics</Label>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <div className="grid grid-cols-6 gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border/30">
                    <span className="col-span-2">Account</span>
                    <span className="text-right">Trades</span>
                    <span className="text-right">Missed</span>
                    <span className="text-right">Success</span>
                    <span className="text-right">P&L</span>
                  </div>
                  {group.followers.map(f => (
                    <div key={f.id} className="grid grid-cols-6 gap-2 px-3 py-2.5 text-xs border-b border-border/20 last:border-0 hover:bg-muted/10">
                      <span className="col-span-2 font-medium truncate">{f.accountName}</span>
                      <span className="text-right text-muted-foreground">{f.stats.tradesToday}</span>
                    <span className={`text-right ${f.stats.failedCopies === 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                      {f.stats.failedCopies}
                      </span>
                      <span className="text-right text-muted-foreground">{f.stats.successRate}%</span>
                      <span className={`text-right font-medium ${f.stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {f.stats.totalProfit >= 0 ? '+' : ''}${Math.abs(f.stats.totalProfit).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t border-border/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Follower Config Panel ──────────────────────────────────────────────────
// Full per-follower settings matching Heron Copier's slave configuration.

function FollowerConfigPanel({
  follower,
  form,
  onUpdate,
}: {
  follower: FollowerConfig;
  form: FollowerFormState;
  onUpdate: (patch: Partial<FollowerFormState>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* ── Section 1: Volume Sizing ──────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <Label className="font-semibold text-sm">Volume Sizing</Label>
        </div>

        <Select
          value={form.volumeSizing}
          onValueChange={(v) => onUpdate({ volumeSizing: v as VolumeSizingMode })}
        >
          <SelectTrigger className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {volumeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="text-xs">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Dynamic volume field */}
        {form.volumeSizing === 'lot-multiplier' && (
          <div className="space-y-1">
            <Label className="text-xs">Lot Multiplier</Label>
            <Input type="number" step="0.1" className="text-xs" value={form.lotMultiplier} onChange={e => onUpdate({ lotMultiplier: e.target.value })} />
            <p className="text-[10px] text-muted-foreground">1.0 = same size, 0.5 = half, 2.0 = double leader lot size</p>
          </div>
        )}
        {form.volumeSizing === 'risk-multiplier' && (
          <div className="space-y-1">
            <Label className="text-xs">Risk Multiplier</Label>
            <Input type="number" step="0.1" className="text-xs" value={form.riskMultiplier} onChange={e => onUpdate({ riskMultiplier: e.target.value })} />
            <p className="text-[10px] text-muted-foreground">Multiplied against equity-to-equity ratio. 1.0 = same risk as E2E</p>
          </div>
        )}
        {form.volumeSizing === 'fixed-lot' && (
          <div className="space-y-1">
            <Label className="text-xs">Fixed Lot Size</Label>
            <Input type="number" step="0.01" className="text-xs" value={form.fixedLot} onChange={e => onUpdate({ fixedLot: e.target.value })} />
            <p className="text-[10px] text-muted-foreground">Every copied trade uses exactly this lot size</p>
          </div>
        )}
        {form.volumeSizing === 'fixed-risk-percent' && (
          <div className="space-y-1">
            <Label className="text-xs">Risk Percentage (%)</Label>
            <Input type="number" step="0.1" className="text-xs" value={form.fixedRiskPercent} onChange={e => onUpdate({ fixedRiskPercent: e.target.value })} />
            <p className="text-[10px] text-muted-foreground">
              Lot size calculated to risk this % of equity. <strong>Requires leader trade to have a stop loss.</strong>
            </p>
          </div>
        )}
        {form.volumeSizing === 'fixed-risk-nominal' && (
          <div className="space-y-1">
            <Label className="text-xs">Risk Amount ($)</Label>
            <Input type="number" step="1" className="text-xs" value={form.fixedRiskNominal} onChange={e => onUpdate({ fixedRiskNominal: e.target.value })} />
            <p className="text-[10px] text-muted-foreground">
              Lot size calculated to risk exactly this $ amount. <strong>Requires leader trade to have a stop loss.</strong>
            </p>
          </div>
        )}
        {form.volumeSizing === 'equity-to-equity' && (
          <p className="text-[10px] text-muted-foreground">
            Lot size automatically calculated to maintain the same risk percentage as the leader based on equity ratio.
          </p>
        )}
      </div>

      <Separator />

      {/* ── Section 2: Trade Copy Settings ────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <Label className="font-semibold text-sm">Trade Copy Settings</Label>
        </div>

        {/* SL / TP toggles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/20">
            <Label className="text-xs">Copy SL from Leader</Label>
            <Switch checked={form.copySL} onCheckedChange={v => onUpdate({ copySL: v })} />
          </div>
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/20">
            <Label className="text-xs">Copy TP from Leader</Label>
            <Switch checked={form.copyTP} onCheckedChange={v => onUpdate({ copyTP: v })} />
          </div>
        </div>

        {/* Additional TP/SL pips */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Additional SL (pips)</Label>
            <Input type="number" step="1" className="text-xs" value={form.additionalSLPips} onChange={e => onUpdate({ additionalSLPips: e.target.value })} placeholder="0" />
            <p className="text-[10px] text-muted-foreground">Buffer added to SL for spread differences</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Additional TP (pips)</Label>
            <Input type="number" step="1" className="text-xs" value={form.additionalTPPips} onChange={e => onUpdate({ additionalTPPips: e.target.value })} placeholder="0" />
            <p className="text-[10px] text-muted-foreground">Buffer added to TP for spread differences</p>
          </div>
        </div>

        {/* Reverse Mode */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-purple-500" />
            <div>
              <Label className="text-xs font-medium">Reverse Mode</Label>
              <p className="text-[10px] text-muted-foreground">Copy trades in opposite direction for hedging</p>
            </div>
          </div>
          <Switch checked={form.reverseMode} onCheckedChange={v => onUpdate({ reverseMode: v })} />
        </div>

        {/* Delay */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Max Delay (milliseconds)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Random delay applied from 0ms to this value before copying each trade. Useful to avoid detection on some platforms.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input type="number" step="100" className="text-xs" value={form.delayMs} onChange={e => onUpdate({ delayMs: e.target.value })} placeholder="0" />
        </div>
      </div>

      <Separator />

      {/* ── Section 3: Symbol Configuration ───────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <Label className="font-semibold text-sm">Symbol Configuration</Label>
        </div>

        {/* Symbol Suffix */}
        <div className="space-y-1">
          <Label className="text-xs">Add Symbol Suffix</Label>
          <Input className="text-xs" value={form.symbolSuffix} onChange={e => onUpdate({ symbolSuffix: e.target.value })} placeholder="e.g. _x or .raw" />
          <p className="text-[10px] text-muted-foreground">
            Appended to all symbols: EURUSD → EURUSD{form.symbolSuffix || '_x'}
          </p>
        </div>

        {/* Symbol Aliases */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Symbol Aliases</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs">
                    Map symbols between brokers with optional lot multiplier overrides.<br />
                    <strong>Format:</strong> MasterSymbol=SlaveSymbol|LotMultiplier<br />
                    <strong>Example:</strong> DJ30.cash=US30|0.1;SpotCrude=WTI|10;BTCUSDT=BTCUSD
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            className="text-xs min-h-[60px] font-mono"
            value={form.symbolAliases}
            onChange={e => onUpdate({ symbolAliases: e.target.value })}
            placeholder="DJ30.cash=US30|0.1;SpotCrude=WTI|10;BTCUSDT=BTCUSD"
          />
          <p className="text-[10px] text-muted-foreground">
            Aliases take priority over the symbol suffix. Separate entries with semicolons.
          </p>
        </div>

        {/* Symbol Black/Whitelist */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Symbol Black/Whitelist</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs">
                    <strong>+SYMBOL</strong> = whitelist (only these are copied)<br />
                    <strong>-SYMBOL</strong> = blacklist (these are skipped)<br />
                    <strong>Example:</strong> +BTCUSD;+ETHUSD or -DJ30;-USDJPY
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            className="text-xs font-mono"
            value={form.symbolBlacklist}
            onChange={e => onUpdate({ symbolBlacklist: e.target.value })}
            placeholder="+BTCUSD;+ETHUSD or -DJ30;-USDJPY"
          />
          <p className="text-[10px] text-muted-foreground">
            Prefix with + for whitelist, - for blacklist. Separate with semicolons.
          </p>
        </div>

        {/* Magic Number Filter */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Magic Number Filter</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs">
                    Filter which trades to copy by their magic number.<br />
                    <strong>+NUMBER</strong> = only copy these magic numbers<br />
                    <strong>-NUMBER</strong> = skip these magic numbers<br />
                    Leave blank to copy all trades.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            className="text-xs font-mono"
            value={form.magicNumberFilter}
            onChange={e => onUpdate({ magicNumberFilter: e.target.value })}
            placeholder="+111111;+222222;-333333"
          />
        </div>

        {/* Processing order info box */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Symbol Processing Order</p>
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">1. Magic Number Filter</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-[10px]">2. Blacklist</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-[10px]">3. Whitelist</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-[10px]">4. Aliases</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-[10px]">5. Suffix</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-[10px]">6. Auto-map</Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Section 4: Account Protection ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <Label className="font-semibold text-sm">Account Protection</Label>
        </div>

        <Select
          value={form.protectionMode}
          onValueChange={(v) => onUpdate({ protectionMode: v as AccountProtectionMode })}
        >
          <SelectTrigger className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {protectionOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="text-xs">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {form.protectionMode !== 'off' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Minimum Threshold ($)</Label>
                <Input
                  type="number"
                  className="text-xs"
                  value={form.minThreshold}
                  onChange={e => onUpdate({ minThreshold: e.target.value })}
                  placeholder="e.g. 96000"
                />
                <p className="text-[10px] text-muted-foreground">
                  Close all & stop if {form.protectionMode === 'balance-based' ? 'balance' : 'equity'} drops below
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Maximum Threshold ($)</Label>
                <Input
                  type="number"
                  className="text-xs"
                  value={form.maxThreshold}
                  onChange={e => onUpdate({ maxThreshold: e.target.value })}
                  placeholder="e.g. 110000"
                />
                <p className="text-[10px] text-muted-foreground">
                  Close all & stop if {form.protectionMode === 'balance-based' ? 'balance' : 'equity'} rises above
                </p>
              </div>
            </div>

            {/* Prop firm tip */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-[10px] text-muted-foreground">
                <strong>Prop Firm Tip:</strong> For a $100k account with 4% max DD and 10% profit target, set min to $96,000 and max to $110,000.
                Use <strong>equity-based</strong> for real-time protection against floating losses.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
