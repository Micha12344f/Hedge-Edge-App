import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Zap, Shield, ArrowRightLeft } from 'lucide-react';

const TradeCopier = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trade Copier</h1>
        <p className="text-muted-foreground">Copy trades across multiple accounts automatically</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Copiers</CardTitle>
            <Copy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">0</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trades Copied</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">0</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Latency</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">-</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk Protection</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">Active</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Copy className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Trade Copier Coming Soon</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Our advanced trade copier will allow you to copy trades from a master account to multiple follower accounts with risk-adjusted sizing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradeCopier;
