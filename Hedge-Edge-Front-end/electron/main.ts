import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

// Agent configuration and supervision modules
import { 
  getAgentConfig, 
  getAgentPort,
  getAgentUrl,
  setAgentConfig,
  resetAgentConfig,
  getConfigSummary,
  bundledAgentExists,
  AgentPlatform,
  AgentMode,
} from './agent-config.js';

import {
  initializeSupervisor,
  shutdownSupervisor,
  getAgentHealthStatus,
  getAllAgentHealthStatus,
  manualStartAgent,
  manualStopAgent,
  restartAgent,
  getAgentLogPath,
} from './agent-supervisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if running in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

// ============================================================================
// IPC Payload Validation
// ============================================================================

/**
 * Validate that a value is a valid trading platform
 */
function isValidPlatform(value: unknown): value is AgentPlatform {
  return value === 'mt5' || value === 'ctrader';
}

/**
 * Validate trading credentials structure
 */
function isValidCredentials(value: unknown): value is { login: string; password: string; server: string } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.login === 'string' &&
    typeof obj.password === 'string' &&
    typeof obj.server === 'string' &&
    obj.login.length > 0 &&
    obj.server.length > 0
  );
}

/**
 * Validate order request structure
 */
function isValidOrderRequest(value: unknown): value is { 
  symbol: string; 
  type: string; 
  volume: number;
  price?: number;
  sl?: number;
  tp?: number;
  magic?: number;
  comment?: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.symbol === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.volume === 'number' &&
    obj.symbol.length > 0 &&
    ['BUY', 'SELL'].includes(obj.type) &&
    obj.volume > 0
  );
}

/**
 * Validate close order request structure
 */
function isValidCloseOrderRequest(value: unknown): value is { ticket: number; volume?: number } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ticket === 'number' &&
    obj.ticket > 0 &&
    (obj.volume === undefined || (typeof obj.volume === 'number' && obj.volume > 0))
  );
}

/**
 * Validate agent config update structure
 */
function isValidAgentConfigUpdate(value: unknown): value is { mode?: AgentMode; host?: string; port?: number } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  if (obj.mode !== undefined && !['bundled', 'external', 'not-configured'].includes(obj.mode as string)) {
    return false;
  }
  if (obj.host !== undefined && typeof obj.host !== 'string') {
    return false;
  }
  if (obj.port !== undefined && (typeof obj.port !== 'number' || obj.port < 1 || obj.port > 65535)) {
    return false;
  }
  return true;
}

// ============================================================================
// Port Checking Utility
// ============================================================================

/**
 * Check if a port is available (not in use)
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

// ============================================================================
// Agent HTTP Requests
// ============================================================================

/**
 * Make a request to the local trading agent
 * Uses configurable ports from agent-config
 */
async function agentRequest<T>(
  platform: AgentPlatform,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<{ success: boolean; data?: T; error?: string }> {
  const baseUrl = getAgentUrl(platform);
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json() as T & { error?: string };
    
    if (!response.ok) {
      return { success: false, error: data?.error || `HTTP ${response.status}` };
    }
    
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Agent request failed',
    };
  }
}

// ============================================================================
// Security: URL Allowlist for External Links
// ============================================================================

const EXTERNAL_URL_ALLOWLIST = [
  // Documentation and support
  'hedgeedge.com',
  'docs.hedgeedge.com',
  'support.hedgeedge.com',
  // OAuth providers (Supabase, etc.)
  'supabase.co',
  // GitHub for updates/releases
  'github.com',
  'releases.hedgeedge.com',
];

/**
 * Check if a URL is allowed for external opening
 */
