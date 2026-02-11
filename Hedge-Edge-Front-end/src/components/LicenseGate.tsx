import { useEffect, useState } from "react";
import { Loader2, Key, AlertCircle, CheckCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isElectron } from "@/lib/desktop";

interface LicenseGateProps {
  children: React.ReactNode;
}

type GateState = "loading" | "needs-license" | "validating" | "valid" | "error";

export function LicenseGate({ children }: LicenseGateProps) {
  const [state, setState] = useState<GateState>("loading");
  const [licenseKey, setLicenseKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [licenseInfo, setLicenseInfo] = useState<{ plan?: string; expiresAt?: string } | null>(null);

  useEffect(() => {
    console.log('[LicenseGate] Component mounted, checking license...');
    const timeoutId = setTimeout(() => {
      console.warn('[LicenseGate] License check timeout after 10s');
      if (state === 'loading') {
        setState('needs-license');
      }
    }, 10000);

    checkExistingLicense().finally(() => clearTimeout(timeoutId));
  }, []);

  const checkExistingLicense = async () => {
    setState("loading");
    setErrorMessage("");

    if (!isElectron()) {
      console.log('[LicenseGate] Not running in Electron, skipping license check');
      setState("valid");
      return;
    }

    try {
      console.log('[LicenseGate] Calling window.electronAPI.license.getStatus()');
      const result = await window.electronAPI?.license?.getStatus();
      console.log('[LicenseGate] getStatus result:', result);

      if (result?.success && result.data) {
        const { status, plan, expiresAt } = result.data;

        if (status === "valid") {
          console.log('[LicenseGate] License is valid, allowing access');
          setLicenseInfo({ plan, expiresAt });
          setState("valid");
          return;
        }

        if (status === "expired") {
          setErrorMessage("Your license has expired. Please renew or enter a new license key.");
        } else if (status === "error") {
          setErrorMessage(result.data.errorMessage || "License validation error");
        }
      }

      console.log('[LicenseGate] No valid license, showing input form');
      setState("needs-license");
    } catch (err) {
      console.error("[LicenseGate] Error checking license:", err);
      setState("needs-license");
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanKey = licenseKey.trim().toUpperCase();
    if (!cleanKey) {
      setErrorMessage("Please enter a license key");
      return;
    }

    setState("validating");
    setErrorMessage("");

    try {
      const result = await window.electronAPI?.license?.activate(cleanKey);

      if (result?.success && result.license) {
        const { status, plan, expiresAt } = result.license;

        if (status === "valid") {
          setLicenseInfo({ plan, expiresAt });
          setState("valid");
          return;
        }

        setErrorMessage(result.license.errorMessage || "License validation failed");
        setState("error");
      } else {
        setErrorMessage(result?.error || "Failed to activate license");
        setState("error");
      }
    } catch (err) {
      console.error("[LicenseGate] Activation error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Activation failed");
      setState("error");
    }
  };

  const handleRetry = () => {
    setErrorMessage("");
    setState("needs-license");
  };

  if (state === "valid") {
    return <>{children}</>;
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <Shield className="w-16 h-16 text-emerald-400" />
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin absolute -bottom-1 -right-1" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Checking License</h2>
          <p className="text-slate-400">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-16 h-16 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">HedgeEdge</h1>
          <p className="text-slate-400">Trade Copier</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Key className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Enter License Key</h2>
              <p className="text-sm text-slate-400">Activate your HedgeEdge license</p>
            </div>
          </div>

          <form onSubmit={handleActivate}>
            <div className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 font-mono text-center text-lg tracking-wider h-12"
                  disabled={state === "validating"}
                  autoFocus
                />
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              {state === "error" ? (
                <Button
                  type="button"
                  onClick={handleRetry}
                  className="w-full bg-slate-600 hover:bg-slate-500 h-11"
                >
                  Try Again
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={state === "validating" || !licenseKey.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 h-11"
                >
                  {state === "validating" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Activate License
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              Your license key was sent to your email after purchase.
              <br />
              Need help? Contact support@hedge-edge.com
            </p>
            {licenseInfo?.plan && (
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Plan: {licenseInfo.plan}
                {licenseInfo.expiresAt ? ` · Expires ${new Date(licenseInfo.expiresAt).toLocaleDateString()}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
