import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { LicenseKeySection } from '@/components/dashboard/LicenseKeySection';
import { InstallationManagerModal } from '@/components/dashboard/InstallationManagerModal';
import { useLicenseStatus } from '@/hooks/useLicenseStatus';

const Settings = () => {
  const { license, activate, refresh, remove } = useLicenseStatus();
  const [installModalOpen, setInstallModalOpen] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your application settings</p>
      </div>

      <div className="space-y-6">
        {/* License Management */}
        <LicenseKeySection
          licenseInfo={license}
          onLicenseUpdate={async (key) => {
            const result = await activate(key);
            return { 
              success: result.success, 
              license: license || undefined,
              error: result.error 
            };
          }}
          onRefresh={refresh}
          onRemove={remove}
        />

        {/* EA/cBot Installation */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>EA & cBot Installation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Install the Hedge Edge Expert Advisor (EA), DLL bridge, or cBot to enable automated 
              trade copying and hedge detection on your trading terminals.
            </p>
            <Button onClick={() => setInstallModalOpen(true)}>
              Open Installation Manager
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Trade Copied Alerts</p>
                <p className="text-sm text-muted-foreground">Notify when a trade is successfully copied</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Copy Failure Alerts</p>
                <p className="text-sm text-muted-foreground">Notify when a trade copy fails or is rejected</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Drawdown Warnings</p>
                <p className="text-sm text-muted-foreground">Alert when approaching account drawdown limits</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Connection Status</p>
                <p className="text-sm text-muted-foreground">Alert when a terminal disconnects or reconnects</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">License Expiry Reminder</p>
                <p className="text-sm text-muted-foreground">Get notified before your license expires</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <Badge variant="outline">Beta</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Support</span>
              <span className="text-foreground">support@hedgeedge.com</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">Check for Updates</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">View Changelog</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Installation Manager Modal */}
      <InstallationManagerModal
        open={installModalOpen}
        onOpenChange={setInstallModalOpen}
      />
    </div>
  );
};

export default Settings;
