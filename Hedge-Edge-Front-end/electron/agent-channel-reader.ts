/**
 * Agent Data Channel Reader
 * 
 * HIGH-PERFORMANCE MESSAGING FOR TRADING TERMINALS
 * 
 * MT5: ZeroMQ (sub-millisecond latency)
 * - SUB socket subscribes to EA's PUB socket for real-time snapshots
 * - REQ socket sends commands to EA's REP socket
 * - Default ports: 51810 (data), 51811 (commands)
 * 
 * cTrader: Windows Named Pipes
 * - Data pipe receives account snapshots from cBot
 * - Command pipe sends commands to cBot
 * 
 * Architecture:
 * ┌─────────────────┐     ZeroMQ      ┌─────────────────┐
 * │   MT5 EA (ZMQ)  │ ◄─────PUB/SUB────► │  Desktop App    │
 * │  PUB: 51810     │ ◄─────REQ/REP────► │  (Electron)     │
 * │  REP: 51811     │                  │                 │
 * └─────────────────┘                  └─────────────────┘
 * 
 * ┌─────────────────┐   Named Pipes   ┌─────────────────┐
 * │ cTrader cBot    │ ◄─────────────► │  Desktop App    │
 * │ HedgeEdgeCTrader│                 │  (Electron)     │
 * └─────────────────┘                  └─────────────────┘
 */

