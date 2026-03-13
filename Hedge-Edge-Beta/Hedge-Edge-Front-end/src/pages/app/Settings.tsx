import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { LicenseKeySection } from '@/components/dashboard/LicenseKeySection';
import { InstallationManagerModal } from '@/components/dashboard/InstallationManagerModal';
import { useLicenseStatus } from '@/hooks/useLicenseStatus';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error';

const Settings = () => {
  const { license, activate, refresh, remove } = useLicenseStatus();
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('Beta');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string>('');

  useEffect(() => {
    const updater = window.electronAPI?.updater;
    if (!updater) return;

    updater.getVersion().then(setAppVersion).catch(() => {});

    updater.onUpdateAvailable((info) => {
      setUpdateStatus('available');
      setUpdateVersion(info.version);
    });
    updater.onDownloadProgress((progress) => {
      setUpdateStatus('downloading');
      setDownloadProgress(Math.round(progress.percent));
    });
    updater.onUpdateDownloaded(() => {
      setUpdateStatus('ready');
    });
  }, []);

  const handleCheckForUpdates = async () => {
    const updater = window.electronAPI?.updater;
    if (!updater) return;
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const result = await updater.checkForUpdate();
      if (!result.updateAvailable) {
        setUpdateStatus('up-to-date');
        setTimeout(() => setUpdateStatus('idle'), 5000);
      }
    } catch {
      setUpdateStatus('error');
      setUpdateError('Failed to check for updates');
    }
  };

  const handleDownloadUpdate = async () => {
    const updater = window.electronAPI?.updater;
    if (!updater) return;
    setUpdateStatus('downloading');
    setDownloadProgress(0);
    try {
      await updater.downloadUpdate();
    } catch {
      setUpdateStatus('error');
      setUpdateError('Download failed');
    }
  };

  const handleInstallUpdate = () => {
    window.electronAPI?.updater?.installUpdate();
  };

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
              <Badge variant="outline">v{appVersion}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Support</span>
              <span className="text-foreground">support@hedgeedge.com</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              {updateStatus === 'idle' || updateStatus === 'error' ? (
                <Button variant="outline" size="sm" onClick={handleCheckForUpdates}>
                  Check for Updates
                </Button>
              ) : updateStatus === 'checking' ? (
                <Button variant="outline" size="sm" disabled>
                  Checking...
                </Button>
              ) : updateStatus === 'up-to-date' ? (
                <Button variant="outline" size="sm" disabled>
                  You're up to date!
                </Button>
              ) : updateStatus === 'available' ? (
                <Button variant="default" size="sm" onClick={handleDownloadUpdate}>
                  Download v{updateVersion}
                </Button>
              ) : updateStatus === 'downloading' ? (
                <Button variant="outline" size="sm" disabled>
                  Downloading... {downloadProgress}%
                </Button>
              ) : updateStatus === 'ready' ? (
                <Button variant="default" size="sm" onClick={handleInstallUpdate} className="bg-green-600 hover:bg-green-700">
                  Restart & Install v{updateVersion}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="text-muted-foreground">View Changelog</Button>
            </div>
            {updateError && (
              <p className="text-xs text-red-400">{updateError}</p>
            )}
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
