/**
 * Agent Data Channel Reader
 * 
 * Reads data from trading terminal agents using:
 * 
 * MT5:
 * 1. ZeroMQ (high-performance, sub-millisecond latency) - preferred
 * 2. File-based channels (fallback for compatibility)
 * 
 * cTrader:
 * 1. Windows Named Pipes (high-performance, native Windows IPC)
 * 
 * ZeroMQ Mode (MT5):
 * - SUB socket connects to EA's PUB socket for real-time snapshots
 * - REQ socket connects to EA's REP socket for commands
 * 
 * Named Pipe Mode (cTrader):
 * - Data pipe receives account snapshots from cBot
 * - Command pipe sends commands to cBot
 * 
 * File Mode (Fallback):
 * - MT5: File-based (MQL5/Files/HedgeEdgeMT5.json)
 */

import { promises as fs } from 'fs';
import net from 'net';
import path from 'path';
import { 
  ZmqBridge, 
  createZmqBridgeForPorts, 
  isZmqAvailable,
  ZmqSnapshot,
  ZmqCommand,
  ZmqResponse,
  DEFAULT_ZMQ_CONFIG,
} from './zmq-bridge.js';
import {
  NamedPipeClient,
  createNamedPipeClient,
  createNamedPipeClientForInstance,
  isCTraderPipeAvailable,
  CTraderSnapshot,
  CTraderCommand,
  CTraderResponse,
  DEFAULT_NAMED_PIPE_CONFIG,
} from './named-pipe-client.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentSnapshot {
  timestamp: string;
  platform: 'MT5' | 'cTrader';
  accountId: string;
  broker: string;
  server?: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  floatingPnL: number;
  currency: string;
  leverage: number;
  status: string;
  isLicenseValid: boolean;
  isPaused: boolean;
  lastError: string | null;
  positions: AgentPosition[];
}

export interface AgentPosition {
  id: string;
  symbol: string;
  volume: number;
  volumeLots: number;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
  comment: string;
}

export interface AgentCommand {
  action: 'PAUSE' | 'RESUME' | 'CLOSE_ALL' | 'CLOSE_POSITION' | 'STATUS';
  params?: Record<string, string | number>;
  timestamp?: string;
}