import { promises as fs } from 'fs';
import { EventEmitter } from 'events';
import net from 'net';
import path from 'path';
import { 
  ZmqBridge, 
  createZmqBridgeForPorts, 
  isZmqAvailable,
  ZmqSnapshot,
  ZmqCommand,
  ZmqResponse,
  ZmqEvent,
  ZmqEventType,
  ZmqAccountData,
  ZmqPositionEventData,
  ZmqHeartbeatData,
  ZmqPosition,
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

// Event types for the new event-driven architecture
export interface AgentEvent {
  type: ZmqEventType;
  timestamp: string;
  platform: 'MT5' | 'cTrader';
  accountId: string;
  eventIndex?: number;
  data?: unknown;
}

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
    
    // Handle corrupted files where EA appends instead of overwrites
    // Find the first complete JSON object by matching braces
    let jsonContent = content;
    if (content.startsWith('{')) {
      let braceCount = 0;
      let endIndex = -1;
      for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      if (endIndex > 0 && endIndex < content.length) {
        console.log(`[AgentChannelReader] Truncating JSON at position ${endIndex} (file has ${content.length} chars, likely corrupted)`);
        jsonContent = content.substring(0, endIndex);
      }
    }
    
    const data = JSON.parse(jsonContent) as AgentSnapshot;
    
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

export class AgentChannelReader extends EventEmitter {
  private mt5DataPaths: Map<string, string> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastSnapshots: Map<string, AgentSnapshot> = new Map();
  private snapshotListeners: Set<(accountId: string, snapshot: AgentSnapshot) => void> = new Set();
  
  // ZMQ bridges for high-performance mode (MT5) - PRIMARY
  private zmqBridges: Map<string, ZmqBridge> = new Map();
  private zmqAvailable: boolean | null = null;
  private terminalConfigs: Map<string, TerminalConfig> = new Map();
  
  // Named Pipe clients for cTrader
  private pipeClients: Map<string, NamedPipeClient> = new Map();
  
  // Default ZMQ endpoints (match EA defaults)
  private static readonly DEFAULT_ZMQ_DATA_PORT = 51810;
  private static readonly DEFAULT_ZMQ_COMMAND_PORT = 51811;
  
  // Multi-account port ranges to scan
  // Each account uses a pair of ports: data port and command port (data + 1)
  // Default ranges: 51810-51811 (account 1), 51820-51821 (account 2), etc.
  private static readonly MULTI_ACCOUNT_PORT_RANGES: Array<{ dataPort: number; commandPort: number; name: string }> = [
    { dataPort: 51810, commandPort: 51811, name: 'mt5-account-1' },
    { dataPort: 51820, commandPort: 51821, name: 'mt5-account-2' },
    { dataPort: 51830, commandPort: 51831, name: 'mt5-account-3' },
    { dataPort: 51840, commandPort: 51841, name: 'mt5-account-4' },
    { dataPort: 51850, commandPort: 51851, name: 'mt5-account-5' },
  ];
  
  constructor() {
    super();
    // Check ZMQ availability on construction
    this.checkZmqAvailability();
    console.log('[AgentChannelReader] Initialized - ZeroMQ is PRIMARY communication method');
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
   * Get the list of port ranges to scan for multi-account support
   */
  static getMultiAccountPortRanges(): Array<{ dataPort: number; commandPort: number; name: string }> {
    return AgentChannelReader.MULTI_ACCOUNT_PORT_RANGES;
  }
  
  /**
   * Scan all configured port ranges for MT5 terminals
   * Connects to any terminal that responds on the known port ranges
   * Detection is purely event-driven via PUB/SUB (heartbeats, CONNECTED events)
   * @returns Array of terminal IDs that were successfully connected
   */
  async scanAndConnectAllMT5Terminals(): Promise<string[]> {
    const connectedTerminals: string[] = [];
    
    // Phase 1: Try to connect to all ports in parallel (SUB + REQ sockets)
    const connectionPromises = AgentChannelReader.MULTI_ACCOUNT_PORT_RANGES.map(async (portRange) => {
      // Skip if already connected to this port range
      const existingBridge = this.zmqBridges.get(portRange.name);
      if (existingBridge && existingBridge.isConnected()) {
        connectedTerminals.push(portRange.name);
        return { portRange, connected: false, existing: true };
      }
      
      // Try to connect to this port range
      try {
        const connected = await this.connectMT5(portRange.name, {
          dataPort: portRange.dataPort,
          commandPort: portRange.commandPort,
        });
        return { portRange, connected, existing: false };
      } catch (error) {
        return { portRange, connected: false, existing: false };
      }
    });
    
    const results = await Promise.all(connectionPromises);
    
    // Phase 2: Wait for PUB/SUB events (heartbeats arrive every 1-5s from the EA)
    // We must wait long enough for at least one heartbeat cycle
    const newConnections = results.filter(r => r.connected && !r.existing);
    if (newConnections.length > 0) {
      console.log(`[AgentChannelReader] Waiting for PUB/SUB events from ${newConnections.length} new connections...`);
      await new Promise(resolve => setTimeout(resolve, 7000));
    }
    
    // Phase 3: Check which connections received ANY PUB/SUB events
    // Primary detection is event-driven. PING fallback for quiet EAs.
    for (const result of results) {
      if (result.existing) continue;
      
      if (result.connected) {
        const bridge = this.zmqBridges.get(result.portRange.name);
        if (bridge) {
          const status = bridge.getStatus();
          const hasEvents = status.eventsReceived > 0;
          const hasAccountState = bridge.getCachedAccountState() !== null;
          
          if (hasEvents || hasAccountState) {
            console.log(`[AgentChannelReader] ✅ EA detected on ${result.portRange.name} via PUB/SUB (events: ${status.eventsReceived})`);
            connectedTerminals.push(result.portRange.name);
          } else {
            // No PUB events yet - try a lightweight PING to check if EA is alive
            // PING is NOT a snapshot - just a yes/no alive check via REQ/REP
            console.log(`[AgentChannelReader] No PUB events on ${result.portRange.name}, trying PING...`);
            try {
              const alive = await bridge.ping();
              if (alive) {
                console.log(`[AgentChannelReader] ✅ EA detected on ${result.portRange.name} via PING`);
                connectedTerminals.push(result.portRange.name);
                // Request initial account data in background (populates state for UI)
                this.requestInitialStateFromBridge(bridge, result.portRange.name);
              } else {
                console.log(`[AgentChannelReader] No EA on ${result.portRange.name}, disconnecting`);
                await this.disconnectMT5(result.portRange.name);
              }
            } catch {
              console.log(`[AgentChannelReader] No EA on ${result.portRange.name} (PING timeout), disconnecting`);
              await this.disconnectMT5(result.portRange.name);
            }
          }
        }
      }
    }
    
    return connectedTerminals;
  }
  
  /**
   * Request initial account state from a confirmed-alive bridge
   * Called after PING confirms EA is present but no PUB events yet
   * This is a one-time fetch to populate the UI, NOT ongoing polling
   */
  private async requestInitialStateFromBridge(bridge: ZmqBridge, terminalId: string): Promise<void> {
    try {
      const response = await bridge.sendCommand({ action: 'STATUS' });
      if (response.success && response.data) {
        const accountData = response.data as any;
        if (accountData && accountData.broker) {
          // Build an AgentSnapshot from the response
          const snapshot: AgentSnapshot = {
            timestamp: new Date().toISOString(),
            platform: 'MT5',
            accountId: accountData.accountId || '0',
            broker: accountData.broker,
            server: accountData.server,
            balance: accountData.balance ?? 0,
            equity: accountData.equity ?? 0,
            margin: accountData.margin ?? 0,
            freeMargin: accountData.freeMargin ?? 0,
            marginLevel: accountData.marginLevel ?? 0,
            floatingPnL: accountData.floatingPnL ?? 0,
            currency: accountData.currency || 'USD',
            leverage: accountData.leverage ?? 0,
            status: accountData.status || 'Active',
            isLicenseValid: accountData.isLicenseValid ?? true,
            isPaused: accountData.isPaused ?? false,
            lastError: accountData.lastError ?? null,
            positions: (accountData.positions || []).map((p: any) => ({
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
          this.lastSnapshots.set(terminalId, snapshot);
          this.notifyListeners(terminalId, snapshot);
          this.emit('accountUpdate', terminalId, snapshot);
          console.log(`[AgentChannelReader] Initial state loaded for ${terminalId}: ${snapshot.accountId} @ ${snapshot.broker}`);
        }
      }
    } catch (error) {
      console.warn(`[AgentChannelReader] Failed to get initial state for ${terminalId}:`, error instanceof Error ? error.message : error);
    }
  }
  
  /**
   * Disconnect from an MT5 terminal
   */
  async disconnectMT5(terminalId: string): Promise<void> {
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge) {
      await bridge.stop();
      this.zmqBridges.delete(terminalId);
      this.lastSnapshots.delete(terminalId);
      this.terminalConfigs.delete(terminalId);
      console.log(`[AgentChannelReader] Disconnected from ${terminalId}`);
    }
  }
  
  /**
   * Check if Named Pipes are available (cTrader cBot running)
   */
  async isCTraderAvailable(): Promise<boolean> {
    return isCTraderPipeAvailable();
  }
  
  /**
   * PREFERRED: Connect to MT5 terminal via ZeroMQ (Event-Driven)
   * This is the primary method for MT5 communication.
   * Uses event-driven architecture - NO polling or snapshots.
   * 
   * @param terminalId - Unique identifier for this terminal
   * @param options - ZMQ connection options (ports default to 51810/51811)
   * @returns true if connection successful
   */
  async connectMT5(
    terminalId: string,
    options: {
      dataPort?: number;
      commandPort?: number;
      host?: string;
    } = {}
  ): Promise<boolean> {
    const dataPort = options.dataPort || AgentChannelReader.DEFAULT_ZMQ_DATA_PORT;
    const commandPort = options.commandPort || AgentChannelReader.DEFAULT_ZMQ_COMMAND_PORT;
    const host = options.host || '127.0.0.1';
    
    console.log(`[AgentChannelReader] Connecting to MT5 via ZeroMQ (event-driven)...`);
    console.log(`  Data endpoint: tcp://${host}:${dataPort}`);
    console.log(`  Command endpoint: tcp://${host}:${commandPort}`);
    
    // Check ZMQ availability first
    if (!this.zmqAvailable) {
      await this.checkZmqAvailability();
    }
    
    if (!this.zmqAvailable) {
      console.error('[AgentChannelReader] ZeroMQ not available - install zeromq package');
      return false;
    }
    
    const config: TerminalConfig = {
      terminalId,
      platform: 'MT5',
      dataPort,
      commandPort,
      host,
      mode: 'zmq',
    };
    
    try {
      const bridge = createZmqBridgeForPorts(dataPort, commandPort, host);
      
      // Set up event-driven handlers
      this.setupEventDrivenHandlers(bridge, terminalId);
      
      // Start the bridge
      const started = await bridge.start();
      
      if (started) {
        this.zmqBridges.set(terminalId, bridge);
        this.terminalConfigs.set(terminalId, config);
        console.log(`[AgentChannelReader] ✅ Connected to MT5 ${terminalId} via ZeroMQ (event-driven)`);
        return true;
      } else {
        console.error(`[AgentChannelReader] Failed to start ZMQ bridge for ${terminalId}`);
        return false;
      }
    } catch (error) {
      console.error(`[AgentChannelReader] Error connecting to MT5 ${terminalId}:`, error);
      return false;
    }
  }
  
  /**
   * @deprecated Use connectMT5() instead - file mode is deprecated
   * Register an MT5 terminal for monitoring (legacy file mode)
   */
  registerMT5Terminal(terminalId: string, dataPath: string): void {
    console.warn(`[AgentChannelReader] ⚠️ File mode is deprecated - use connectMT5() for ZeroMQ`);
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
   * Set up event-driven handlers for the ZMQ bridge
   * This replaces snapshot polling with real-time event handling
   */
  private setupEventDrivenHandlers(bridge: ZmqBridge, terminalId: string): void {
    // Generic event handler - emits all events for subscribers
    bridge.on('event', (event: ZmqEvent) => {
      this.emit('event', terminalId, event);
    });
    
    // Connection events
    bridge.on('connected', (event: ZmqEvent) => {
      // Update cached snapshot from initial account state
      const snapshot = this.convertZmqEventToSnapshot(event);
      this.lastSnapshots.set(terminalId, snapshot);
      this.notifyListeners(terminalId, snapshot);
      this.emit('terminalConnected', terminalId, 'MT5');
    });
    
    bridge.on('disconnected', (event: ZmqEvent) => {
      this.emit('terminalDisconnected', terminalId, 'MT5');
    });
    
    bridge.on('goodbye', () => {
      this.emit('terminalDisconnected', terminalId, 'MT5');
    });
    
    // Heartbeat - real-time keepalive with metrics and positions
    // This is now a primary way to get real-time equity/position updates
    bridge.on('heartbeat', (event: ZmqEvent) => {
      // Update cached snapshot from heartbeat data (now includes positions)
      const heartbeatData = event.data as ZmqHeartbeatData;
      if (heartbeatData) {
        let existingSnapshot = this.lastSnapshots.get(terminalId);
        
        if (existingSnapshot) {
          // Update existing snapshot with heartbeat data
          existingSnapshot.balance = heartbeatData.balance;
          existingSnapshot.equity = heartbeatData.equity;
          existingSnapshot.floatingPnL = heartbeatData.profit;
          existingSnapshot.isLicenseValid = heartbeatData.isLicenseValid;
          existingSnapshot.isPaused = heartbeatData.isPaused;
          
          // Update margin info if provided
          if (heartbeatData.margin !== undefined) {
            existingSnapshot.margin = heartbeatData.margin;
          }
          if (heartbeatData.freeMargin !== undefined) {
            existingSnapshot.freeMargin = heartbeatData.freeMargin;
          }
          
          // Update positions if provided (for real-time position updates)
          if (heartbeatData.positions && heartbeatData.positions.length >= 0) {
            existingSnapshot.positions = heartbeatData.positions.map(p => ({
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
            }));
          }
          
          existingSnapshot.timestamp = event.timestamp;
          this.lastSnapshots.set(terminalId, existingSnapshot);
          this.notifyListeners(terminalId, existingSnapshot);
          
          // Emit accountUpdate so main.ts pushes to renderer
          this.emit('accountUpdate', terminalId, existingSnapshot);
        }
      }
      
      this.emit('heartbeat', terminalId, event);
    });
    
    // Account state updates
    bridge.on('accountUpdate', (event: ZmqEvent) => {
      const snapshot = this.convertZmqEventToSnapshot(event);
      this.lastSnapshots.set(terminalId, snapshot);
      this.notifyListeners(terminalId, snapshot);
      // Emit event so main.ts can update connection state and push to renderer
      this.emit('accountUpdate', terminalId, snapshot);
    });
    
    // Legacy snapshot handler for backwards compatibility
    bridge.on('snapshot', (snapshot: ZmqSnapshot) => {
      const agentSnapshot = this.convertZmqSnapshot(snapshot);
      this.lastSnapshots.set(terminalId, agentSnapshot);
      this.notifyListeners(terminalId, agentSnapshot);
      // Emit event so main.ts can update connection state and push to renderer
      this.emit('accountUpdate', terminalId, agentSnapshot);
    });
    
    // Position events - real-time trade notifications
    bridge.on('positionOpened', (event: ZmqEvent) => {
      this.emit('positionOpened', terminalId, event);
    });
    
    bridge.on('positionClosed', (event: ZmqEvent) => {
      this.emit('positionClosed', terminalId, event);
    });
    
    bridge.on('positionModified', (event: ZmqEvent) => {
      this.emit('positionModified', terminalId, event);
    });
    
    bridge.on('positionReversed', (event: ZmqEvent) => {
      this.emit('positionReversed', terminalId, event);
    });
    
    // Order events
    bridge.on('orderPlaced', (event: ZmqEvent) => {
      this.emit('orderPlaced', terminalId, event);
    });
    
    bridge.on('orderCancelled', (event: ZmqEvent) => {
      this.emit('orderCancelled', terminalId, event);
    });
    
    // Price updates (if enabled)
    bridge.on('priceUpdate', (event: ZmqEvent) => {
      this.emit('priceUpdate', terminalId, event);
    });
    
    // Pause/resume events
    bridge.on('paused', (event: ZmqEvent) => {
      this.emit('paused', terminalId, event);
    });
    
    bridge.on('resumed', (event: ZmqEvent) => {
      this.emit('resumed', terminalId, event);
    });
    
    // Error handling
    bridge.on('error', (error: Error) => {
      console.error(`[AgentChannelReader] ZMQ error for ${terminalId}:`, error.message);
      this.emit('error', terminalId, error);
    });
    
    bridge.on('status', (status: any) => {
      console.log(`[AgentChannelReader] ZMQ status for ${terminalId}:`, status.dataSocket, status.commandSocket);
      this.emit('status', terminalId, status);
    });
  }
  
  /**
   * Convert ZMQ event (from event-driven mode) to AgentSnapshot
   */
  private convertZmqEventToSnapshot(event: ZmqEvent): AgentSnapshot {
    const data = event.data as ZmqAccountData;
    return {
      timestamp: event.timestamp,
      platform: event.platform as 'MT5' | 'cTrader',
      accountId: event.accountId,
      broker: data.broker,
      server: data.server,
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      freeMargin: data.freeMargin,
      marginLevel: data.marginLevel || 0,
      floatingPnL: data.floatingPnL,
      currency: data.currency,
      leverage: data.leverage,
      status: data.status,
      isLicenseValid: data.isLicenseValid,
      isPaused: data.isPaused,
      lastError: data.lastError,
      positions: data.positions.map(p => ({
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
   * Register an MT5 terminal with ZMQ support (ZeroMQ only - no file fallback)
   * @deprecated Use connectMT5() instead
   */
  async registerMT5TerminalZmq(
    terminalId: string,
    options: {
      dataPort?: number;
      commandPort?: number;
      host?: string;
    } = {}
  ): Promise<boolean> {
    const dataPort = options.dataPort || DEFAULT_ZMQ_CONFIG.dataPort;
    const commandPort = options.commandPort || DEFAULT_ZMQ_CONFIG.commandPort;
    const host = options.host || '127.0.0.1';
    
    const config: TerminalConfig = {
      terminalId,
      platform: 'MT5',
      dataPath: undefined,
      dataPort,
      commandPort,
      host,
      mode: 'zmq',
    };
    
    this.terminalConfigs.set(terminalId, config);
    
    // ZMQ is required - no file fallback
    if (!this.zmqAvailable) {
      console.error('[AgentChannelReader] ZeroMQ not available');
      return false;
    }
    
    try {
      const bridge = createZmqBridgeForPorts(dataPort, commandPort, host);
      
      // Use the event-driven handlers
      this.setupEventDrivenHandlers(bridge, terminalId);
      
      // Try to start the bridge
      const started = await bridge.start();
      
      if (started) {
        this.zmqBridges.set(terminalId, bridge);
        console.log(`[AgentChannelReader] Registered MT5 terminal (ZeroMQ): ${terminalId}`);
        return true;
      }
    } catch (error) {
      console.warn(`[AgentChannelReader] Failed to start ZMQ bridge for ${terminalId}:`, error);
    }
    
    return false;
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
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }
  
  /**
   * Notify listeners of snapshot update
   */
  private notifyListeners(accountId: string, snapshot: AgentSnapshot): void {
    for (const listener of this.snapshotListeners) {
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
  getStats(terminalId: string): { mode: ChannelMode; platform: Platform; eventsReceived: number; commandsSent: number; connected: boolean } | null {
    const config = this.terminalConfigs.get(terminalId);
    if (!config) return null;
    
    // ZMQ bridge (MT5)
    const bridge = this.zmqBridges.get(terminalId);
    if (bridge) {
      const status = bridge.getStatus();
      return {
        mode: 'zmq',
        platform: 'MT5',
        eventsReceived: status.eventsReceived,
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
        eventsReceived: status.messagesReceived,
        commandsSent: status.commandsSent,
        connected: pipeClient.isConnected(),
      };
    }
    
    return {
      mode: 'file',
      platform: config.platform || 'MT5',
      eventsReceived: 0, // Not tracked in file mode
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
    this.snapshotListeners.clear();
    
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
