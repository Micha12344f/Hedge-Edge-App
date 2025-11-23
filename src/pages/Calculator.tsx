import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Copy, Download } from "lucide-react";

interface CalculatorInputs {
  challengeSize: number;
  challengeFee: number;
  challengeType: "1 Phase" | "2 Phase";
  phase1TargetPct: number;
  phase2TargetPct: number;
  maxDrawdownPct: number;
  hedgeType: "Hedging (normal)" | "Over-hedge";
  overHedgeFactor: number;
  spreadPips: number;
  commissionPerRoundLot: number;
  fundingBpsDaily: number;
  execBufferPct: number;
  workingCapitalManual?: number;
}

interface CalculatorResults {
  workingCapitalRequirement: number;
  totalHedgeAmountRequired: number;
  phase1HedgeAmount: number;
  phase1AnticipatedHedgeExposure: number;
  phase2HedgeAmount: number;
  phase2AnticipatedHedgeExposure: number;
  totalAnticipatedHedgeExposure: number;
  projectedTotalCost: number;
  scenarios: {
    failP1: number;
    passP1FailP2: number;
    passBothRequired: number;
  };
}

const presets = {
  FTMO: {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.10,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
  },
  "Alpha Capital Group": {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
  },
  FundingPips: {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
  },
  FundedNext: {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.04,
    maxDrawdownPct: 0.08,
  },
  "E8 Markets": {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.04,
    maxDrawdownPct: 0.08,
  },
  "Funded Trading Plus": {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.10,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
  },
  "The 5%ers": {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
  },
  "Quant Tekel": {
    challengeType: "2 Phase" as const,
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
  },
};

