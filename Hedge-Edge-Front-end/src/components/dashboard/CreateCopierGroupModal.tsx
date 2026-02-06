import { useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Crown,
  Users,
  Shield,
  ArrowRightLeft,
  Plus,
  Repeat2,
  Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TradingAccount } from '@/hooks/useTradingAccounts';
import type { CopierGroup, VolumeSizingMode, AccountProtectionMode } from '@/types/copier';
import { createCopierGroup, createDefaultFollower } from '@/mocks/copier-groups';

// ─── Phase badge config ─────────────────────────────────────────────────────

const phaseBadge: Record<string, { className: string; label: string }> = {
  evaluation: { className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', label: 'Eval' },
  funded:     { className: 'bg-primary/20 text-primary border-primary/30',          label: 'Funded' },
  live:       { className: 'bg-blue-500/20 text-blue-500 border-blue-500/30',       label: 'Hedge' },
};

// ─── Volume sizing options ──────────────────────────────────────────────────

const volumeOptions: { value: VolumeSizingMode; label: string; description: string }[] = [
  { value: 'equity-to-equity',   label: 'Equity-to-Equity',      description: 'Same risk % as leader based on equity ratio' },
  { value: 'lot-multiplier',     label: 'Lot Multiplier',         description: 'Multiply leader lot size by a factor' },
  { value: 'risk-multiplier',    label: 'Risk Multiplier',        description: 'Multiply equity ratio by a factor' },
  { value: 'fixed-lot',          label: 'Fixed Lot',              description: 'Use a fixed lot size for all trades' },
  { value: 'fixed-risk-percent', label: 'Fixed Risk %',           description: 'Risk a fixed % of equity per trade (needs SL)' },
  { value: 'fixed-risk-nominal', label: 'Fixed Risk $',           description: 'Risk a fixed dollar amount per trade (needs SL)' },
];

// ─── Protection options ─────────────────────────────────────────────────────

const protectionOptions: { value: AccountProtectionMode; label: string }[] = [
  { value: 'off',            label: 'Off' },
  { value: 'balance-based',  label: 'Balance-based' },
  { value: 'equity-based',   label: 'Equity-based' },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface CreateCopierGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: TradingAccount[];
  onCreated: (group: CopierGroup) => void;
  editGroup?: CopierGroup | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateCopierGroupModal({
  open,
  onOpenChange,
  accounts,
  onCreated,
  editGroup,
}: CreateCopierGroupModalProps) {
  const activeAccounts = useMemo(
    () => accounts.filter(a => !a.is_archived),
    [accounts],
  );

  // ── State ──────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState('accounts');
  const [groupName, setGroupName] = useState(editGroup?.name || '');
  const [leaderId, setLeaderId] = useState(editGroup?.leaderAccountId || '');
  const [selectedFollowerIds, setSelectedFollowerIds] = useState<string[]>(
    editGroup?.followers.map(f => f.accountId) || [],
  );

  // Risk settings (applied to all new followers as defaults)
  const [volumeSizing, setVolumeSizing] = useState<VolumeSizingMode>('equity-to-equity');
  const [lotMultiplier, setLotMultiplier] = useState('1.0');
  const [riskMultiplier, setRiskMultiplier] = useState('1.0');
  const [fixedLot, setFixedLot] = useState('0.01');
  const [fixedRiskPercent, setFixedRiskPercent] = useState('1.0');
  const [fixedRiskNominal, setFixedRiskNominal] = useState('50');
  const [copySL, setCopySL] = useState(true);
  const [copyTP, setCopyTP] = useState(true);
  const [reverseMode, setReverseMode] = useState(false);

  // Protection
  const [protectionMode, setProtectionMode] = useState<AccountProtectionMode>('off');
  const [minThreshold, setMinThreshold] = useState('');
  const [maxThreshold, setMaxThreshold] = useState('');

  // Symbol mapping
  const [symbolSuffix, setSymbolSuffix] = useState('');
  const [symbolBlacklist, setSymbolBlacklist] = useState('');

  // ── Derived ────────────────────────────────────────────────────

  const leader = activeAccounts.find(a => a.id === leaderId);
  const availableFollowers = activeAccounts.filter(a => a.id !== leaderId);

  const toggleFollower = (id: string) => {
    setSelectedFollowerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const canCreate = groupName.trim() && leaderId && selectedFollowerIds.length > 0;

  // ── Submit ─────────────────────────────────────────────────────

  const handleCreate = () => {
    if (!leader) return;
    const followerAccounts = selectedFollowerIds
      .map(id => activeAccounts.find(a => a.id === id)!)
      .filter(Boolean);

    const group = createCopierGroup(groupName.trim(), leader, followerAccounts);

    // Apply risk settings to each follower
    group.followers = group.followers.map(f => ({
      ...f,
      volumeSizing,
      lotMultiplier: parseFloat(lotMultiplier) || 1,
      riskMultiplier: parseFloat(riskMultiplier) || 1,
      fixedLot: parseFloat(fixedLot) || 0.01,
      fixedRiskPercent: parseFloat(fixedRiskPercent) || 1,
      fixedRiskNominal: parseFloat(fixedRiskNominal) || 50,
      copySL,
      copyTP,
      reverseMode,
      protectionMode,
      minThreshold: parseFloat(minThreshold) || 0,
      maxThreshold: parseFloat(maxThreshold) || 0,
      symbolSuffix,
      symbolBlacklist: symbolBlacklist
        .split(';')
        .map(s => s.trim())
        .filter(Boolean),
    }));

    onCreated(group);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setGroupName('');
    setLeaderId('');
    setSelectedFollowerIds([]);
    setVolumeSizing('equity-to-equity');
    setLotMultiplier('1.0');
    setRiskMultiplier('1.0');
    setFixedLot('0.01');
    setFixedRiskPercent('1.0');
    setFixedRiskNominal('50');
    setCopySL(true);
    setCopyTP(true);
    setReverseMode(false);
    setProtectionMode('off');
    setMinThreshold('');
    setMaxThreshold('');
    setSymbolSuffix('');
    setSymbolBlacklist('');
    setActiveTab('accounts');
  };

  // ── Render volume sizing fields ────────────────────────────────

  const renderVolumeFields = () => {
    switch (volumeSizing) {
      case 'lot-multiplier':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Lot Multiplier</Label>
            <Input
              type="number"
              step="0.1"
              value={lotMultiplier}
              onChange={e => setLotMultiplier(e.target.value)}
              placeholder="1.0"
            />
            <p className="text-xs text-muted-foreground">1.0 = same size, 0.5 = half, 2.0 = double</p>
          </div>
        );
      case 'risk-multiplier':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Risk Multiplier</Label>
            <Input
              type="number"
              step="0.1"
              value={riskMultiplier}
              onChange={e => setRiskMultiplier(e.target.value)}
              placeholder="1.0"
            />
            <p className="text-xs text-muted-foreground">Multiplied against equity-to-equity ratio</p>
          </div>
        );
      case 'fixed-lot':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Fixed Lot Size</Label>
            <Input
              type="number"
              step="0.01"
              value={fixedLot}
              onChange={e => setFixedLot(e.target.value)}
              placeholder="0.01"
            />
          </div>
        );
      case 'fixed-risk-percent':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Risk Percentage (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={fixedRiskPercent}
              onChange={e => setFixedRiskPercent(e.target.value)}
              placeholder="1.0"
            />
            <p className="text-xs text-muted-foreground">Requires leader trade to have a stop loss</p>
          </div>
        );
      case 'fixed-risk-nominal':
        return (
          <div className="space-y-2">
            <Label className="text-xs">Risk Amount ($)</Label>
            <Input
              type="number"
              step="1"
              value={fixedRiskNominal}
              onChange={e => setFixedRiskNominal(e.target.value)}
              placeholder="50"
            />
            <p className="text-xs text-muted-foreground">Requires leader trade to have a stop loss</p>
          </div>
        );
      default:
        return (
          <p className="text-xs text-muted-foreground">
            Lot size automatically matched to maintain the same risk as the leader account.
          </p>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {editGroup ? 'Edit Copier Group' : 'Create Copier Group'}
          </DialogTitle>
          <DialogDescription>
            Set up a leader account and one or more followers with per-group risk settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="accounts" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-3.5 w-3.5 mr-1" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="risk" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Shield className="h-3.5 w-3.5 mr-1" />
              Risk
            </TabsTrigger>
            <TabsTrigger value="symbols" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              Symbols
            </TabsTrigger>
            <TabsTrigger value="protection" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Shield className="h-3.5 w-3.5 mr-1" />
              Protection
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-2" style={{ maxHeight: 'calc(85vh - 260px)' }}>
            {/* ─── TAB 1: Accounts ─────────────────────────────── */}
            <TabsContent value="accounts" className="mt-0 space-y-5">
              {/* Group Name */}
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. FTMO 100k → IC Markets Hedge"
                />
              </div>

              <Separator />

              {/* Leader Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <Label className="font-semibold">Leader Account (Master)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The leader account is the source of trades. All trades on this account will be copied to the follower accounts.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={leaderId} onValueChange={setLeaderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leader account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map(acc => {
                      const pb = phaseBadge[acc.phase] || phaseBadge.live;
                      return (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <span>{acc.account_name}</span>
                            <Badge variant="outline" className={`text-[10px] ${pb.className}`}>
                              {pb.label}
                            </Badge>
                            {acc.prop_firm && (
                              <span className="text-xs text-muted-foreground">({acc.prop_firm})</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Follower Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <Label className="font-semibold">Follower Accounts</Label>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedFollowerIds.length} selected
                  </Badge>
                </div>

                {availableFollowers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {leaderId
                      ? 'No other accounts available. Add more accounts first.'
                      : 'Select a leader account first.'}
                  </p>
                )}

                <div className="space-y-2">
                  {availableFollowers.map(acc => {
                    const pb = phaseBadge[acc.phase] || phaseBadge.live;
                    const checked = selectedFollowerIds.includes(acc.id);
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border/40 hover:border-border/80 bg-muted/20'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleFollower(acc.id)}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">{acc.account_name}</span>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${pb.className}`}>
                            {pb.label}
                          </Badge>
                          {acc.prop_firm && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {acc.prop_firm}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ${Number(acc.account_size).toLocaleString()}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ─── TAB 2: Risk Management ─────────────────────── */}
            <TabsContent value="risk" className="mt-0 space-y-5">
              {/* Volume Sizing */}
              <div className="space-y-3">
                <Label className="font-semibold">Volume Sizing Mode</Label>
                <Select
                  value={volumeSizing}
                  onValueChange={v => setVolumeSizing(v as VolumeSizingMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {volumeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            — {opt.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {renderVolumeFields()}
              </div>

              <Separator />

              {/* TP / SL */}
              <div className="space-y-4">
                <Label className="font-semibold">Stop Loss & Take Profit</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                    <Label className="text-sm">Copy SL from Leader</Label>
                    <Switch checked={copySL} onCheckedChange={setCopySL} />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                    <Label className="text-sm">Copy TP from Leader</Label>
                    <Switch checked={copyTP} onCheckedChange={setCopyTP} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Reverse Mode */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Repeat2 className="h-4 w-4 text-purple-500" />
                  <div>
                    <Label className="text-sm font-medium">Reverse Mode (Hedging)</Label>
                    <p className="text-xs text-muted-foreground">
                      Copy trades in the opposite direction for hedging
                    </p>
                  </div>
                </div>
                <Switch checked={reverseMode} onCheckedChange={setReverseMode} />
              </div>
            </TabsContent>

            {/* ─── TAB 3: Symbol Mapping ──────────────────────── */}
            <TabsContent value="symbols" className="mt-0 space-y-5">
              <div className="space-y-2">
                <Label className="font-semibold">Symbol Suffix</Label>
                <Input
                  value={symbolSuffix}
                  onChange={e => setSymbolSuffix(e.target.value)}
                  placeholder="e.g. _x or .raw"
                />
                <p className="text-xs text-muted-foreground">
                  Appended to all symbol names on the follower side (e.g. EURUSD → EURUSD_x)
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="font-semibold">Symbol Blacklist</Label>
                <Input
                  value={symbolBlacklist}
                  onChange={e => setSymbolBlacklist(e.target.value)}
                  placeholder="e.g. DJ30;USDJPY;XAUUSD"
                />
                <p className="text-xs text-muted-foreground">
                  Semicolon-separated list of symbols to skip when copying
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                <p className="text-xs text-muted-foreground">
                  <strong>Symbol Aliases</strong> for cross-broker mapping (e.g. DJ30.cash=US30|0.1) 
                  can be configured per-follower after group creation.
                </p>
              </div>
            </TabsContent>

            {/* ─── TAB 4: Account Protection ──────────────────── */}
            <TabsContent value="protection" className="mt-0 space-y-5">
              <div className="space-y-3">
                <Label className="font-semibold">Account Protection Mode</Label>
                <Select
                  value={protectionMode}
                  onValueChange={v => setProtectionMode(v as AccountProtectionMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {protectionOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  When triggered, all positions are closed and copying is stopped on the follower.
                </p>
              </div>

              {protectionMode !== 'off' && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Minimum Threshold ($)</Label>
                      <Input
                        type="number"
                        value={minThreshold}
                        onChange={e => setMinThreshold(e.target.value)}
                        placeholder="e.g. 96000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Close & stop if {protectionMode === 'balance-based' ? 'balance' : 'equity'} falls below
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Maximum Threshold ($)</Label>
                      <Input
                        type="number"
                        value={maxThreshold}
                        onChange={e => setMaxThreshold(e.target.value)}
                        placeholder="e.g. 110000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Close & stop if {protectionMode === 'balance-based' ? 'balance' : 'equity'} rises above
                      </p>
                    </div>
                  </div>

                  {leader && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Leader account size is ${Number(leader.account_size).toLocaleString()}.
                        {leader.max_loss && (
                          <> Max loss rule: {leader.max_loss}%. Suggested min threshold: $
                            {Math.round(Number(leader.account_size) * (1 - Number(leader.max_loss) / 100)).toLocaleString()}.
                          </>
                        )}
                        {leader.profit_target && (
                          <> Profit target: {leader.profit_target}%. Suggested max threshold: $
                            {Math.round(Number(leader.account_size) * (1 + Number(leader.profit_target) / 100)).toLocaleString()}.
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4 pt-4 border-t border-border/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canCreate} onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            {editGroup ? 'Save Changes' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