export interface AgentResponse {
  success: boolean;
  action: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface ChannelReaderResult {
  success: boolean;
  data?: AgentSnapshot;
  error?: string;
  lastModified?: Date;
}

// ============================================================================
// Constants
// ============================================================================

const MT5_DATA_FILE = 'HedgeEdgeMT5.json';
const MT5_COMMAND_FILE = 'HedgeEdgeMT5_cmd.json';
const MT5_RESPONSE_FILE = 'HedgeEdgeMT5_resp.json';
const CTRADER_PIPE_NAME = 'HedgeEdgeCTrader';
const CTRADER_COMMAND_PIPE = 'HedgeEdgeCTrader_Commands';

// ============================================================================
// cTrader Terminal Configuration
// ============================================================================

export interface CTraderTerminalConfig {
  terminalId: string;
  instanceId?: string;  // Optional instance suffix for multiple cTrader instances
  dataPipeName?: string;
  commandPipeName?: string;
}

// ============================================================================
// MT5 File Channel Reader
// ============================================================================

/**
 * Get the MT5 data file path for a terminal
 */
export function getMT5DataFilePath(terminalDataPath: string): string {
  return path.join(terminalDataPath, 'MQL5', 'Files', MT5_DATA_FILE);
}

/**
 * Get the MT5 command file path
 */
export function getMT5CommandFilePath(terminalDataPath: string): string {
  return path.join(terminalDataPath, 'MQL5', 'Files', MT5_COMMAND_FILE);
}

/**
 * Get the MT5 response file path
 */
export function getMT5ResponseFilePath(terminalDataPath: string): string {
  return path.join(terminalDataPath, 'MQL5', 'Files', MT5_RESPONSE_FILE);
}

/**
 * Read MT5 agent snapshot from file channel
 */
export async function readMT5Snapshot(terminalDataPath: string): Promise<ChannelReaderResult> {
  const filePath = getMT5DataFilePath(terminalDataPath);
  
  try {
    // Check if file exists
    const stats = await fs.stat(filePath);
    
    // Read the file as buffer first to handle BOM and encoding issues
    // MQL5 may write files with UTF-16 LE BOM or Windows-1252 encoding
    const buffer = await fs.readFile(filePath);
    let content: string;
    
    // Check for UTF-16 LE BOM (0xFF 0xFE) - MQL5 default for FileOpen
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      content = buffer.toString('utf16le').substring(1); // Skip BOM
    }
    // Check for UTF-8 BOM (0xEF 0xBB 0xBF)
    else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      content = buffer.toString('utf-8').substring(1); // Skip BOM
    }
    // Check for UTF-16 BE BOM (0xFE 0xFF)
    else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      // Convert from UTF-16 BE to string
      const swapped = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length - 1; i += 2) {
        swapped[i] = buffer[i + 1];
        swapped[i + 1] = buffer[i];
      }
      content = swapped.toString('utf16le').substring(1); // Skip BOM
    }
    // Assume UTF-8 without BOM (FILE_ANSI in MQL5)
    else {
      content = buffer.toString('utf-8');
    }
    
    // Trim any leading/trailing whitespace and null characters
    content = content.replace(/^\s*/, '').replace(/\s*$/, '').replace(/\0/g, '');
    
    const data = JSON.parse(content) as AgentSnapshot;
    
    // Validate basic structure
    if (!data.timestamp || !data.platform) {
      return {
        success: false,
        error: 'Invalid snapshot format',
      };
    }
    
    return {
      success: true,
      data,
      lastModified: stats.mtime,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: false,
        error: 'Agent data file not found. Is the EA running?',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read MT5 snapshot',
    };
  }
}

/**
 * Send a command to MT5 agent via file channel
 */
export async function sendMT5Command(
  terminalDataPath: string,
  command: AgentCommand
): Promise<{ success: boolean; response?: AgentResponse; error?: string }> {
  const commandPath = getMT5CommandFilePath(terminalDataPath);
  const responsePath = getMT5ResponseFilePath(terminalDataPath);
  
  try {
    // Write command file
    const commandWithTimestamp = {
      ...command,
      timestamp: new Date().toISOString(),
    };
    await fs.writeFile(commandPath, JSON.stringify(commandWithTimestamp, null, 2), 'utf-8');
    
    // Wait for response (poll with timeout)
    const startTime = Date.now();
    const timeout = 5000; // 5 seconds
    
    while (Date.now() - startTime < timeout) {
      try {
        const responseContent = await fs.readFile(responsePath, 'utf-8');
        const response = JSON.parse(responseContent) as AgentResponse;
        
        // Check if response is for our command
        if (response.action === command.action) {
          // Clean up command file
          await fs.unlink(commandPath).catch(() => {});
          return { success: true, response };
        }
      } catch {
        // Response not ready yet
      }
      
      // Wait a bit before polling again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
      success: false,
      error: 'Command timeout - no response from EA',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send command',
    };
  }
}

// ============================================================================
// cTrader Named Pipe Reader
// ============================================================================

/**
 * Get the cTrader pipe path
 */
export function getCTraderPipePath(): string {
  return `\\\\.\\pipe\\${CTRADER_PIPE_NAME}`;
}

/**
 * Get the cTrader command pipe path
 */
export function getCTraderCommandPipePath(): string {
  return `\\\\.\\pipe\\${CTRADER_COMMAND_PIPE}`;
}

/**
 * Read cTrader agent snapshot from named pipe
 */
