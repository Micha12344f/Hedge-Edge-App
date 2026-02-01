import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/ui/number-input';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Server, 
  Monitor,
  ChevronRight,
  ChevronLeft,
  Folder,
  Play,
  RefreshCw,
  Search,
  HardDrive,
  AlertCircle
} from 'lucide-react';
import { CreateAccountData, TradingAccount } from '@/hooks/useTradingAccounts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { mt5, ctrader, isBridgeAvailable } from '@/lib/local-trading-bridge';
import { cachePassword } from '@/lib/mt5-password-cache';
import { isElectron } from '@/lib/desktop';
import { PermissionsChecklist, CTraderGuidance } from './PermissionsChecklist';

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'account-type' | 'platform' | 'terminal' | 'credentials' | 'prop-details';
type AccountPhase = 'evaluation' | 'funded' | 'live';
type Platform = 'MT4' | 'MT5' | 'cTrader';
type TerminalType = 'mt4' | 'mt5' | 'ctrader';

interface DetectedTerminal {
  id: string;
  type: TerminalType;
  name: string;
  executablePath: string;
  installPath: string;
  broker?: string;
  version?: string;
  isRunning?: boolean;
  terminalId?: string;
  dataPath?: string;
}

interface DetectionResult {
  success: boolean;
  terminals: DetectedTerminal[];
  error?: string;
  deepScan?: boolean;
}

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAccountData) => Promise<{ error: Error | null }>;
  defaultType?: 'hedge' | 'linked';
  hedgeAccounts?: TradingAccount[];
}

// ============================================================================
// Constants
// ============================================================================

