import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/ui/number-input';
import { Loader2 } from 'lucide-react';
import { CreateAccountData } from '@/hooks/useTradingAccounts';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAccountData) => Promise<{ error: Error | null }>;
}

const PROP_FIRMS = [
  'FTMO',
  'The 5%ers',
  'MyForexFunds',
  'Funded Trading Plus',
  'True Forex Funds',
  'Alpha Capital',
  'Funding Pips',
  'TopStep',
  'Apex',
  'Other',
];

const ACCOUNT_SIZES = [
  { label: '$5,000', value: 5000 },
  { label: '$10,000', value: 10000 },
  { label: '$25,000', value: 25000 },
  { label: '$50,000', value: 50000 },
  { label: '$100,000', value: 100000 },
  { label: '$200,000', value: 200000 },
];

const PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'Other'];

export const AddAccountModal = ({ open, onOpenChange, onSubmit }: AddAccountModalProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);
  
  const [formData, setFormData] = useState({
    phase: 'evaluation' as 'evaluation' | 'funded' | 'live',
    account_name: '',
    prop_firm: '',
    account_size: 0,
    platform: 'MT5',
    server: '',
    login: '',
    password: '',
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 0,
  });

  const handlePhaseSelect = (phase: 'evaluation' | 'funded' | 'live') => {
    setFormData({ ...formData, phase });
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const data: CreateAccountData = {
      account_name: formData.account_name,
      prop_firm: formData.prop_firm || undefined,
      account_size: formData.account_size || undefined,
      phase: formData.phase,
      platform: formData.platform,
      server: formData.server || undefined,
      login: formData.login || undefined,
      ...(showRules && {
        profit_target: formData.profit_target,
        max_loss: formData.max_loss,
        max_daily_loss: formData.max_daily_loss,
        min_trading_days: formData.min_trading_days,
      }),
    };
    
    const { error } = await onSubmit(data);
    setLoading(false);
    
    if (!error) {
      onOpenChange(false);
      setStep(1);
      setFormData({
        phase: 'evaluation',
        account_name: '',
        prop_firm: '',
        account_size: 0,
        platform: 'MT5',
        server: '',
        login: '',
        password: '',
        profit_target: 10,
        max_loss: 10,
        max_daily_loss: 5,
        min_trading_days: 0,
      });
      setShowRules(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Select Account Type' : step === 3 ? 'Account Credentials' : 'Add Trading Account'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3 py-4">
            <button
              onClick={() => handlePhaseSelect('evaluation')}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: '0ms', animationFillMode: 'both' }}
            >
              <h3 className="font-medium text-foreground">Evaluation</h3>
              <p className="text-sm text-muted-foreground">Challenge or evaluation phase account</p>
            </button>
            <button
              onClick={() => handlePhaseSelect('funded')}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: '100ms', animationFillMode: 'both' }}
            >
              <h3 className="font-medium text-foreground">Funded</h3>
              <p className="text-sm text-muted-foreground">Passed challenge, now funded</p>
            </button>
            <button
              onClick={() => handlePhaseSelect('live')}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: '200ms', animationFillMode: 'both' }}
            >
              <h3 className="font-medium text-foreground">Hedge Account</h3>
              <p className="text-sm text-muted-foreground">Account for hedging trades</p>
            </button>
          </div>
        ) : formData.phase === 'live' ? (
          /* Hedge Account Form */
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                placeholder="My Hedge Account"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input
                id="login"
                placeholder="12345678"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                placeholder="Broker-Live"
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={loading || !formData.account_name || !formData.login || !formData.password || !formData.server} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Account
              </Button>
            </div>
          </form>
        ) : step === 3 ? (
          /* Credentials Form (Step 3 for Evaluation/Funded) */
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input
                id="login"
                placeholder="12345678"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                placeholder="Broker-Live"
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={loading || !formData.login || !formData.password || !formData.server} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Account
              </Button>
            </div>
          </form>
        ) : (
          /* Evaluation/Funded Account Form */
          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                placeholder="My FTMO Challenge"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop_firm">Prop Firm</Label>
              <Select
                value={formData.prop_firm}
                onValueChange={(value) => setFormData({ ...formData, prop_firm: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select prop firm" />
                </SelectTrigger>
                <SelectContent>
                  {PROP_FIRMS.map((firm) => (
                    <SelectItem key={firm} value={firm}>
                      {firm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_size">Account Size</Label>
              <Select
                value={formData.account_size.toString()}
                onValueChange={(value) => setFormData({ ...formData, account_size: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account size" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value.toString()}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="show_rules">Add Prop Firm Rules</Label>
              <Switch
                id="show_rules"
                checked={showRules}
                onCheckedChange={setShowRules}
              />
            </div>

            {showRules && (
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="profit_target">Profit Target (%)</Label>
                  <NumberInput
                    id="profit_target"
                    value={formData.profit_target}
                    onChange={(value) => setFormData({ ...formData, profit_target: value })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_loss">Max Loss (%)</Label>
                  <NumberInput
                    id="max_loss"
                    value={formData.max_loss}
                    onChange={(value) => setFormData({ ...formData, max_loss: value })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_daily_loss">Max Daily Loss (%)</Label>
                  <NumberInput
                    id="max_daily_loss"
                    value={formData.max_daily_loss}
                    onChange={(value) => setFormData({ ...formData, max_daily_loss: value })}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_trading_days">Min Trading Days</Label>
                  <NumberInput
                    id="min_trading_days"
                    value={formData.min_trading_days}
                    onChange={(value) => setFormData({ ...formData, min_trading_days: value })}
                    min={0}
                    step={1}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={!formData.account_name || !formData.account_size} className="flex-1">
                Next
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
