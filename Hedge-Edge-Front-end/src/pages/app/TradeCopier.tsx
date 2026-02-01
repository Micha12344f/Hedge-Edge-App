import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageBackground } from '@/components/ui/page-background';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Ultra-Low Latency',
    description: 'Trades copied in under 50ms via local IPC connection',
  },
  {
    icon: Shield,
    title: 'Risk Management',
    description: 'Set custom lot multipliers and max position limits per follower',
  },
  {
    icon: ArrowRightLeft,
    title: 'Inverse Copying',
    description: 'Copy trades in reverse for hedging strategies across accounts',
  },
  {
    icon: Settings,
    title: 'Symbol Mapping',
    description: 'Map symbols between different brokers automatically',
  },
];

const setupSteps = [
  {
    step: 1,
    title: 'Install EA/cBot',
    description: 'Install the Hedge Edge component on your trading terminals',
    icon: Copy,
  },
  {
    step: 2,
    title: 'Select Master Account',
    description: 'Choose which account will be the source of trades',
    icon: TrendingUp,
  },
  {
    step: 3,
    title: 'Add Follower Accounts',
    description: 'Select accounts to receive copied trades',
    icon: Plus,
  },
  {
    step: 4,
    title: 'Configure Risk Settings',
    description: 'Set lot multipliers and risk limits for each follower',
    icon: Shield,
  },
];

const TradeCopier = () => {
  const [activeCopiers] = useState(0);

  return (
    <PageBackground>
      <div className="p-6 pt-16 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Trade Copier
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </h1>
            <p className="text-muted-foreground">Copy trades across multiple accounts automatically</p>
          </div>
          <TooltipProvider>
            <div className="flex gap-2">
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
              <Button disabled={activeCopiers === 0}>
                <Plus className="mr-2 h-4 w-4" />
                New Copier
              </Button>
            </div>
          </TooltipProvider>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <TooltipProvider>
            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Copiers</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Copy className="h-4 w-4 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of active copy relationships</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground mt-1">No copiers configured</p>
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
                    <p>Total trades copied today</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground mt-1">Today</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Latency</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average time to copy a trade</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">-</p>
                <p className="text-xs text-muted-foreground mt-1">No data yet</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Risk Protection</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Shield className="h-4 w-4 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Risk management status</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">Active</p>
                <p className="text-xs text-muted-foreground mt-1">All limits enforced</p>
              </CardContent>
            </Card>
          </TooltipProvider>
        </div>

        {/* Empty State with Setup Guide */}
        <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 overflow-hidden">
          <CardHeader className="border-b border-border/30">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Get Started with Trade Copying
            </CardTitle>
            <CardDescription>
              Follow these steps to set up your first trade copier
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Requires EA/cBot installation on trading terminals
              </div>
              <Button size="lg" className="group">
                <Settings className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform" />
                Open Installation Manager
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageBackground>
  );
};

export default TradeCopier;
