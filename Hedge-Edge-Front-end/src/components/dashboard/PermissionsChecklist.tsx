import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  Cpu,
  Globe,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import type { PermissionCheckItem } from '@/types/connections';

// ============================================================================
// Types
// ============================================================================

interface PermissionsChecklistProps {
  /** Platform type */
  platform: 'mt4' | 'mt5' | 'ctrader';
  /** Compact mode for inline display */
  compact?: boolean;
  /** Show even when all permissions are granted */
  showWhenComplete?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Permission Definitions
// ============================================================================

const MT4_MT5_PERMISSIONS: PermissionCheckItem[] = [
  {
    id: 'algo-trading',
    label: 'Enable Algorithmic Trading',
    description: 'Allows Expert Advisors to open and manage trades automatically',
    required: true,
    status: null,
    instructions: [
      'Open your MT4/MT5 terminal',
      'Go to Tools → Options → Expert Advisors',
      'Check "Allow automated trading"',
      'Check "Allow DLL imports" (see below)',
      'Click OK to save',
    ],
  },
  {
    id: 'dll-imports',
    label: 'Enable DLL Imports',
    description: 'Required for the Hedge Edge Bridge DLL to communicate with the app',
    required: true,
    status: null,
    instructions: [
      'In Expert Advisors settings, check "Allow DLL imports"',
      'When attaching EA to chart, ensure "Allow DLL imports" is checked',
      'You may see a security warning - click "Yes" to allow',
    ],
  },
  {
    id: 'webrequest',
    label: 'WebRequest Allowlist',
    description: 'Required for the EA to validate your license with Hedge Edge servers',
    required: true,
    status: null,
    instructions: [
      'Go to Tools → Options → Expert Advisors',
      'Check "Allow WebRequest for listed URL"',
      'Add the following URL to the list:',
      'https://api.hedge-edge.com',
      'Click OK to save',
      'Restart the terminal for changes to take effect',
    ],
  },
];

const CTRADER_PERMISSIONS: PermissionCheckItem[] = [
  {
    id: 'cbot-permissions',
    label: 'Allow cBot Execution',
    description: 'Enable automated trading for cBots in cTrader',
    required: true,
    status: null,
    instructions: [
      'Open cTrader Desktop',
      'Go to Settings → Automate',
      'Ensure "Allow automated trading" is enabled',
      'Enable "Allow cBots to trade" option',
    ],
  },
  {
    id: 'backtesting-data',
    label: 'Download Historical Data (Optional)',
    description: 'Required for backtesting the Hedge Edge cBot',
    required: false,
    status: null,
    instructions: [
      'In cTrader, right-click on a chart',
      'Select "Download History"',
      'Select date range and timeframes needed',
      'Click Download',
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export function PermissionsChecklist({
  platform,
  compact = false,
  showWhenComplete = true,
  className,
}: PermissionsChecklistProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedUrl, setCopiedUrl] = useState(false);

  const permissions = platform === 'ctrader' ? CTRADER_PERMISSIONS : MT4_MT5_PERMISSIONS;
  const isMetaTrader = platform === 'mt4' || platform === 'mt5';
  const platformName = platform === 'mt4' ? 'MetaTrader 4' : 
                       platform === 'mt5' ? 'MetaTrader 5' : 'cTrader';

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyApiUrl = async () => {
    await navigator.clipboard.writeText('https://api.hedge-edge.com');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4 text-primary" />
          <span>Required Permissions</span>
        </div>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {permissions.filter(p => p.required).map((perm) => (
            <li key={perm.id} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {perm.label}
            </li>
          ))}
        </ul>
        {isMetaTrader && (
          <p className="text-xs text-muted-foreground">
            Restart terminal after enabling these settings
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-medium">{platformName} Permissions</h3>
      </div>

      {/* Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {isMetaTrader 
            ? 'These settings must be enabled in your terminal for Hedge Edge to work properly. Restart your terminal after making changes.'
            : 'Ensure these settings are configured in cTrader before using the Hedge Edge cBot.'}
        </AlertDescription>
      </Alert>

      {/* Permission Items */}
      <div className="space-y-2">
        {permissions.map((perm) => (
          <Collapsible
            key={perm.id}
            open={expandedItems.has(perm.id)}
            onOpenChange={() => toggleExpanded(perm.id)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-colors text-left">
                <div className="flex-shrink-0">
                  {perm.id === 'algo-trading' ? (
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                  ) : perm.id === 'dll-imports' ? (
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  ) : perm.id === 'webrequest' ? (
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{perm.label}</span>
                    {perm.required ? (
                      <Badge variant="secondary" className="text-[10px]">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Optional</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {perm.description}
                  </p>
                </div>
                {expandedItems.has(perm.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 ml-8 p-3 rounded-lg bg-muted/20 border border-border/30">
                <h4 className="text-sm font-medium mb-2">How to Enable:</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                  {perm.instructions.map((instruction, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {instruction.startsWith('https://') ? (
                        <span className="inline-flex items-center gap-2">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                            {instruction}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={(e) => { e.stopPropagation(); copyApiUrl(); }}
                          >
                            {copiedUrl ? (
                              <Check className="h-3 w-3 text-primary" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </span>
                      ) : (
                        instruction
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Restart Notice */}
      {isMetaTrader && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <RefreshCw className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Remember to restart your terminal after changing these settings
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// cTrader Guidance Component
// ============================================================================

interface CTraderGuidanceProps {
  className?: string;
}

export function CTraderGuidance({ className }: CTraderGuidanceProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-medium">cTrader Setup Guide</h3>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          cTrader uses a different architecture than MetaTrader. Follow these steps to set up the Hedge Edge cBot.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {/* Step 1: Install cBot */}
        <div className="p-4 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30">Step 1</Badge>
            <span className="font-medium text-sm">Install the cBot</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Download the Hedge Edge cBot (.algo file)</li>
            <li>Double-click to install, or drag into cTrader</li>
            <li>The cBot will appear in the Automate section</li>
          </ol>
        </div>

        {/* Step 2: Configure */}
        <div className="p-4 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30">Step 2</Badge>
            <span className="font-medium text-sm">Configure the cBot</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Open the Automate panel in cTrader</li>
            <li>Find &quot;Hedge Edge&quot; in your cBots list</li>
            <li>Right-click and select &quot;Add Instance&quot;</li>
            <li>Select the symbol/chart to run on</li>
          </ol>
        </div>

        {/* Step 3: License Key */}
        <div className="p-4 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30">Step 3</Badge>
            <span className="font-medium text-sm">Enter License Key</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>In the cBot parameters, find &quot;License Key&quot;</li>
            <li>Enter your Hedge Edge license key</li>
            <li>Configure other parameters as needed</li>
            <li>Click &quot;Start&quot; to begin</li>
          </ol>
        </div>

        {/* Note about DLL */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Good news:</strong> cTrader cBots don&apos;t require DLL imports. 
            All communication happens through the cBot&apos;s built-in networking capabilities.
          </p>
        </div>
      </div>
    </div>
  );
}
