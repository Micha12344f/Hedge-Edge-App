import { useState } from "react";
import { 
  Plus, 
  Play, 
  RefreshCw, 
  TrendingUp,
  FileText,
  Bug,
  AlertCircle,
  ExternalLink,
  X,
  ArrowLeft,
  Info,
  Layers,
  DollarSign,
  LineChart,
  Target,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PropAccount {
  id: string;
  firmName: string;
  accountSize: number;
  phase: "evaluation" | "funded";
  accountType: "live" | "demo";
  status: "active" | "passed" | "failed";
  profit: number;
  drawdown: number;
  createdAt: Date;
}

type PhaseType = "evaluation" | "funded";
type AccountTypeSelection = "live" | "demo";

export default function Overview() {
  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [activePhase, setActivePhase] = useState<PhaseType>("evaluation");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [selectedPhase, setSelectedPhase] = useState<PhaseType>("evaluation");
  const [selectedAccountType, setSelectedAccountType] = useState<AccountTypeSelection>("live");
  const [selectedCategory, setSelectedCategory] = useState<'prop' | 'brokerage' | 'practice' | null>(null);
  const [showPropFirmRules, setShowPropFirmRules] = useState(false);
  const [newAccount, setNewAccount] = useState({
    firmName: "",
    accountSize: "",
    accountName: "",
    loginApiKey: "",
    masterPassword: "",
    platform: "",
    server: "",
    tradingDays: 0,
    profitTarget: 0,
    maxLoss: 0,
    maxDailyLoss: 0,
  });

  const evaluationAccounts = accounts.filter((a) => a.phase === "evaluation");
  const fundedAccounts = accounts.filter((a) => a.phase === "funded");

  const handleOpenModal = () => {
    setModalStep(1);
    setSelectedPhase("evaluation");
    setSelectedAccountType("live");
    setSelectedCategory(null);
    setShowPropFirmRules(false);
    setNewAccount({ 
      firmName: "", 
      accountSize: "",
      accountName: "",
      loginApiKey: "",
      masterPassword: "",
      platform: "",
      server: "",
      tradingDays: 0,
      profitTarget: 0,
      maxLoss: 0,
      maxDailyLoss: 0,
    });
    setDialogOpen(true);
  };

  const handleContinueToStep2 = () => {
    if (!selectedCategory) return;
    setModalStep(2);
  };

  const handleBackToStep1 = () => {
    setModalStep(1);
  };

  const handleSelectAccount = (category: 'prop' | 'brokerage' | 'practice', type: 'evaluation' | 'funded' | 'live' | 'demo') => {
    setSelectedCategory(category);
    if (category === 'prop') {
      setSelectedPhase(type as PhaseType);
    } else {
      setSelectedAccountType(type as AccountTypeSelection);
    }
  };

  const incrementValue = (field: 'tradingDays' | 'profitTarget' | 'maxLoss' | 'maxDailyLoss') => {
    setNewAccount(prev => ({ ...prev, [field]: prev[field] + 1 }));
  };

  const decrementValue = (field: 'tradingDays' | 'profitTarget' | 'maxLoss' | 'maxDailyLoss') => {
    setNewAccount(prev => ({ ...prev, [field]: Math.max(0, prev[field] - 1) }));
  };

  const handleAddAccount = () => {
    if (!newAccount.firmName || !newAccount.accountSize) return;

    const account: PropAccount = {
      id: crypto.randomUUID(),
      firmName: newAccount.firmName,
      accountSize: parseFloat(newAccount.accountSize),
      phase: selectedPhase,
      accountType: selectedAccountType,
      status: "active",
      profit: 0,
      drawdown: 0,
      createdAt: new Date(),
    };

    setAccounts([...accounts, account]);
    setDialogOpen(false);
    setActivePhase(selectedPhase);
  };

  const EmptyState = ({ type }: { type: PhaseType }) => (
    <div className="flex-1 flex flex-col items-center justify-center py-20 min-h-[60vh]">
      {/* Decorative circles container */}
      <div className="relative mb-8">
        {/* Outer decorative circles */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full border border-primary/10"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full border border-primary/10"></div>
        <div className="absolute -top-6 -right-10 w-20 h-20 rounded-full border border-primary/15"></div>
        <div className="absolute -bottom-6 -left-10 w-20 h-20 rounded-full border border-primary/15"></div>
        <div className="absolute top-4 -left-16 w-12 h-12 rounded-full border border-primary/10"></div>
        <div className="absolute bottom-4 -right-16 w-12 h-12 rounded-full border border-primary/10"></div>
        
        {/* Main icon circle */}
        <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 via-secondary/10 to-primary/5 flex items-center justify-center border-2 border-primary/30 shadow-lg shadow-primary/10">
          <TrendingUp className="w-10 h-10 text-primary" />
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-foreground mb-3">
        No {type === "evaluation" ? "Evaluation" : "Funded"} Account
      </h3>
      <p className="text-muted-foreground text-center max-w-[350px] mb-8 text-sm leading-relaxed">
        You don't have any {type} accounts yet. Please add a new account in order to start trading.
      </p>
      
      <Button 
        onClick={handleOpenModal}
        className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold px-6"
      >
        <Plus className="w-4 h-4 mr-2" />
        New Account
      </Button>
    </div>
  );

  const AccountCard = ({ account }: { account: PropAccount }) => (
    <div className="bg-card border border-primary/20 rounded-xl p-5 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{account.firmName}</h4>
            <p className="text-xs text-muted-foreground capitalize">{account.accountType} Account</p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            account.status === "active"
              ? "bg-primary/20 text-primary"
              : account.status === "passed"
              ? "bg-green-500/20 text-green-500"
              : "bg-destructive/20 text-destructive"
          }`}
        >
          {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs mb-1">Account Size</p>
          <p className="font-semibold">${account.accountSize.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Profit/Loss</p>
          <p className={`font-semibold ${account.profit >= 0 ? "text-primary" : "text-destructive"}`}>
            {account.profit >= 0 ? "+" : ""}${account.profit.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Drawdown</p>
          <p className="font-semibold text-destructive">{account.drawdown}%</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sub Navigation Bar */}
      <div className="border-b border-primary/20 bg-background/95 backdrop-blur-sm sticky top-[73px] z-30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-end h-14">
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-primary/20 text-sm">
                <Play className="w-4 h-4 mr-2" />
                Tutorials
              </Button>
              <Button variant="outline" size="sm" className="border-secondary/40 text-secondary text-sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync All Trades
              </Button>
              <Button variant="outline" size="sm" className="border-primary/40 text-primary text-sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync All Accounts
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Page Header with Tabs */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
          <h1 className="text-2xl font-bold text-foreground">Prop Firm Accounts</h1>
          <div className="hidden md:block h-8 w-px bg-primary/20"></div>
          
          {/* Phase Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActivePhase("evaluation")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                activePhase === "evaluation"
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-transparent text-muted-foreground border-primary/20 hover:border-primary/30 hover:text-foreground"
              }`}
            >
              Evaluation phase
              <span className={`ml-2 ${activePhase === "evaluation" ? "text-primary" : "text-muted-foreground"}`}>
                {evaluationAccounts.length}
              </span>
            </button>
            <button
              onClick={() => setActivePhase("funded")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                activePhase === "funded"
                  ? "bg-secondary/10 text-secondary border-secondary/40"
                  : "bg-transparent text-muted-foreground border-secondary/20 hover:border-secondary/30 hover:text-foreground"
              }`}
            >
              Funded phase
              <span className={`ml-2 ${activePhase === "funded" ? "text-secondary" : "text-muted-foreground"}`}>
                {fundedAccounts.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[60vh]">
          {activePhase === "evaluation" ? (
            evaluationAccounts.length === 0 ? (
              <EmptyState type="evaluation" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {evaluationAccounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
                {/* Add New Account Card */}
                <button
                  onClick={handleOpenModal}
                  className="border-2 border-dashed border-primary/30 rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all min-h-[160px]"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-primary">Add New Account</span>
                </button>
              </div>
            )
          ) : (
            fundedAccounts.length === 0 ? (
              <EmptyState type="funded" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fundedAccounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
                {/* Add New Account Card */}
                <button
                  onClick={handleOpenModal}
                  className="border-2 border-dashed border-secondary/30 rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-secondary/50 hover:bg-secondary/5 transition-all min-h-[160px]"
                >
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-secondary" />
                  </div>
                  <span className="text-sm font-medium text-secondary">Add New Account</span>
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Footer Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-primary/20 bg-background/95 backdrop-blur-sm z-30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-12 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Healthy
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground transition-colors flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Docs
              </a>
              <a href="#" className="hover:text-foreground transition-colors flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Changelog
              </a>
              <button className="hover:text-foreground transition-colors flex items-center gap-1">
                <Bug className="w-3 h-3" />
                Report Bug
              </button>
              <button className="hover:text-foreground transition-colors flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Logs & Errors
              </button>
              <span>|</span>
              <a href="/legal/terms" className="hover:text-foreground transition-colors">Terms</a>
              <a href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-primary/20 sm:max-w-md">
          <button
            onClick={() => setDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add Account</DialogTitle>
          </DialogHeader>

          {modalStep === 1 ? (
            <div className="py-4 space-y-6">
              {/* Prop Firm Account */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Label className="text-sm font-medium">Prop Firm Account</Label>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => handleSelectAccount('prop', 'evaluation')}
                    className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                      selectedCategory === 'prop' && selectedPhase === 'evaluation'
                        ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,255,110,0.3)]"
                        : "border-border bg-background/50 hover:border-primary/40"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="font-medium">Evaluation</span>
                  </button>
                  <button
                    onClick={() => handleSelectAccount('prop', 'funded')}
                    className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                      selectedCategory === 'prop' && selectedPhase === 'funded'
                        ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,255,110,0.3)]"
                        : "border-border bg-background/50 hover:border-primary/40"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="font-medium">Funded</span>
                  </button>
                </div>
              </div>

              {/* Brokerage Account */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Label className="text-sm font-medium">Brokerage Account</Label>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                <button
                  onClick={() => handleSelectAccount('brokerage', 'live')}
                  className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    selectedCategory === 'brokerage'
                      ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,255,110,0.3)]"
                      : "border-border bg-background/50 hover:border-primary/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <LineChart className="w-5 h-5 text-red-400" />
                  </div>
                  <span className="font-medium">Live</span>
                </button>
              </div>

              {/* Practice Account */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Label className="text-sm font-medium">Practice Account</Label>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                <button
                  onClick={() => handleSelectAccount('practice', 'demo')}
                  className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    selectedCategory === 'practice'
                      ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,255,110,0.3)]"
                      : "border-border bg-background/50 hover:border-primary/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="font-medium">Demo</span>
                </button>
              </div>

              <DialogFooter className="mt-6">
                <Button 
                  onClick={handleContinueToStep2} 
                  disabled={!selectedCategory}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {/* Account Details Form */}
              <div className="space-y-2">
                <Label htmlFor="accountName" className="text-sm font-medium">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="Account Name"
                  value={newAccount.accountName}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, accountName: e.target.value })
                  }
                  className="bg-background border-border h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginApiKey" className="text-sm font-medium">Login / API Key</Label>
                <Input
                  id="loginApiKey"
                  placeholder="Login / API Key"
                  value={newAccount.loginApiKey}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, loginApiKey: e.target.value })
                  }
                  className="bg-background border-border h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="masterPassword" className="text-sm font-medium">Master Password</Label>
                <Input
                  id="masterPassword"
                  type="password"
                  placeholder="Master Password"
                  value={newAccount.masterPassword}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, masterPassword: e.target.value })
                  }
                  className="bg-background border-border h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform" className="text-sm font-medium">Platform</Label>
                <select
                  id="platform"
                  value={newAccount.platform}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, platform: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-md border border-border bg-background text-sm"
                >
                  <option value="">Select Platform</option>
                  <option value="mt4">MetaTrader 4</option>
                  <option value="mt5">MetaTrader 5</option>
                  <option value="ctrader">cTrader</option>
                  <option value="tradelocker">TradeLocker</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="server" className="text-sm font-medium">Server</Label>
                <select
                  id="server"
                  value={newAccount.server}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, server: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-md border border-border bg-background text-sm"
                >
                  <option value="">Select Server</option>
                  <option value="live">Live Server</option>
                  <option value="demo">Demo Server</option>
                </select>
              </div>

              {/* Add Prop Firm Rules Checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="propFirmRules"
                  checked={showPropFirmRules}
                  onChange={(e) => setShowPropFirmRules(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                />
                <Label htmlFor="propFirmRules" className="text-sm font-medium cursor-pointer">
                  Add Prop Firm Rules
                </Label>
              </div>

              {/* Collapsible Prop Firm Rules */}
              {showPropFirmRules && (
                <div className="space-y-3 pt-2 border-t border-border">
                  {/* Trading Days */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Trading Days</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => decrementValue('tradingDays')}
                        className="h-8 w-8 border-border"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{newAccount.tradingDays}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => incrementValue('tradingDays')}
                        className="h-8 w-8 border-border"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Profit Target */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Profit Target (%)</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => decrementValue('profitTarget')}
                        className="h-8 w-8 border-border"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{newAccount.profitTarget}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => incrementValue('profitTarget')}
                        className="h-8 w-8 border-border"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Max Loss */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Max Loss (%)</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => decrementValue('maxLoss')}
                        className="h-8 w-8 border-border"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{newAccount.maxLoss}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => incrementValue('maxLoss')}
                        className="h-8 w-8 border-border"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Max Daily Loss */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Max Daily Loss (%)</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => decrementValue('maxDailyLoss')}
                        className="h-8 w-8 border-border"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{newAccount.maxDailyLoss}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => incrementValue('maxDailyLoss')}
                        className="h-8 w-8 border-border"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="flex gap-2 mt-6">
                <Button 
                  variant="ghost" 
                  onClick={handleBackToStep1}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={handleAddAccount} 
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"
                  disabled={!newAccount.accountName}
                >
                  Add Account
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