export async function readCTraderSnapshot(): Promise<ChannelReaderResult> {
  const pipePath = getCTraderPipePath();
  
  return new Promise((resolve) => {
    const client = net.createConnection(pipePath, () => {
      // Connected successfully
    });
    
    let data = '';
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({
        success: false,
        error: 'Connection timeout',
      });
    }, 3000);
    
    client.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    client.on('end', () => {
      clearTimeout(timeout);
      
      try {
        const snapshot = JSON.parse(data) as AgentSnapshot;
        resolve({
          success: true,
          data: snapshot,
          lastModified: new Date(),
        });
      } catch (error) {
        resolve({
          success: false,
          error: 'Invalid JSON from pipe',
        });
      }
    });
    
    client.on('error', (error) => {
      clearTimeout(timeout);
      
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve({
          success: false,
          error: 'cBot pipe not found. Is the cBot running?',
        });
      } else {
        resolve({
          success: false,
          error: error.message || 'Pipe connection failed',
        });
      }
    });
    
    // Send a read request (empty message triggers snapshot response)
    client.write(JSON.stringify({ action: 'STATUS' }));
  });
}

/**
 * Send a command to cTrader agent via named pipe
 */
export async function sendCTraderCommand(
  command: AgentCommand
): Promise<{ success: boolean; response?: AgentResponse; error?: string }> {
  const pipePath = getCTraderCommandPipePath();
  
  return new Promise((resolve) => {
    const client = net.createConnection(pipePath, () => {
      // Send command
      client.write(JSON.stringify(command));
    });
    
    let data = '';
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({
        success: false,
        error: 'Command timeout',
      });
    }, 5000);
    
    client.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    client.on('end', () => {
      clearTimeout(timeout);
      
      try {
        const response = JSON.parse(data) as AgentResponse;
        resolve({ success: true, response });
      } catch {
        resolve({
          success: false,
          error: 'Invalid response from cBot',
        });
      }
    });
    
    client.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: error.message || 'Command failed',
      });
    });
  });
}

// ============================================================================
// Unified Channel Reader (with ZMQ and Named Pipe Support)
// ============================================================================

export type ChannelMode = 'zmq' | 'file' | 'pipe' | 'auto';
export type Platform = 'MT5' | 'cTrader';

export interface TerminalConfig {
  terminalId: string;
  platform: Platform;
  dataPath?: string;      // For file mode (MT5)
  dataPort?: number;      // For ZMQ mode (MT5)
  commandPort?: number;   // For ZMQ mode (MT5)
  host?: string;          // For ZMQ mode (MT5)
  dataPipeName?: string;  // For pipe mode (cTrader)
  commandPipeName?: string; // For pipe mode (cTrader)
  instanceId?: string;    // For multiple cTrader instances
  mode: ChannelMode;
}

export class AgentChannelReader {
  private mt5DataPaths: Map<string, string> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastSnapshots: Map<string, AgentSnapshot> = new Map();
  private listeners: Set<(accountId: string, snapshot: AgentSnapshot) => void> = new Set();
  
  // ZMQ bridges for high-performance mode (MT5)
  private zmqBridges: Map<string, ZmqBridge> = new Map();
  private zmqAvailable: boolean | null = null;
  private terminalConfigs: Map<string, TerminalConfig> = new Map();
  
  // Named Pipe clients for cTrader
  private pipeClients: Map<string, NamedPipeClient> = new Map();
  
  constructor() {
    // Check ZMQ availability on construction
    this.checkZmqAvailability();
  }
  
  /**
   * Check if ZeroMQ is available
   */
  private async checkZmqAvailability(): Promise<void> {
    this.zmqAvailable = await isZmqAvailable();
    console.log(`[AgentChannelReader] ZMQ available: ${this.zmqAvailable}`);
  }
  
  /**
   * Get ZMQ availability status
   */
  isZmqAvailable(): boolean {
    return this.zmqAvailable === true;
  }
  
  /**
   * Check if Named Pipes are available (cTrader cBot running)
   */
  async isCTraderAvailable(): Promise<boolean> {
    return isCTraderPipeAvailable();
  }
  