export const PROP_FIRMS = [
  { name: 'Funding Pips', logo: 'https://www.google.com/s2/favicons?domain=fundingpips.com&sz=64' },
  { name: 'The5ers', logo: 'https://www.google.com/s2/favicons?domain=the5ers.com&sz=64' },
  { name: 'Alpha Capital', logo: 'https://www.google.com/s2/favicons?domain=alphacapitalgroup.uk&sz=64' },
  { name: 'Blueberry Funded', logo: 'https://www.google.com/s2/favicons?domain=blueberryfunded.com&sz=64' },
  { name: 'ThinkCapital', logo: 'https://www.google.com/s2/favicons?domain=thinkcapital.com&sz=64' },
  { name: 'ATFunded', logo: 'https://www.google.com/s2/favicons?domain=atfunded.com&sz=64' },
  { name: 'Hantec Trader', logo: 'https://www.google.com/s2/favicons?domain=htrader.com&sz=64' },
  { name: 'QT Funded', logo: 'https://www.google.com/s2/favicons?domain=qtfunded.com&sz=64' },
  { name: 'Blue Guardian', logo: 'https://www.google.com/s2/favicons?domain=blueguardian.com&sz=64' },
  { name: 'BrightFunded', logo: 'https://www.google.com/s2/favicons?domain=brightfunded.com&sz=64' },
  { name: 'AquaFunded', logo: 'https://www.google.com/s2/favicons?domain=aquafunded.com&sz=64' },
  { name: 'City Traders Imperium', logo: 'https://www.google.com/s2/favicons?domain=citytradersimperium.com&sz=64' },
  { name: 'Lark Funding', logo: 'https://www.google.com/s2/favicons?domain=larkfunding.com&sz=64' },
  { name: 'Audacity Capital', logo: 'https://www.google.com/s2/favicons?domain=audacitycapital.co.uk&sz=64' },
  { name: 'Funded Trading Plus', logo: 'https://www.google.com/s2/favicons?domain=fundedtradingplus.com&sz=64' },
  { name: 'Alpha Futures', logo: 'https://www.google.com/s2/favicons?domain=alpha-futures.com&sz=64' },
  { name: 'E8 Markets', logo: 'https://www.google.com/s2/favicons?domain=e8markets.com&sz=64' },
  { name: 'FundedNext', logo: 'https://www.google.com/s2/favicons?domain=fundednext.com&sz=64' },
  { name: 'Goat Funded Trader', logo: 'https://www.google.com/s2/favicons?domain=goatfundedtrader.com&sz=64' },
  { name: 'Top One Trader', logo: 'https://www.google.com/s2/favicons?domain=toponetrader.com&sz=64' },
  { name: 'Blueberry Futures', logo: 'https://www.google.com/s2/favicons?domain=blueberryfutures.com&sz=64' },
  { name: 'For Traders', logo: 'https://www.google.com/s2/favicons?domain=fortraders.com&sz=64' },
  { name: 'E8 Futures', logo: 'https://www.google.com/s2/favicons?domain=e8markets.com&sz=64' },
  { name: 'Funded Elite', logo: 'https://www.google.com/s2/favicons?domain=fundedelite.com&sz=64' },
  { name: 'Futures Elite', logo: 'https://www.google.com/s2/favicons?domain=futureselite.com&sz=64' },
  { name: 'FTMO', logo: 'https://www.google.com/s2/favicons?domain=ftmo.com&sz=64' },
  { name: 'FundedElite', logo: 'https://www.google.com/s2/favicons?domain=fundedelite.com&sz=64' },
  { name: 'OANDA Prop Trader', logo: 'https://www.google.com/s2/favicons?domain=oanda.com&sz=64' },
  { name: 'Seacrest Markets', logo: 'https://www.google.com/s2/favicons?domain=seacrestmarkets.io&sz=64' },
  { name: 'Fintokei', logo: 'https://www.google.com/s2/favicons?domain=fintokei.com&sz=64' },
  { name: 'Finotive Funding', logo: 'https://www.google.com/s2/favicons?domain=finotivefunding.com&sz=64' },
  { name: 'Crypto Fund Trader', logo: 'https://www.google.com/s2/favicons?domain=cryptofundtrader.com&sz=64' },
  { name: 'Nordic Funder', logo: 'https://www.google.com/s2/favicons?domain=nordicfunder.com&sz=64' },
  { name: 'FXIFY', logo: 'https://www.google.com/s2/favicons?domain=fxify.com&sz=64' },
  { name: 'Axi Select', logo: 'https://www.google.com/s2/favicons?domain=axi.com&sz=64' },
];

const ACCOUNT_SIZES = [
  { label: '$5k', value: 5000 },
  { label: '$10k', value: 10000 },
  { label: '$25k', value: 25000 },
  { label: '$50k', value: 50000 },
  { label: '$100k', value: 100000 },
  { label: '$150k', value: 150000 },
  { label: '$200k', value: 200000 },
  { label: '$250k', value: 250000 },
  { label: '$500k', value: 500000 },
  { label: '$1M', value: 1000000 },
  { label: '$2M', value: 2000000 },
];

// Platform logos - using Google's favicon service for reliability
const PLATFORMS: { id: Platform; name: string; logo: string; color: string }[] = [
  { 
    id: 'MT4', 
    name: 'MetaTrader 4', 
    logo: 'https://www.google.com/s2/favicons?domain=metatrader4.com&sz=64',
    color: 'hover:border-blue-500/50 hover:bg-blue-500/5' 
  },
  { 
    id: 'MT5', 
    name: 'MetaTrader 5', 
    logo: 'https://www.google.com/s2/favicons?domain=metatrader5.com&sz=64',
    color: 'hover:border-indigo-500/50 hover:bg-indigo-500/5' 
  },
  { 
    id: 'cTrader', 
    name: 'cTrader', 
    logo: 'https://www.google.com/s2/favicons?domain=ctrader.com&sz=64',
    color: 'hover:border-cyan-500/50 hover:bg-cyan-500/5' 
  },
];