const Calculator = () => {
  const [manualOverride, setManualOverride] = useState(false);
  const [manualL1, setManualL1] = useState<number>(270);
  const [manualL2, setManualL2] = useState<number>(360);

  const [inputs, setInputs] = useState<CalculatorInputs>({
    challengeSize: 50000,
    challengeFee: 300,
    challengeType: "2 Phase",
    phase1TargetPct: 0.08,
    phase2TargetPct: 0.05,
    maxDrawdownPct: 0.10,
    hedgeType: "Hedging (normal)",
    overHedgeFactor: 1.0,
    spreadPips: 1,
    commissionPerRoundLot: 1,
    fundingBpsDaily: 0,
    execBufferPct: 0.15,
  });

  const calculateResults = (): CalculatorResults => {
    const F = inputs.challengeFee;
    const T1 = inputs.phase1TargetPct;
    const T2 = inputs.phase2TargetPct;
    const OH = inputs.overHedgeFactor;
    const Hmult = 10; // Fixed hedge multiplier
    const rho = 1.0; // Fixed correlation

    // Friction calculation
    const spreadCost = inputs.spreadPips * 0.0098;
    const commissionCost = inputs.commissionPerRoundLot * 0.001333;
    const K = (spreadCost + commissionCost) * F;

    // Phase 1
    const phase1HedgeAmount = F * OH;
    const passLossRatio1 = Math.min(T1 * Hmult * rho, 1.0);
    const phase1AnticipatedHedgeExposure = manualOverride 
      ? manualL1 
      : phase1HedgeAmount * passLossRatio1 + K * 0.5;

    // Phase 2
    const L1 = phase1AnticipatedHedgeExposure;
    const phase2HedgeAmount = (F + L1) * OH;
    const passLossRatio2 = Math.min(T2 * Hmult * rho, 1.0);
    const phase2AnticipatedHedgeExposure = manualOverride
      ? manualL2
      : phase2HedgeAmount * passLossRatio2 + K * 0.5;

    const L2 = phase2AnticipatedHedgeExposure;

    // Totals
    const totalHedgeAmountRequired = phase1HedgeAmount + (inputs.challengeType === "2 Phase" ? phase2HedgeAmount : 0);
    const totalAnticipatedHedgeExposure = L1 + (inputs.challengeType === "2 Phase" ? L2 : 0);
    const projectedTotalCost = L1 + (inputs.challengeType === "2 Phase" ? L2 : 0) + F;

    // Working capital
    const H1_capital = F * (1 + inputs.execBufferPct);
    const H2_capital = (F + L1) * (1 + inputs.execBufferPct);
    const workingCapitalRequirement = inputs.workingCapitalManual || (H1_capital + (inputs.challengeType === "2 Phase" ? H2_capital : 0));

    // Scenarios
    const H1_profit = phase1HedgeAmount;
    const H2_profit = phase2HedgeAmount;
    const failP1 = H1_profit - F - K;
    const passP1FailP2 = H2_profit - F - L1 - K;
    const passBothRequired = F + L1 + L2 + K;

    return {
      workingCapitalRequirement,
      totalHedgeAmountRequired,
      phase1HedgeAmount,
      phase1AnticipatedHedgeExposure,
      phase2HedgeAmount,
      phase2AnticipatedHedgeExposure,
      totalAnticipatedHedgeExposure,
      projectedTotalCost,
      scenarios: {
        failP1,
        passP1FailP2,
        passBothRequired,
      },
    };
  };

  const [results, setResults] = useState<CalculatorResults>(calculateResults());

  useEffect(() => {
    setResults(calculateResults());
  }, [inputs, manualOverride, manualL1, manualL2]);

  const handlePresetChange = (preset: keyof typeof presets) => {
    setInputs({ ...inputs, ...presets[preset] });
  };

  const exportJSON = () => {
    const data = { inputs, results };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("Calculator data copied to clipboard as JSON");
  };

  const exportCSV = () => {
    const csv = Object.entries({ ...inputs, ...results })
      .map(([key, value]) => `${key},${value}`)
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hedge-calculator.csv";
    a.click();
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A0A0A] to-[#000000] py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white animate-pulse [text-shadow:0_0_10px_#39FF14,0_0_20px_#39FF14,0_0_30px_#39FF14]">
            Hedge Calculator
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Plan your prop-firm hedge strategy with precision. Calculate working capital, exposure, and scenarios.
          </p>
          
          {/* Presets & Export */}
          <div className="flex flex-wrap justify-center gap-4">
            <Select onValueChange={(v) => handlePresetChange(v as keyof typeof presets)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Load Preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FTMO">FTMO</SelectItem>
                <SelectItem value="Alpha Capital Group">Alpha Capital Group</SelectItem>
                <SelectItem value="FundingPips">FundingPips</SelectItem>
                <SelectItem value="FundedNext">FundedNext</SelectItem>
                <SelectItem value="E8 Markets">E8 Markets</SelectItem>
                <SelectItem value="Funded Trading Plus">Funded Trading Plus</SelectItem>
                <SelectItem value="The 5%ers">The 5%ers</SelectItem>
                <SelectItem value="Quant Tekel">Quant Tekel</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportJSON} variant="outline" size="sm">
              <Copy className="mr-2 h-4 w-4" />
              Copy JSON
            </Button>
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Manual Override Toggle */}
        {manualOverride && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
            <p className="text-primary font-medium">⚠️ Manual overrides active</p>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Inputs Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Inputs</CardTitle>
              <CardDescription>Only edit values highlighted below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Challenge Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Challenge</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="challengeSize" className="flex items-center gap-2">
                    Challenge Size
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>The account size of your prop challenge</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="challengeSize"
                    type="number"
                    value={inputs.challengeSize}
                    onChange={(e) => setInputs({ ...inputs, challengeSize: parseFloat(e.target.value) })}
                    className="bg-blue-950/20 border-blue-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challengeFee">Challenge Fee</Label>
                  <Input
                    id="challengeFee"
                    type="number"
                    value={inputs.challengeFee}
                    onChange={(e) => setInputs({ ...inputs, challengeFee: parseFloat(e.target.value) })}
                    className="bg-blue-950/20 border-blue-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challengeType">Challenge Type</Label>
                  <Select value={inputs.challengeType} onValueChange={(v) => setInputs({ ...inputs, challengeType: v as "1 Phase" | "2 Phase" })}>
                    <SelectTrigger className="bg-blue-950/20 border-blue-500/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 Phase">1 Phase</SelectItem>
                      <SelectItem value="2 Phase">2 Phase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phase1Target">Phase 1 Target %</Label>
                  <Input
                    id="phase1Target"
                    type="number"
                    step="0.01"
                    value={inputs.phase1TargetPct * 100}
                    onChange={(e) => setInputs({ ...inputs, phase1TargetPct: parseFloat(e.target.value) / 100 })}
                    className="bg-blue-950/20 border-blue-500/50"
                  />
                </div>

                {inputs.challengeType === "2 Phase" && (
                  <div className="space-y-2">
                    <Label htmlFor="phase2Target">Phase 2 Target %</Label>
                    <Input
                      id="phase2Target"
                      type="number"
                      step="0.01"
                      value={inputs.phase2TargetPct * 100}
                      onChange={(e) => setInputs({ ...inputs, phase2TargetPct: parseFloat(e.target.value) / 100 })}
                      className="bg-blue-950/20 border-blue-500/50"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="maxDrawdown">Max Drawdown %</Label>
                  <Input
                    id="maxDrawdown"
                    type="number"
                    step="0.01"
                    value={inputs.maxDrawdownPct * 100}
                    onChange={(e) => setInputs({ ...inputs, maxDrawdownPct: parseFloat(e.target.value) / 100 })}
                    className="bg-blue-950/20 border-blue-500/50"
                  />
                </div>
              </div>

              {/* Hedge Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Hedge Settings</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="hedgeType">Hedge Type</Label>
                  <Select value={inputs.hedgeType} onValueChange={(v) => setInputs({ ...inputs, hedgeType: v as any })}>
                    <SelectTrigger className="bg-blue-950/20 border-blue-500/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hedging (normal)">Hedging (normal)</SelectItem>
                      <SelectItem value="Over-hedge">Over-hedge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inputs.hedgeType === "Over-hedge" && (
                  <div className="space-y-2">
                    <Label htmlFor="overHedgeFactor">Over-hedge Factor (1.0-1.5)</Label>
                    <Slider
                      id="overHedgeFactor"
                      min={1.0}
                      max={1.5}
                      step={0.1}
                      value={[inputs.overHedgeFactor]}
                      onValueChange={(v) => setInputs({ ...inputs, overHedgeFactor: v[0] })}
                      className="py-4"
                    />
                    <p className="text-sm text-muted-foreground text-center">{inputs.overHedgeFactor.toFixed(1)}×</p>
                  </div>
                )}
              </div>

              {/* Friction */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Friction (K)</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="spreadPips">Spread (pips)</Label>
                    <Input
                      id="spreadPips"
                      type="number"
                      value={inputs.spreadPips}
                      onChange={(e) => setInputs({ ...inputs, spreadPips: parseFloat(e.target.value) })}
                      className="bg-blue-950/20 border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission/lot</Label>
                    <Input
                      id="commission"
                      type="number"
                      value={inputs.commissionPerRoundLot}
                      onChange={(e) => setInputs({ ...inputs, commissionPerRoundLot: parseFloat(e.target.value) })}
                      className="bg-blue-950/20 border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="execBuffer">Execution Buffer %</Label>
                  <Input
                    id="execBuffer"
                    type="number"
                    step="0.01"
                    value={inputs.execBufferPct * 100}
                    onChange={(e) => setInputs({ ...inputs, execBufferPct: parseFloat(e.target.value) / 100 })}
                    className="bg-blue-950/20 border-blue-500/50"
                  />
                </div>
              </div>

              {/* Manual Override */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="manual-override" className="text-base">Match my spreadsheet numbers</Label>
                  <Switch
                    id="manual-override"
                    checked={manualOverride}
                    onCheckedChange={setManualOverride}
                  />
                </div>
                
                {manualOverride && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manualL1">Phase 1 Exposure</Label>
                      <Input
                        id="manualL1"
                        type="number"
                        value={manualL1}
                        onChange={(e) => setManualL1(parseFloat(e.target.value))}
                        className="bg-yellow-950/20 border-yellow-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manualL2">Phase 2 Exposure</Label>
                      <Input
                        id="manualL2"
                        type="number"
                        value={manualL2}
                        onChange={(e) => setManualL2(parseFloat(e.target.value))}
                        className="bg-yellow-950/20 border-yellow-500/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Results</CardTitle>
              <CardDescription>Live calculations from your inputs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Working Capital */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Working Capital Requirement</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(results.workingCapitalRequirement)}</p>
              </div>

              {/* Phase Details */}
              <div className="space-y-4">

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded bg-muted/30">
                    <span className="text-sm font-medium">Phase 1 Target</span>
                    <span className="text-primary font-semibold">{formatPercent(inputs.phase1TargetPct)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded bg-muted/30">
                    <span className="text-sm">Phase 1 Hedge Amount</span>
                    <span className="font-semibold">{formatCurrency(results.phase1HedgeAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded bg-destructive/10">
                    <span className="text-sm">Phase 1 Anticipated Exposure</span>
                    <span className="font-semibold text-destructive">{formatCurrency(results.phase1AnticipatedHedgeExposure)}</span>
                  </div>
                </div>

                {inputs.challengeType === "2 Phase" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded bg-muted/30">
                      <span className="text-sm font-medium">Phase 2 Target</span>
                      <span className="text-primary font-semibold">{formatPercent(inputs.phase2TargetPct)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded bg-muted/30">
                      <span className="text-sm">Phase 2 Hedge Amount</span>
                      <span className="font-semibold">{formatCurrency(results.phase2HedgeAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded bg-destructive/10">
                      <span className="text-sm">Phase 2 Anticipated Exposure</span>
                      <span className="font-semibold text-destructive">{formatCurrency(results.phase2AnticipatedHedgeExposure)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center p-3 rounded bg-muted/30">
                    <span className="text-sm font-medium">Total Anticipated Hedge Exposure</span>
                    <span className="font-bold">{formatCurrency(results.totalAnticipatedHedgeExposure)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded bg-destructive/20">
                    <span className="text-sm font-medium">Projected Total Cost</span>
                    <span className="font-bold text-destructive">{formatCurrency(results.projectedTotalCost)}</span>
                  </div>
                </div>
              </div>

              {/* Scenarios */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground">Scenarios</h3>
                
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-green-950/30 border border-green-500/30">
                    <p className="text-xs text-muted-foreground mb-1">Fail Phase 1</p>
                    <p className="text-lg font-semibold text-green-400">
                      {formatCurrency(results.scenarios.failP1)} profit
                    </p>
                  </div>

                  {inputs.challengeType === "2 Phase" && (
                    <div className="p-4 rounded-lg bg-yellow-950/30 border border-yellow-500/30">
                      <p className="text-xs text-muted-foreground mb-1">Pass P1 → Fail P2</p>
                      <p className="text-lg font-semibold text-yellow-400">
                        {formatCurrency(results.scenarios.passP1FailP2)} {results.scenarios.passP1FailP2 >= 0 ? 'profit' : 'loss'}
                      </p>
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-red-950/30 border border-red-500/30">
                    <p className="text-xs text-muted-foreground mb-1">Pass Both (Funded)</p>
                    <p className="text-sm font-medium text-red-400">
                      Required payout ≥ {formatCurrency(results.scenarios.passBothRequired)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {inputs.hedgeType === "Over-hedge" && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                    Over-hedge ON ×{inputs.overHedgeFactor.toFixed(1)}
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {inputs.challengeType}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