  /**
   * Register an MT5 terminal for monitoring (legacy file mode)
   */
  registerMT5Terminal(terminalId: string, dataPath: string): void {
    this.mt5DataPaths.set(terminalId, dataPath);
    this.terminalConfigs.set(terminalId, {
      terminalId,
      platform: 'MT5',
      dataPath,
      mode: 'file',
    });
    console.log(`[AgentChannelReader] Registered MT5 terminal (file mode): ${terminalId}`);
  }
  
  /**
   * Register a cTrader terminal for monitoring via Named Pipes
   */
  async registerCTraderTerminal(
    terminalId: string,
    options: {
      instanceId?: string;
      dataPipeName?: string;
      commandPipeName?: string;
    } = {}
  ): Promise<boolean> {
    // Create config
    const config: TerminalConfig = {
      terminalId,
      platform: 'cTrader',
      instanceId: options.instanceId,
      dataPipeName: options.dataPipeName || 
        (options.instanceId ? `\\\\.\\pipe\\HedgeEdgeCTrader_${options.instanceId}` : DEFAULT_NAMED_PIPE_CONFIG.dataPipeName),
      commandPipeName: options.commandPipeName || 
        (options.instanceId ? `\\\\.\\pipe\\HedgeEdgeCTrader_Commands_${options.instanceId}` : DEFAULT_NAMED_PIPE_CONFIG.commandPipeName),
      mode: 'pipe',
    };
    
    this.terminalConfigs.set(terminalId, config);
    
    try {
      // Create Named Pipe client
      const client = options.instanceId 
        ? createNamedPipeClientForInstance(options.instanceId)
        : createNamedPipeClient({
            dataPipeName: config.dataPipeName,
            commandPipeName: config.commandPipeName,
          });
      
      // Set up event handlers
      client.on('snapshot', (snapshot: CTraderSnapshot) => {
        // Convert cTrader snapshot to agent snapshot format
        const agentSnapshot = this.convertCTraderSnapshot(snapshot);
        this.lastSnapshots.set(terminalId, agentSnapshot);
        this.notifyListeners(terminalId, agentSnapshot);
      });
      
      client.on('goodbye', () => {
        console.log(`[AgentChannelReader] cTrader ${terminalId} disconnected`);
        // Named pipe client will auto-reconnect
      });
      
      client.on('error', (error: Error) => {
        console.error(`[AgentChannelReader] Named Pipe error for ${terminalId}:`, error.message);
      });
      
      client.on('connected', () => {
        console.log(`[AgentChannelReader] cTrader ${terminalId} connected`);
      });
      
      client.on('disconnected', () => {
        console.log(`[AgentChannelReader] cTrader ${terminalId} pipe disconnected, will reconnect...`);
      });
      
      // Try to start the client
      const started = await client.start();
      
      if (started) {
        this.pipeClients.set(terminalId, client);
        console.log(`[AgentChannelReader] Registered cTrader terminal (Named Pipe mode): ${terminalId}`);
        return true;
      }
    } catch (error) {
      console.warn(`[AgentChannelReader] Failed to start Named Pipe client for ${terminalId}:`, error);
      // Client will continue trying to reconnect in background
      return true; // Still consider it "registered" as it will auto-reconnect
    }
    
    return false;
  }
  