const ACCOUNT_TYPES = [
  {
    phase: 'live' as const,
    title: 'Hedge Account',
    description: 'Personal account for hedging prop trades',
    color: 'hover:border-blue-500/50 hover:bg-blue-500/5',
    activeColor: 'border-blue-500/50 bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    phase: 'evaluation' as const,
    title: 'Evaluation',
    description: 'Challenge or evaluation phase account',
    color: 'hover:border-yellow-500/50 hover:bg-yellow-500/5',
    activeColor: 'border-yellow-500/50 bg-yellow-500/10',
    iconColor: 'text-yellow-500',
  },
  {
    phase: 'funded' as const,
    title: 'Funded',
    description: 'Passed challenge, now funded',
    color: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
    activeColor: 'border-emerald-500/50 bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
];

// ============================================================================
// Main Component
// ============================================================================

export const AddAccountModal = ({ 
  open, 
  onOpenChange, 
  onSubmit, 
  defaultType, 
  hedgeAccounts = [] 
}: AddAccountModalProps) => {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('account-type');
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [accountPhase, setAccountPhase] = useState<AccountPhase>('evaluation');
  const [platform, setPlatform] = useState<Platform>('MT5');
  const [selectedTerminal, setSelectedTerminal] = useState<DetectedTerminal | null>(null);
  const [formData, setFormData] = useState({
    account_name: '',
    prop_firm: '',
    account_size: 0,
    server: '',
    login: '',
    password: '',
    profit_target: 10,
    max_loss: 10,
    max_daily_loss: 5,
    min_trading_days: 4,
  });
  const [showRules, setShowRules] = useState(false);
  
  // Terminal detection state
  const [terminals, setTerminals] = useState<DetectedTerminal[]>([]);
  const [detectingTerminals, setDetectingTerminals] = useState(false);
  const [deepScanning, setDeepScanning] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [lastScanWasDeep, setLastScanWasDeep] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null);
  const [validatedAccount, setValidatedAccount] = useState<{
    name: string;
    broker: string;
    balance: number;
    equity: number;
    currency: string;
  } | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<'checking' | 'running' | 'not-running'>('checking');

  // Get the appropriate bridge based on platform
  const getBridge = (p: string) => {
    return p.toLowerCase() === 'ctrader' ? ctrader : mt5;
  };

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      setStep('account-type');
      setAccountPhase('evaluation');
      setPlatform('MT5');
      setSelectedTerminal(null);
      setFormData({
        account_name: '',
        prop_firm: '',
        account_size: 0,
        server: '',
        login: '',
        password: '',
        profit_target: 10,
        max_loss: 10,
        max_daily_loss: 5,
        min_trading_days: 4,
      });
      setShowRules(false);
      setTerminals([]);
      setTerminalError(null);
      setValidationResult(null);
      setValidatedAccount(null);
      setIsValidating(false);
      setTerminalStatus('checking');
    } else {
      // Handle defaultType when modal opens
      if (defaultType === 'hedge') {
        setAccountPhase('live');
        setStep('platform');
      } else if (defaultType === 'linked') {
        setAccountPhase('evaluation');
        setStep('account-type');
      }
    }
  }, [open, defaultType]);

  // Detect terminals
  const detectTerminals = useCallback(async (deep = false) => {
    if (!isElectron()) {
      setTerminalError('Terminal detection only available in desktop mode');
      return;
    }

    if (deep) {
      setDeepScanning(true);
    } else {
      setDetectingTerminals(true);
    }
    setTerminalError(null);

    try {
      const result: DetectionResult = deep
        ? await window.electronAPI!.terminals.detectDeep()
        : await window.electronAPI!.terminals.detect();
      
      if (result.success) {
        const filterType = platform.toLowerCase() as TerminalType;
        const filtered = result.terminals.filter(t => t.type === filterType);
        setTerminals(filtered);
        setLastScanWasDeep(deep || result.deepScan || false);
        
        if (filtered.length === 0) {
          setTerminalError(`No ${platform} installations found`);
        } else if (deep) {
          toast.success('Deep scan complete', {
            description: `Found ${filtered.length} terminal${filtered.length !== 1 ? 's' : ''}`,
          });
        }
      } else {
        setTerminalError(result.error || 'Detection failed');
      }
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setDetectingTerminals(false);
      setDeepScanning(false);
    }
  }, [platform]);

  // Launch terminal
  const handleLaunchTerminal = async (terminal: DetectedTerminal) => {
    if (!isElectron()) return;
    setLaunching(terminal.id);

    try {
      const result = await window.electronAPI!.terminals.launch(terminal.executablePath);
      if (result.success) {
        toast.success('Terminal launched', { description: `Starting ${terminal.name}...` });
        // Re-detect after delay to update running status
        setTimeout(() => detectTerminals(false), 2000);
      } else {
        toast.error('Failed to launch', { description: result.error });
      }
    } catch (err) {
      toast.error('Launch error', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLaunching(null);
    }
  };

  // Check terminal status (for validation)
  const checkTerminalStatus = useCallback(async () => {
    if (!isBridgeAvailable()) {
      setTerminalStatus('not-running');
      return;
    }
    setTerminalStatus('checking');
    try {
      const bridge = getBridge(platform);
      const result = await bridge.getStatus();
      setTerminalStatus(result.success && result.data?.terminalRunning ? 'running' : 'not-running');
    } catch {
      setTerminalStatus('not-running');
    }
  }, [platform]);

  // Check status when entering credentials step
  useEffect(() => {
    if (step === 'credentials') {
      checkTerminalStatus();
    }
  }, [step, checkTerminalStatus]);

  // Validate credentials
  const handleValidateCredentials = async () => {
    if (!formData.login || !formData.password || !formData.server) {
      toast.error('Please fill in all credential fields');
      return;
    }

    if (!isBridgeAvailable()) {
      toast.error('Trading bridge not available');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    setValidatedAccount(null);

    try {
      const bridge = getBridge(platform);
      const result = await bridge.validateCredentials({
        login: formData.login,
        password: formData.password,
        server: formData.server,
      });

      if (result.success && result.data) {
        setValidationResult('valid');
        setValidatedAccount({
          name: result.data.name,
          broker: result.data.broker,
          balance: result.data.balance,
          equity: result.data.equity,
          currency: result.data.currency,
        });
        toast.success('Credentials validated!', {
          description: `Connected to ${result.data.broker}`,
        });
      } else {
        setValidationResult('invalid');
        toast.error('Invalid credentials', {
          description: result.error || 'Could not connect',
        });
      }
    } catch (error) {
      setValidationResult('invalid');
      toast.error('Validation failed', {
        description: error instanceof Error ? error.message : 'Connection error',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    setLoading(true);
    
    const isEvaluationOrFunded = accountPhase === 'evaluation' || accountPhase === 'funded';
    
    const data: CreateAccountData = {
      account_name: formData.account_name,
      prop_firm: formData.prop_firm || undefined,
      account_size: formData.account_size || validatedAccount?.balance || undefined,
      current_balance: validatedAccount?.balance || undefined,
      phase: accountPhase,
      platform: platform,
      server: formData.server || undefined,
      login: formData.login || undefined,
      ...(isEvaluationOrFunded && {
        profit_target: formData.profit_target,
        max_loss: formData.max_loss,
        max_daily_loss: formData.max_daily_loss,
        min_trading_days: formData.min_trading_days,
      }),
    };
    
    const { error } = await onSubmit(data);
    setLoading(false);
    
    if (!error) {
      if (formData.login && formData.password && formData.server) {
        cachePassword(formData.login, formData.password, formData.server);
      }
      
      toast.success('Account added!', {
        description: validatedAccount 
          ? `Connected to ${validatedAccount.broker} • Balance: ${validatedAccount.currency} ${validatedAccount.balance.toLocaleString()}`
          : 'Click on the account to view live data',
      });
      onOpenChange(false);
    }
  };

  // Step navigation helpers
  const getStepTitle = () => {
    switch (step) {
      case 'account-type': return 'Select Account Type';
      case 'platform': return 'Select Platform';
      case 'terminal': return platform === 'cTrader' ? 'cTrader Setup' : `Select ${platform} Installation`;
      case 'credentials': return 'Enter Credentials';
      case 'prop-details': return 'Account Details';
      default: return 'Add Account';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'account-type': return 'Choose the type of trading account you want to add';
      case 'platform': return 'Select the trading platform for this account';
      case 'terminal': return platform === 'cTrader' ? 'Configure the cBot in your cTrader application' : 'Choose which terminal installation to use';
      case 'credentials': return 'Enter your trading account login details';
      case 'prop-details': return 'Provide additional account information';
      default: return '';
    }
  };

  const canProceedFromCredentials = () => {
    if (!formData.login || !formData.password || !formData.server) return false;
    // ALWAYS require validation to pass - we must verify credentials work by actually logging into MT5
    // This ensures the account is only added if we can successfully connect and pull data
    return validationResult === 'valid';
  };

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderAccountTypeStep = () => (
    <div className="space-y-3 py-2">
      {ACCOUNT_TYPES.map((type, index) => (
        <button
          key={type.phase}
          onClick={() => {
            setAccountPhase(type.phase);
            setStep('platform');
          }}
          className={cn(
            "w-full p-4 rounded-xl border border-border/50 transition-all text-left group",
            "hover:scale-[1.02] active:scale-[0.98]",
            type.color
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center",
              "transition-transform group-hover:scale-110",
              type.iconColor
            )}>
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {type.title}
              </h3>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </button>
      ))}
    </div>
  );

  const renderPlatformStep = () => (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-3 gap-3">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPlatform(p.id);
              setSelectedTerminal(null);
              setTerminals([]);
            }}
            className={cn(
              "p-4 rounded-xl border transition-all text-center",
              "hover:scale-[1.02] active:scale-[0.98]",
              platform === p.id
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
            )}
          >
            <img 
              src={p.logo} 
              alt={p.name}
              className="w-10 h-10 mx-auto mb-2 object-contain"
              onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234ade80"><rect width="24" height="24" rx="4"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">' + p.id[0] + '</text></svg>'; }}
            />
            <p className="text-sm font-medium">{p.id}</p>
          </button>
        ))}
      </div>
      
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => setStep('account-type')}
          className="flex-1"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => {
            // For cTrader, go to terminal step but don't detect (it shows setup instructions)
            // For MT4/MT5, detect terminals then go to terminal step
            if (platform !== 'cTrader') {
              detectTerminals(false);
            }
            setStep('terminal');
          }}
          className="flex-1"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderTerminalStep = () => {
    // For cTrader, show setup instructions instead of terminal detection
    if (platform === 'cTrader') {
      return (
        <div className="space-y-4 py-2">
          <CTraderGuidance />

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep('platform')} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => setStep('credentials')}
              className="flex-1"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    const filteredTerminals = terminals;
    const hasRunningTerminal = filteredTerminals.some(t => t.isRunning);

    return (
      <div className="space-y-4 py-2">
        {/* Loading state */}
        {detectingTerminals && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
            <p className="text-sm font-medium">Scanning for {platform} terminals...</p>
          </div>
        )}

        {/* Deep scanning state */}
        {deepScanning && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <HardDrive className="h-10 w-10 animate-pulse mb-4 text-blue-400" />
            <p className="text-sm font-medium">Deep scanning all drives...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a minute</p>
          </div>
        )}

        {/* Error state */}
        {!detectingTerminals && !deepScanning && terminalError && filteredTerminals.length === 0 && (
          <div className="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
            <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
            <p className="text-sm text-yellow-400 font-medium mb-2">{terminalError}</p>
            <p className="text-xs text-muted-foreground mb-4">
              Make sure {platform} is installed on this computer.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => detectTerminals(false)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              {!lastScanWasDeep && (
                <Button variant="outline" size="sm" onClick={() => detectTerminals(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  Deep Scan
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Terminal list */}
        {!detectingTerminals && !deepScanning && filteredTerminals.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {filteredTerminals.length} terminal{filteredTerminals.length !== 1 ? 's' : ''} found
                {lastScanWasDeep && <span className="ml-1 text-blue-400">(deep scan)</span>}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => detectTerminals(false)}
                  className="h-7 px-2 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                {!lastScanWasDeep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => detectTerminals(true)}
                    className="h-7 px-2 text-xs text-blue-400"
                  >
                    <Search className="h-3 w-3 mr-1" />
                    Deep Scan
                  </Button>
                )}
              </div>
            </div>

            {/* Notice when no terminals running */}
            {!hasRunningTerminal && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Play className="h-4 w-4 shrink-0" />
                <span className="text-xs">Launch a terminal to enable credential validation</span>
              </div>
            )}

            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {filteredTerminals.map((terminal) => {
                const isSelected = selectedTerminal?.id === terminal.id;
                const isLaunching = launching === terminal.id;

                return (
                  <button
                    key={terminal.id}
                    type="button"
                    onClick={() => setSelectedTerminal(terminal)}
                    className={cn(
                      "w-full p-4 rounded-xl border transition-all text-left",
                      "hover:bg-muted/30",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
                        <img 
                          src={PLATFORMS.find(p => p.id.toLowerCase() === terminal.type)?.logo || ''}
                          alt={terminal.type}
                          className="w-6 h-6 object-contain"
                          onError={(e) => { 
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('text-blue-400');
                          }}
                        />
                        <Monitor className="h-5 w-5 hidden" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate max-w-[180px]" title={terminal.installPath}>
                            {terminal.broker || terminal.name}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={terminal.installPath}>
                          {terminal.type.toUpperCase()}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {terminal.isRunning ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                            Running
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchTerminal(terminal);
                            }}
                            disabled={isLaunching}
                            className="h-7 px-2 text-xs"
                          >
                            {isLaunching ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Launch
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Permissions Checklist for MT4/MT5 */}
            {selectedTerminal && (platform === 'MT4' || platform === 'MT5') && (
              <PermissionsChecklist platform={platform.toLowerCase() as 'mt4' | 'mt5'} className="mt-4" />
            )}
          </>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => setStep('platform')} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setStep('credentials')}
            disabled={!selectedTerminal && filteredTerminals.length > 0}
            className="flex-1"
          >
            {filteredTerminals.length === 0 ? 'Skip' : 'Continue'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderCredentialsStep = () => (
    <div className="space-y-4 py-2">
      {/* Show selected terminal */}
      {selectedTerminal && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
            <img 
              src={PLATFORMS.find(p => p.id.toLowerCase() === selectedTerminal.type)?.logo || ''}
              alt={selectedTerminal.type}
              className="w-5 h-5 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate max-w-[250px]">
              {selectedTerminal.broker || selectedTerminal.name}
            </p>
            <p className="text-xs text-muted-foreground">{selectedTerminal.type.toUpperCase()}</p>
          </div>
          {selectedTerminal.isRunning && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs shrink-0">
              Running
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="login">Login ID</Label>
          <Input
            id="login"
            placeholder="12345678"
            value={formData.login}
            onChange={(e) => {
              setFormData({ ...formData, login: e.target.value });
              setValidationResult(null);
              setValidatedAccount(null);
            }}
            className="bg-muted/30 border-border/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => {
              setFormData({ ...formData, password: e.target.value });
              setValidationResult(null);
              setValidatedAccount(null);
            }}
            className="bg-muted/30 border-border/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="server">Server</Label>
          <Input
            id="server"
            placeholder="Broker-Live"
            value={formData.server}
            onChange={(e) => {
              setFormData({ ...formData, server: e.target.value });
              setValidationResult(null);
              setValidatedAccount(null);
            }}
            className="bg-muted/30 border-border/50"
          />
        </div>
      </div>

      {/* Terminal connection status */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg border",
        terminalStatus === 'running' 
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
          : terminalStatus === 'not-running'
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-muted/30 border-border/30 text-muted-foreground"
      )}>
        <Server className="h-4 w-4 shrink-0" />
        <span className="text-sm flex-1">
          {terminalStatus === 'checking' && 'Checking terminal connection...'}
          {terminalStatus === 'running' && `${platform} Agent Connected - Ready to validate`}
          {terminalStatus === 'not-running' && 'Agent not running - Start the terminal and agent to validate credentials'}
        </span>
        {terminalStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      {/* Launch Terminal button - always show if terminal is selected */}
      {selectedTerminal && (
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            if (!isElectron() || !selectedTerminal) return;
            setLaunching(selectedTerminal.id);
            try {
              // Build credentials only if all fields are filled
              const hasAllCredentials = formData.login && formData.password && formData.server;
              const credentials = hasAllCredentials ? {
                login: formData.login,
                password: formData.password,
                server: formData.server,
              } : undefined;
              
              console.log('[AddAccountModal] Launching terminal:', selectedTerminal.executablePath);
              console.log('[AddAccountModal] With credentials:', hasAllCredentials ? 'Yes' : 'No');
              
              const result = await window.electronAPI!.terminals.launch(
                selectedTerminal.executablePath,
                credentials
              );
              
              if (result.success) {
                toast.success('Terminal launched', {
                  description: hasAllCredentials 
                    ? `Logging into ${formData.server}...` 
                    : `Starting ${selectedTerminal.name}...`,
                });
                // Check terminal status after a delay
                setTimeout(() => checkTerminalStatus(), 5000);
              } else {
                console.error('[AddAccountModal] Launch failed:', result.error);
                toast.error('Failed to launch terminal', { description: result.error });
              }
            } catch (err) {
              console.error('[AddAccountModal] Launch error:', err);
              toast.error('Launch error', { description: err instanceof Error ? err.message : 'Unknown error' });
            } finally {
              setLaunching(null);
            }
          }}
          disabled={launching === selectedTerminal.id}
          className="w-full gap-2 bg-blue-600/10 border-blue-500/30 hover:bg-blue-600/20 text-blue-400"
        >
          {launching === selectedTerminal.id ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Launching {platform} Terminal...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {formData.login && formData.password && formData.server 
                ? `Launch & Login to ${selectedTerminal.broker || selectedTerminal.type.toUpperCase()}`
                : `Launch ${selectedTerminal.broker || selectedTerminal.type.toUpperCase()}`
              }
            </>
          )}
        </Button>
      )}

      {/* No terminal selected - show message to go back and select one */}
      {!selectedTerminal && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
          <p className="font-medium mb-1">No terminal selected</p>
          <p className="text-xs text-muted-foreground">
            Go back to the terminal step and select a {platform} terminal to launch it with your credentials.
          </p>
        </div>
      )}

      {/* Validate button - always show but disable if agent not running */}
      <Button
        type="button"
        variant={validationResult === 'valid' ? 'default' : 'outline'}
        onClick={handleValidateCredentials}
        disabled={isValidating || !formData.login || !formData.password || !formData.server || terminalStatus !== 'running'}
        className={cn(
          "w-full",
          validationResult === 'valid' && "bg-emerald-600 hover:bg-emerald-700"
        )}
      >
        {isValidating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging into {platform} terminal...
          </>
        ) : validationResult === 'valid' ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Credentials Verified ✓
          </>
        ) : validationResult === 'invalid' ? (
          <>
            <XCircle className="mr-2 h-4 w-4 text-red-400" />
            Login Failed - Try Again
          </>
        ) : terminalStatus !== 'running' ? (
          <>
            <Server className="mr-2 h-4 w-4" />
            Start Agent to Validate
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Validate & Login to Terminal
          </>
        )}
      </Button>

      {/* Validation result */}
      {validatedAccount && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-sm font-medium text-emerald-400 mb-2">✓ Account Verified</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Name: <span className="text-foreground">{validatedAccount.name}</span></div>
            <div>Broker: <span className="text-foreground">{validatedAccount.broker}</span></div>
            <div>Balance: <span className="text-foreground">{validatedAccount.currency} {validatedAccount.balance.toLocaleString()}</span></div>
            <div>Equity: <span className="text-foreground">{validatedAccount.currency} {validatedAccount.equity.toLocaleString()}</span></div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('terminal')} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => {
            if (accountPhase === 'live') {
              // For hedge accounts, we need the account name
              if (!formData.account_name) {
                setFormData({ ...formData, account_name: `${platform} Hedge Account` });
              }
              handleSubmit();
            } else {
              setStep('prop-details');
            }
          }}
          disabled={!canProceedFromCredentials()}
          className="flex-1"
        >
          {accountPhase === 'live' ? (
            loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Account'
            )
          ) : (
            <>
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderPropDetailsStep = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="account_name">Account Name</Label>
          <Input
            id="account_name"
            placeholder="My FTMO Challenge"
            value={formData.account_name}
            onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
            className="bg-muted/30 border-border/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop_firm">Prop Firm</Label>
          <Select
            value={formData.prop_firm}
            onValueChange={(value) => setFormData({ ...formData, prop_firm: value })}
          >
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Select prop firm">
                {formData.prop_firm && (
                  <div className="flex items-center gap-2">
                    {PROP_FIRMS.find(f => f.name === formData.prop_firm)?.logo && (
                      <img 
                        src={PROP_FIRMS.find(f => f.name === formData.prop_firm)?.logo || ''} 
                        alt="" 
                        className="w-5 h-5 rounded object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span>{formData.prop_firm}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-border/30 max-h-[300px]">
              {PROP_FIRMS.map((firm) => (
                <SelectItem key={firm.name} value={firm.name}>
                  <div className="flex items-center gap-2">
                    {firm.logo && (
                      <img 
                        src={firm.logo} 
                        alt="" 
                        className="w-5 h-5 rounded object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span>{firm.name}</span>
                  </div>
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
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Select account size" />
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-border/30">
              {ACCOUNT_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value.toString()}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border/30">
          <Label htmlFor="show_rules" className="cursor-pointer text-sm">Add Prop Firm Rules</Label>
          <Switch
            id="show_rules"
            checked={showRules}
            onCheckedChange={setShowRules}
          />
        </div>

        {showRules && (
          <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-muted/30 border border-border/30">
            <div className="space-y-2">
              <Label htmlFor="profit_target" className="text-xs">Profit Target (%)</Label>
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
              <Label htmlFor="max_loss" className="text-xs">Max Loss (%)</Label>
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
              <Label htmlFor="max_daily_loss" className="text-xs">Max Daily Loss (%)</Label>
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
              <Label htmlFor="min_trading_days" className="text-xs">Min Trading Days</Label>
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
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('credentials')} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !formData.account_name || !formData.account_size}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Account'
          )}
        </Button>
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] border-border/30 bg-card/95 backdrop-blur-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-semibold">
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        {step === 'account-type' && renderAccountTypeStep()}
        {step === 'platform' && renderPlatformStep()}
        {step === 'terminal' && renderTerminalStep()}
        {step === 'credentials' && renderCredentialsStep()}
        {step === 'prop-details' && renderPropDetailsStep()}
      </DialogContent>
    </Dialog>
  );
};