function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow https (and http in dev)
    if (parsed.protocol !== 'https:' && !(isDev && parsed.protocol === 'http:')) {
      return false;
    }
    
    // Check against allowlist
    const hostname = parsed.hostname.toLowerCase();
    return EXTERNAL_URL_ALLOWLIST.some(allowed => 
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Security Handlers
// ============================================================================

function setupSecurityHandlers(window: BrowserWindow) {
  // Prevent navigation to external URLs
  window.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowedProtocols = ['file:', 'http:', 'https:'];
    
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      event.preventDefault();
      return;
    }
    
    // In production, only allow file: protocol for main content
    if (!isDev && parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      // Use the same allowlist for consistency
      if (isAllowedExternalUrl(url)) {
        shell.openExternal(url);
      } else {
        console.warn('Blocked navigation to non-allowlisted URL:', url);
      }
    }
  });

  // Open external links in default browser (with allowlist check)
  window.webContents.setWindowOpenHandler(({ url }) => {
    // Apply the same allowlist check as app:openExternal
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      console.warn('Blocked window.open to non-allowlisted URL:', url);
    }
    return { action: 'deny' };
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'HedgeEdge',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#0a0a0a',
    show: true, // Show immediately for debugging
    center: true, // Center on screen
    webPreferences: {
      // Security: Use preload script for safe IPC
      preload: path.join(__dirname, 'preload.js'),
      // Security: Disable Node.js integration in renderer
      nodeIntegration: false,
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable remote module
      sandbox: true,
      // Security: Disable web security only in dev for hot reload
      webSecurity: !isDev,
    },
  });

  // Setup security handlers
  setupSecurityHandlers(mainWindow);

  // Content Security Policy
  // All trading data flows via IPC, so we can lock down connect-src
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          scriptSrc,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: blob:",
          // Only allow Supabase for auth - all trading data flows via IPC
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    });
  });

  // Load the app
  if (isDev) {
    // Development: Load from Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:8080';
    console.log('[Main] Loading dev server:', devServerUrl);
    try {
      await mainWindow.loadURL(devServerUrl);
      console.log('[Main] Dev server loaded successfully');
    } catch (err) {
      console.error('[Main] Failed to load dev server:', err);
    }
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window immediately - don't wait for ready-to-show in dev
  if (isDev) {
    mainWindow.show();
  } else {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIpcHandlers() {
  // -------------------------------------------------------------------------
  // App Handlers
  // -------------------------------------------------------------------------
  
  // Get app version
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  // Get platform info
  ipcMain.handle('app:getPlatform', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    };
  });

  // Open external URL - with allowlist validation
  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    // Validate URL before opening
    if (typeof url !== 'string') {
      console.error('Invalid URL type:', typeof url);
      return false;
    }
    
    try {
      // Strict allowlist check in production
      if (!isDev && !isAllowedExternalUrl(url)) {
        console.warn('URL not in allowlist:', url);
        return false;
      }
      
      // In dev, allow http/https
      const parsedUrl = new URL(url);
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        await shell.openExternal(url);
        return true;
      }
    } catch {
      console.error('Invalid URL:', url);
    }
    return false;
  });

  // -------------------------------------------------------------------------
  // Agent Configuration Handlers
  // -------------------------------------------------------------------------

  // Get agent configuration summary
  ipcMain.handle('agent:getConfig', () => {
    return getConfigSummary();
  });

  // Get full health status for all agents
  ipcMain.handle('agent:getHealthStatus', async () => {
    return getAllAgentHealthStatus();
  });

  // Get health status for a specific platform
  ipcMain.handle('agent:getPlatformHealth', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    const status = await getAgentHealthStatus(platform);
    return { success: true, data: status };
  });

  // Update agent configuration for a platform
  ipcMain.handle('agent:setConfig', async (_event, platform: unknown, config: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidAgentConfigUpdate(config)) {
      return { success: false, error: 'Invalid configuration' };
    }
    
    try {
      setAgentConfig(platform, config);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save configuration',
      };
    }
  });

  // Reset agent configuration to defaults
  ipcMain.handle('agent:resetConfig', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    
    try {
      resetAgentConfig(platform);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset configuration',
      };
    }
  });

  // Start agent (bundled mode only)
  ipcMain.handle('agent:start', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return manualStartAgent(platform);
  });

  // Stop agent
  ipcMain.handle('agent:stop', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return manualStopAgent(platform);
  });

  // Restart agent
  ipcMain.handle('agent:restart', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return restartAgent(platform);
  });

  // Get agent log file path
  ipcMain.handle('agent:getLogPath', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return { success: true, data: getAgentLogPath(platform) };
  });

  // Check if bundled agent exists
  ipcMain.handle('agent:hasBundled', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return { success: true, data: bundledAgentExists(platform) };
  });

  // -------------------------------------------------------------------------
  // Trading Bridge Handlers (with validation)
  // -------------------------------------------------------------------------

  // Get terminal status
  ipcMain.handle('trading:getStatus', async (_event, platform: unknown) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    
    try {
      const config = getAgentConfig();
      const platformConfig = config[platform];
      const isLocalAgent = platformConfig.endpoint.host === '127.0.0.1' || platformConfig.endpoint.host === 'localhost';
      
      // Only do local port check for bundled/local agents
      // For external agents on remote hosts, skip directly to health check
      if (isLocalAgent) {
        const port = getAgentPort(platform);
        const portAvailable = await isPortAvailable(port);
        
        if (portAvailable) {
          // Port is available = agent not running
          return {
            success: true,
            data: {
              connected: false,
              platform,
              terminalRunning: false,
              error: 'Trading agent not running',
            },
          };
        }
      }
      
      // Try to get health from agent (uses configured host via agentRequest)
      const result = await agentRequest<any>(platform, '/health');
      
      if (result.success) {
        return {
          success: true,
          data: {
            connected: result.data?.mt5_connected || result.data?.ctrader_connected || false,
            platform,
            terminalRunning: true,
            lastHeartbeat: new Date().toISOString(),
          },
        };
      }
      
      return {
        success: true,
        data: {
          connected: false,
          platform,
          terminalRunning: true,
          error: result.error,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      };
    }
  });

  // Validate credentials (with payload validation)
  ipcMain.handle('trading:validateCredentials', async (
    _event,
    platform: unknown,
    credentials: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    // NOTE: Password is never stored at rest - only passed through to agent
    return agentRequest(platform, '/api/validate', 'POST', credentials);
  });

  // Get account snapshot (with payload validation)
  ipcMain.handle('trading:getSnapshot', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    if (credentials) {
      return agentRequest(platform, '/api/account/snapshot', 'POST', credentials);
    }
    return agentRequest(platform, '/api/snapshot');
  });

  // Get balance (with payload validation)
  ipcMain.handle('trading:getBalance', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    if (credentials) {
      return agentRequest(platform, '/api/account/balance', 'POST', credentials);
    }
    return agentRequest(platform, '/api/balance');
  });

  // Get positions (with payload validation)
  ipcMain.handle('trading:getPositions', async (
    _event,
    platform: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    if (credentials) {
      return agentRequest(platform, '/api/account/positions', 'POST', credentials);
    }
    return agentRequest(platform, '/api/positions');
  });

  // Get tick (with payload validation)
  ipcMain.handle('trading:getTick', async (
    _event,
    platform: unknown,
    symbol: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (typeof symbol !== 'string' || symbol.length === 0) {
      return { success: false, error: 'Invalid symbol' };
    }
    return agentRequest(platform, `/api/tick?symbol=${encodeURIComponent(symbol)}`);
  });

  // Get symbols (with payload validation)
  ipcMain.handle('trading:getSymbols', async (
    _event,
    platform: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    return agentRequest(platform, '/api/symbols');
  });

  // Place order (with payload validation)
  ipcMain.handle('trading:placeOrder', async (
    _event,
    platform: unknown,
    order: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidOrderRequest(order)) {
      return { success: false, error: 'Invalid order request' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    const body = credentials ? { ...order, ...credentials } : order;
    return agentRequest(platform, '/api/order', 'POST', body);
  });

  // Close order (with payload validation)
  ipcMain.handle('trading:closeOrder', async (
    _event,
    platform: unknown,
    request: unknown,
    credentials?: unknown
  ) => {
    if (!isValidPlatform(platform)) {
      return { success: false, error: 'Invalid platform' };
    }
    if (!isValidCloseOrderRequest(request)) {
      return { success: false, error: 'Invalid close order request' };
    }
    if (credentials !== undefined && !isValidCredentials(credentials)) {
      return { success: false, error: 'Invalid credentials format' };
    }
    const body = credentials ? { ...request, ...credentials } : request;
    return agentRequest(platform, '/api/order/close', 'POST', body);
  });
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  // Setup IPC handlers first
  setupIpcHandlers();
  
  // Initialize agent supervisor (starts bundled agents if available)
  try {
    await initializeSupervisor();
    console.log('[Main] Agent supervisor initialized');
  } catch (error) {
    console.error('[Main] Failed to initialize agent supervisor:', error);
  }
  
  // Create the main window
  await createWindow();

  // macOS: Re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent creation of additional webviews
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});

// Cleanup on quit - shutdown supervisor gracefully
app.on('before-quit', async (event) => {
  // Prevent immediate quit to allow async cleanup
  event.preventDefault();
  
  try {
    await shutdownSupervisor();
    console.log('[Main] Agent supervisor shutdown complete');
  } catch (error) {
    console.error('[Main] Error during supervisor shutdown:', error);
  }
  
  // Now actually quit
  app.exit(0);
});