  /**
   * Convert cTrader snapshot to AgentSnapshot format
   */
  private convertCTraderSnapshot(ctraderSnapshot: CTraderSnapshot): AgentSnapshot {
    return {
      timestamp: ctraderSnapshot.timestamp,
      platform: 'cTrader',
      accountId: ctraderSnapshot.accountId,
      broker: ctraderSnapshot.broker,
      balance: ctraderSnapshot.balance,
      equity: ctraderSnapshot.equity,
      margin: ctraderSnapshot.margin,
      freeMargin: ctraderSnapshot.freeMargin,
      marginLevel: ctraderSnapshot.marginLevel || 0,
      floatingPnL: ctraderSnapshot.floatingPnL,
      currency: ctraderSnapshot.currency,
      leverage: ctraderSnapshot.leverage,
      status: ctraderSnapshot.status,
      isLicenseValid: ctraderSnapshot.isLicenseValid,
      isPaused: ctraderSnapshot.isPaused,
      lastError: ctraderSnapshot.lastError,
      positions: ctraderSnapshot.positions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        volume: p.volume,
        volumeLots: p.volumeLots,
        side: p.side,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        profit: p.profit,
        swap: p.swap,
        commission: p.commission,
        openTime: p.openTime,
        comment: p.comment,
      })),
    };
  }
  
  /**
   * Register an MT5 terminal with ZMQ support
   */
  async registerMT5TerminalZmq(
    terminalId: string,
    options: {
      dataPort?: number;
      commandPort?: number;
      host?: string;
      fallbackDataPath?: string;
    } = {}
  ): Promise<boolean> {
    const dataPort = options.dataPort || DEFAULT_ZMQ_CONFIG.dataPort;
    const commandPort = options.commandPort || DEFAULT_ZMQ_CONFIG.commandPort;
    const host = options.host || '127.0.0.1';
    
    const config: TerminalConfig = {
      terminalId,
      platform: 'MT5',
      dataPath: options.fallbackDataPath,
      dataPort,
      commandPort,
      host,
      mode: 'auto',
    };
    
    this.terminalConfigs.set(terminalId, config);
    
    // If ZMQ is available, try to create a bridge
    if (this.zmqAvailable) {
      try {
        const bridge = createZmqBridgeForPorts(dataPort, commandPort, host);
        
        // Set up event handlers
        bridge.on('snapshot', (snapshot: ZmqSnapshot) => {
          // Convert ZMQ snapshot to agent snapshot format
          const agentSnapshot = this.convertZmqSnapshot(snapshot);
          this.lastSnapshots.set(terminalId, agentSnapshot);
          this.notifyListeners(terminalId, agentSnapshot);
        });
        
        bridge.on('goodbye', () => {
          console.log(`[AgentChannelReader] EA ${terminalId} disconnected`);
          // Fall back to file mode
          this.fallbackToFileMode(terminalId);
        });
        
        bridge.on('error', (error: Error) => {
          console.error(`[AgentChannelReader] ZMQ error for ${terminalId}:`, error);
        });
        
        // Try to start the bridge
        const started = await bridge.start();
        
        if (started) {
          this.zmqBridges.set(terminalId, bridge);
          config.mode = 'zmq';
          console.log(`[AgentChannelReader] Registered MT5 terminal (ZMQ mode): ${terminalId}`);
          return true;
        }
      } catch (error) {
        console.warn(`[AgentChannelReader] Failed to start ZMQ bridge for ${terminalId}:`, error);
      }
    }
    
    // Fall back to file mode if provided
    if (options.fallbackDataPath) {
      this.mt5DataPaths.set(terminalId, options.fallbackDataPath);
      config.mode = 'file';
      console.log(`[AgentChannelReader] Registered MT5 terminal (file fallback): ${terminalId}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Fall back to file mode for a terminal
   */
  private fallbackToFileMode(terminalId: string): void {
    const config = this.terminalConfigs.get(terminalId);
    if (!config || !config.dataPath) return;
    
    // Stop ZMQ bridge
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge) {
      bridge.stop();
      this.zmqBridges.delete(terminalId);
    }
    
    // Switch to file mode
    config.mode = 'file';
    this.mt5DataPaths.set(terminalId, config.dataPath);
    this.startPolling(terminalId);
    
    console.log(`[AgentChannelReader] Fell back to file mode for ${terminalId}`);
  }
  
  /**
   * Convert ZMQ snapshot to AgentSnapshot format
   */
  private convertZmqSnapshot(zmqSnapshot: ZmqSnapshot): AgentSnapshot {
    return {
      timestamp: zmqSnapshot.timestamp,
      platform: zmqSnapshot.platform,
      accountId: zmqSnapshot.accountId,
      broker: zmqSnapshot.broker,
      balance: zmqSnapshot.balance,
      equity: zmqSnapshot.equity,
      margin: zmqSnapshot.margin,
      freeMargin: zmqSnapshot.freeMargin,
      marginLevel: zmqSnapshot.marginLevel || 0,
      floatingPnL: zmqSnapshot.floatingPnL,
      currency: zmqSnapshot.currency,
      leverage: zmqSnapshot.leverage,
      status: zmqSnapshot.status,
      isLicenseValid: zmqSnapshot.isLicenseValid,
      isPaused: zmqSnapshot.isPaused,
      lastError: zmqSnapshot.lastError,
      positions: zmqSnapshot.positions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        volume: p.volume,
        volumeLots: p.volumeLots,
        side: p.side,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        profit: p.profit,
        swap: p.swap,
        commission: p.commission,
        openTime: p.openTime,
        comment: p.comment,
      })),
    };
  }
  
  /**
   * Unregister a terminal
   */
  async unregisterTerminal(terminalId: string): Promise<void> {
    // Stop ZMQ bridge if active (MT5)
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge) {
      await bridge.stop();
      this.zmqBridges.delete(terminalId);
    }
    
    // Stop Named Pipe client if active (cTrader)
    const pipeClient = this.pipeClients.get(terminalId);
    if (pipeClient) {
      await pipeClient.stop();
      this.pipeClients.delete(terminalId);
    }
    
    this.mt5DataPaths.delete(terminalId);
    this.terminalConfigs.delete(terminalId);
    this.lastSnapshots.delete(terminalId);
    this.stopPolling(terminalId);
  }
  
  /**
   * Get the communication mode for a terminal
   */
  getTerminalMode(terminalId: string): ChannelMode | null {
    const config = this.terminalConfigs.get(terminalId);
    return config?.mode || null;
  }
  
  /**
   * Get the platform type for a terminal
   */
  getTerminalPlatform(terminalId: string): Platform | null {
    const config = this.terminalConfigs.get(terminalId);
    return config?.platform || null;
  }
  
  /**
   * Check if terminal is using ZMQ mode (MT5)
   */
  isTerminalUsingZmq(terminalId: string): boolean {
    return this.zmqBridges.has(terminalId);
  }
  
  /**
   * Check if terminal is using Named Pipe mode (cTrader)
   */
  isTerminalUsingPipe(terminalId: string): boolean {
    return this.pipeClients.has(terminalId);
  }
  
  /**
   * Check if terminal is connected
   */
  isTerminalConnected(terminalId: string): boolean {
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge) return bridge.isConnected();
    
    const pipeClient = this.pipeClients.get(terminalId);
    if (pipeClient) return pipeClient.isConnected();
    
    return false;
  }
  
  /**
   * Start polling for updates
   */
  startPolling(terminalId: string, intervalMs: number = 1000): void {
    // Stop existing polling
    this.stopPolling(terminalId);
    
    const poll = async () => {
      const dataPath = this.mt5DataPaths.get(terminalId);
      if (!dataPath) return;
      
      const result = await readMT5Snapshot(dataPath);
      
      if (result.success && result.data) {
        const lastSnapshot = this.lastSnapshots.get(terminalId);
        
        // Only notify if data changed
        if (!lastSnapshot || result.data.timestamp !== lastSnapshot.timestamp) {
          this.lastSnapshots.set(terminalId, result.data);
          this.notifyListeners(terminalId, result.data);
        }
      }
    };
    
    // Initial poll
    poll();
    
    // Set up interval
    const interval = setInterval(poll, intervalMs);
    this.pollingIntervals.set(terminalId, interval);
  }
  
  /**
   * Stop polling for a terminal
   */
  stopPolling(terminalId: string): void {
    const interval = this.pollingIntervals.get(terminalId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(terminalId);
    }
  }
  
  /**
   * Stop all polling
   */
  stopAll(): void {
    for (const [terminalId] of this.pollingIntervals) {
      this.stopPolling(terminalId);
    }
  }
  
  /**
   * Subscribe to snapshot updates
   */
  subscribe(listener: (accountId: string, snapshot: AgentSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify listeners of snapshot update
   */
  private notifyListeners(accountId: string, snapshot: AgentSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(accountId, snapshot);
      } catch (error) {
        console.error('[AgentChannelReader] Listener error:', error);
      }
    }
  }
  
  /**
   * Get the last known snapshot for a terminal
   */
  getLastSnapshot(terminalId: string): AgentSnapshot | undefined {
    return this.lastSnapshots.get(terminalId);
  }
  
  /**
   * Read snapshot immediately
   */
  async readSnapshot(terminalId: string): Promise<ChannelReaderResult> {
    const dataPath = this.mt5DataPaths.get(terminalId);
    if (!dataPath) {
      return { success: false, error: 'Terminal not registered' };
    }
    return readMT5Snapshot(dataPath);
  }
  
  /**
   * Send command to agent
   */
  async sendCommand(
    terminalId: string,
    command: AgentCommand
  ): Promise<{ success: boolean; response?: AgentResponse; error?: string }> {
    // Try ZMQ first if available
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge && bridge.isConnected()) {
      try {
        const zmqCommand: ZmqCommand = {
          action: command.action,
          positionId: command.params?.positionId as string,
        };
        
        const response = await bridge.sendCommand(zmqCommand);
        
        return {
          success: response.success,
          response: {
            success: response.success,
            action: command.action,
            message: response.error || (response.success ? 'Command executed' : 'Command failed'),
            data: response,
            timestamp: new Date().toISOString(),
          },
          error: response.error,
        };
      } catch (error) {
        console.warn(`[AgentChannelReader] ZMQ command failed for ${terminalId}:`, error);
        // Fall through to file mode if available
      }
    }
    
    // Try Named Pipe client for cTrader
    const pipeClient = this.pipeClients.get(terminalId);
    if (pipeClient && pipeClient.isConnected()) {
      try {
        const pipeCommand: CTraderCommand = {
          action: command.action,
          positionId: command.params?.positionId as string,
          params: command.params as Record<string, unknown>,
        };
        
        const response = await pipeClient.sendCommand(pipeCommand);
        
        return {
          success: response.success,
          response: {
            success: response.success,
            action: command.action,
            message: response.error || response.message || (response.success ? 'Command executed' : 'Command failed'),
            data: response.data,
            timestamp: response.timestamp,
          },
          error: response.error,
        };
      } catch (error) {
        console.warn(`[AgentChannelReader] Named Pipe command failed for ${terminalId}:`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Named Pipe command failed',
        };
      }
    }
    
    // Fall back to file mode (MT5 only)
    const dataPath = this.mt5DataPaths.get(terminalId);
    if (!dataPath) {
      return { success: false, error: 'Terminal not registered or no fallback path' };
    }
    return sendMT5Command(dataPath, command);
  }
  
  /**
   * Send pause command
   */
  async pause(terminalId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.sendCommand(terminalId, { action: 'PAUSE' });
    return { success: result.success, error: result.error };
  }
  
  /**
   * Send resume command
   */
  async resume(terminalId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.sendCommand(terminalId, { action: 'RESUME' });
    return { success: result.success, error: result.error };
  }
  
  /**
   * Send close all command
   */
  async closeAll(terminalId: string): Promise<{ success: boolean; closedCount?: number; error?: string }> {
    const result = await this.sendCommand(terminalId, { action: 'CLOSE_ALL' });
    return { 
      success: result.success, 
      closedCount: (result.response?.data as { closedCount?: number })?.closedCount,
      error: result.error,
    };
  }
  
  /**
   * Send close position command
   */
  async closePosition(terminalId: string, positionId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.sendCommand(terminalId, { 
      action: 'CLOSE_POSITION', 
      params: { positionId },
    });
    return { success: result.success, error: result.error };
  }
  
  /**
   * Ping the agent to check connectivity
   */
  async ping(terminalId: string): Promise<boolean> {
    // Try ZMQ bridge (MT5)
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge && bridge.isConnected()) {
      return bridge.ping();
    }
    
    // Try Named Pipe client (cTrader)
    const pipeClient = this.pipeClients.get(terminalId);
    if (pipeClient && pipeClient.isConnected()) {
      return pipeClient.ping();
    }
    
    // For file mode (MT5), check if data file was recently updated
    const dataPath = this.mt5DataPaths.get(terminalId);
    if (dataPath) {
      try {
        const stats = await fs.stat(getMT5DataFilePath(dataPath));
        const ageMs = Date.now() - stats.mtime.getTime();
        return ageMs < 10000; // Consider alive if updated in last 10 seconds
      } catch {
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * Get connection statistics
   */
  getStats(terminalId: string): { mode: ChannelMode; platform: Platform; snapshotsReceived: number; commandsSent: number; connected: boolean } | null {
    const config = this.terminalConfigs.get(terminalId);
    if (!config) return null;
    
    // ZMQ bridge (MT5)
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge) {
      const status = bridge.getStatus();
      return {
        mode: 'zmq',
        platform: 'MT5',
        snapshotsReceived: status.snapshotsReceived,
        commandsSent: status.commandsSent,
        connected: bridge.isConnected(),
      };
    }
    
    // Named Pipe client (cTrader)
    const pipeClient = this.pipeClients.get(terminalId);
    if (pipeClient) {
      const status = pipeClient.getStatus();
      return {
        mode: 'pipe',
        platform: 'cTrader',
        snapshotsReceived: status.messagesReceived,
        commandsSent: status.commandsSent,
        connected: pipeClient.isConnected(),
      };
    }
    
    return {
      mode: 'file',
      platform: config.platform || 'MT5',
      snapshotsReceived: 0, // Not tracked in file mode
      commandsSent: 0,
      connected: false,
    };
  }
  
  /**
   * Get all registered terminal IDs
   */
  getRegisteredTerminals(): string[] {
    return Array.from(this.terminalConfigs.keys());
  }
  
  /**
   * Get all cTrader terminal IDs
   */
  getCTraderTerminals(): string[] {
    return Array.from(this.terminalConfigs.entries())
      .filter(([, config]) => config.platform === 'cTrader')
      .map(([id]) => id);
  }
  
  /**
   * Get all MT5 terminal IDs
   */
  getMT5Terminals(): string[] {
    return Array.from(this.terminalConfigs.entries())
      .filter(([, config]) => config.platform === 'MT5')
      .map(([id]) => id);
  }
  
  /**
   * Stop all connections and cleanup
   */
  async shutdown(): Promise<void> {
    // Stop all ZMQ bridges (MT5)
    for (const [terminalId, bridge] of this.zmqBridges) {
      try {
        await bridge.stop();
      } catch (error) {
        console.error(`[AgentChannelReader] Error stopping ZMQ bridge for ${terminalId}:`, error);
      }
    }
    this.zmqBridges.clear();
    
    // Stop all Named Pipe clients (cTrader)
    for (const [terminalId, client] of this.pipeClients) {
      try {
        await client.stop();
      } catch (error) {
        console.error(`[AgentChannelReader] Error stopping Named Pipe client for ${terminalId}:`, error);
      }
    }
    this.pipeClients.clear();
    
    // Stop all polling
    this.stopAll();
    
    // Clear state
    this.mt5DataPaths.clear();
    this.terminalConfigs.clear();
    this.lastSnapshots.clear();
    this.listeners.clear();
    
    console.log('[AgentChannelReader] Shutdown complete');
  }
}

// Singleton instance
export const agentChannelReader = new AgentChannelReader();

// Re-export ZMQ types for convenience
export type { ZmqSnapshot, ZmqCommand, ZmqResponse } from './zmq-bridge.js';
export { ZmqBridge, createZmqBridge, createZmqBridgeForPorts, isZmqAvailable } from './zmq-bridge.js';

// Re-export Named Pipe types for convenience
export type { CTraderSnapshot, CTraderCommand, CTraderResponse } from './named-pipe-client.js';
export { NamedPipeClient, createNamedPipeClient, createNamedPipeClientForInstance, isCTraderPipeAvailable } from './named-pipe-client.js';
