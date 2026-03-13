/**
 * Onboarding Wizard — First-launch setup flow
 *
 * Steps:
 *  1. Enter License Key (if not already activated)
 *  2. Connect Trading Platform (detect & install EA/DLLs)
 *  3. Verify Connection (show live heartbeat)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { GradientText } from '@/components/ui/gradient-text';
import { isElectron } from '@/lib/desktop';
import { markOnboardingComplete } from '@/lib/onboarding';
import {
  KeyRound,
  Monitor,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  TrendingUp,
  Download,
  Wifi,
  Rocket,
} from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

interface DetectedTerminal {
  id: string;
  type: string;
  name: string;
  executablePath: string;
  installPath: string;
  broker?: string;
  isRunning?: boolean;
}

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseValid, setLicenseValid] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');

  const [terminals, setTerminals] = useState<DetectedTerminal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installDone, setInstallDone] = useState(false);

  const [heartbeat, setHeartbeat] = useState(false);
  const [checkingHeartbeat, setCheckingHeartbeat] = useState(false);

  // On mount, check if license is already valid to skip step 1
  useEffect(() => {
    (async () => {
      if (!isElectron()) return;
      try {
        const result = await window.electronAPI?.license?.getStatus();
        if (result?.success && result.data?.status === 'valid') {
          setLicenseValid(true);
          setStep(2);
        }
      } catch {
        // proceed with step 1
      }
    })();
  }, []);

  // ---- Step 1: License Key ------------------------------------------------
  const handleActivateLicense = useCallback(async () => {
    const cleanKey = licenseKey.trim().toUpperCase();
    if (!cleanKey) {
      setActivateError('Please enter a license key');
      return;
    }

    setActivating(true);
    setActivateError('');

    try {
      const result = await window.electronAPI?.license?.activate(cleanKey);
      if (result?.success && result.license?.status === 'valid') {
        setLicenseValid(true);
        setStep(2);
      } else {
        setActivateError(result?.error || result?.license?.errorMessage || 'Activation failed');
      }
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivating(false);
    }
  }, [licenseKey]);

  // ---- Step 2: Detect & Install -------------------------------------------
  const scanTerminals = useCallback(async () => {
    if (!isElectron()) return;
    setScanning(true);
    try {
      const result = await window.electronAPI?.terminals?.detect();
      if (result?.success) {
        setTerminals(result.terminals || []);
      }
    } catch {
      // non-fatal
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2) scanTerminals();
  }, [step, scanTerminals]);

  const handleInstall = useCallback(async () => {
    if (!isElectron()) return;
    setInstalling(true);
    try {
      // Install EA + DLLs for each detected terminal via the installer API
      for (const t of terminals) {
        await window.electronAPI?.installer?.installAsset(t.id, `${t.type}-ea`);
        await window.electronAPI?.installer?.installAsset(t.id, `${t.type}-dll`);
      }
      setInstallDone(true);
    } catch {
      // non-fatal
    } finally {
      setInstalling(false);
    }
  }, [terminals]);

  // ---- Step 3: Verify Connection ------------------------------------------
  const checkHeartbeat = useCallback(async () => {
    if (!isElectron()) return;
    setCheckingHeartbeat(true);
    try {
      const result = await window.electronAPI?.connections?.list();
      if (result && typeof result === 'object') {
        const connected = Object.values(result).some(
          (snap) => snap?.session?.status === 'connected'
        );
        setHeartbeat(connected);
      }
    } catch {
      // keep checking
    } finally {
      setCheckingHeartbeat(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3) {
      checkHeartbeat();
      const id = setInterval(checkHeartbeat, 5000);
      return () => clearInterval(id);
    }
  }, [step, checkHeartbeat]);

  const finish = () => {
    markOnboardingComplete();
    navigate('/app/overview', { replace: true });
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(224,18%,4%)] via-[hsl(224,15%,2%)] to-[hsl(224,25%,1%)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
          </div>
          <GradientText
            colors={['hsl(120, 100%, 54%)', 'hsl(45, 100%, 56%)', 'hsl(120, 100%, 54%)']}
            animationSpeed={5}
            className="text-2xl font-bold tracking-tight"
          >
            Welcome to HedgeEdge
          </GradientText>
          <p className="text-sm text-muted-foreground">
            Let's get you set up in a few quick steps
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  s < step
                    ? 'bg-primary text-primary-foreground'
                    : s === step
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-px ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardContent className="pt-6 space-y-5">
            {/* ────────── Step 1: License Key ────────── */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <KeyRound className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Activate Your License</h3>
                    <p className="text-xs text-muted-foreground">Paste the key from your purchase confirmation email</p>
                  </div>
                </div>

                <Input
                  type="text"
                  placeholder="XXXX - XXXX - XXXX - XXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  className="font-mono text-center text-base tracking-[0.2em] h-12"
                  disabled={activating}
                />

                {activateError && (
                  <p className="text-sm text-destructive">{activateError}</p>
                )}

                <Button
                  onClick={handleActivateLicense}
                  disabled={activating || !licenseKey.trim()}
                  className="w-full"
                >
                  {activating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validating…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Activate License</>
                  )}
                </Button>
              </>
            )}

            {/* ────────── Step 2: Connect Platform ────────── */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Monitor className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Connect Trading Platform</h3>
                    <p className="text-xs text-muted-foreground">We'll detect your installed terminals and install the EA &amp; DLLs</p>
                  </div>
                </div>

                {/* Detected terminals */}
                {scanning ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Scanning for terminals…</span>
                  </div>
                ) : terminals.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-muted-foreground">No terminals detected.</p>
                    <p className="text-xs text-muted-foreground">Make sure MT5 or cTrader is installed and run a scan.</p>
                    <Button variant="outline" size="sm" onClick={scanTerminals}>
                      <Monitor className="w-4 h-4 mr-1" /> Scan Again
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {terminals.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                      >
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{t.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {t.type.toUpperCase()}
                          </Badge>
                        </div>
                        {t.isRunning && (
                          <Badge className="bg-green-500/20 text-green-400 text-[10px]">Running</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Install button */}
                {terminals.length > 0 && !installDone && (
                  <Button onClick={handleInstall} disabled={installing} className="w-full">
                    {installing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Installing EA &amp; DLLs…</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" />Install EA &amp; DLLs</>
                    )}
                  </Button>
                )}

                {installDone && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Installation complete!</span>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)} disabled={licenseValid}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button size="sm" onClick={() => setStep(3)}>
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ────────── Step 3: Verify ────────── */}
            {step === 3 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Wifi className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Verify Connection</h3>
                    <p className="text-xs text-muted-foreground">Waiting for a live heartbeat from your EA</p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  {heartbeat ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      </div>
                      <p className="text-sm font-semibold text-green-400">EA Connected — You're Ready!</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-muted/30 border border-border flex items-center justify-center">
                        {checkingHeartbeat ? (
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        ) : (
                          <Wifi className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Waiting for connection…</p>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Open your trading terminal and attach the HedgeEdge EA to any chart. Make sure AutoTrading is enabled.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={finish} disabled={false}>
                    <Rocket className="w-4 h-4 mr-2" />
                    {heartbeat ? 'Go to Dashboard' : 'Skip & Continue'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Skip link */}
        <div className="text-center">
          <button
            onClick={finish}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline"
          >
            Skip setup entirely
          </button>
        </div>
      </div>
    </div>
  );
}
