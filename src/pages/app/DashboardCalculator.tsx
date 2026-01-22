import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Calculator, Target, AlertTriangle, DollarSign } from 'lucide-react';

const DashboardCalculator = () => {
  const [accountSize, setAccountSize] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [stopLossPips, setStopLossPips] = useState(20);
  const [pipValue, setPipValue] = useState(10);

  const riskAmount = (accountSize * riskPercent) / 100;
  const positionSize = stopLossPips > 0 ? riskAmount / (stopLossPips * pipValue) : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Position Calculator</h1>
        <p className="text-muted-foreground">Calculate optimal position sizes based on your risk parameters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Risk Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account_size">Account Size ($)</Label>
              <NumberInput
                id="account_size"
                value={accountSize}
                onChange={setAccountSize}
                min={0}
                step={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk_percent">Risk Per Trade (%)</Label>
              <NumberInput
                id="risk_percent"
                value={riskPercent}
                onChange={setRiskPercent}
                min={0}
                max={100}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop_loss">Stop Loss (Pips)</Label>
              <NumberInput
                id="stop_loss"
                value={stopLossPips}
                onChange={setStopLossPips}
                min={0}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pip_value">Pip Value ($)</Label>
              <NumberInput
                id="pip_value"
                value={pipValue}
                onChange={setPipValue}
                min={0}
                step={0.01}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Risk Amount</CardTitle>
              <AlertTriangle className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-secondary">{formatCurrency(riskAmount)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {riskPercent}% of {formatCurrency(accountSize)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Position Size</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{positionSize.toFixed(2)} Lots</p>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {stopLossPips} pip stop loss
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Potential Loss</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">{formatCurrency(riskAmount)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                If stop loss is hit
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardCalculator;
