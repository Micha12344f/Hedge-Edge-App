/**
 * Desktop utilities for HedgeEdge Electron app
 * Safe wrappers around Electron APIs
 * 
 * This is a desktop-only application - all code assumes Electron context.
 */

/**
 * Check if running inside Electron desktop app
 * Should always return true in production builds
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}

/**
 * Assert that we're running in Electron - throws if not
 */
export function assertElectron(): void {
  if (!isElectron()) {
    throw new Error('HedgeEdge must run as a desktop application');
  }
}

/**
 * Get the application version
 * Returns package.json version in Electron, 'unknown' otherwise
 */
export async function getAppVersion(): Promise<string> {
  if (isElectron()) {
    return window.electronAPI!.getVersion();
  }
  return 'unknown';
}

/**
 * Get platform information
 */
export async function getPlatformInfo(): Promise<{
  platform: string;
  arch: string;
  isPackaged: boolean;
}> {
  if (isElectron()) {
    return window.electronAPI!.getPlatform();
  }
  return {
    platform: navigator.platform,
    arch: 'unknown',
    isPackaged: false,
  };
}

/**
 * Open a URL in the external browser
 */
export async function openExternal(url: string): Promise<boolean> {
  // Validate URL
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.warn('Invalid protocol for openExternal:', parsedUrl.protocol);
      return false;
    }
  } catch {
    console.warn('Invalid URL for openExternal:', url);
    return false;
  }

  if (isElectron()) {
    return window.electronAPI!.openExternal(url);
  }
  
  // Fallback (shouldn't happen in packaged app)
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Platform-aware link handler
 * Use this for links that should open externally in desktop
 */
export function handleExternalLink(event: React.MouseEvent, url: string): void {
  if (isElectron()) {
    event.preventDefault();
    openExternal(url);
  }
  // In browser, let the default behavior handle it
}
