/**
 * ZeroMQ Bridge for MT5 Communication
 * 
 * High-performance messaging bridge between Hedge Edge Electron app and MT5 EAs.
 * Replaces file-based IPC with ZeroMQ for sub-millisecond latency.
 * 
 * Architecture:
 * - SUB socket: Subscribes to account snapshots from EA (tcp://127.0.0.1:51810)
 * - REQ socket: Sends commands to EA and receives responses (tcp://127.0.0.1:51811)
 */

import { EventEmitter } from 'events';

// ZeroMQ type definitions (zeromq is an optional peer dependency)
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ZmqTypes {
  export interface Subscriber {
    receiveTimeout: number;
    linger: number;
    connect(endpoint: string): void;
    subscribe(filter: string): void;
    close(): void;
    [Symbol.asyncIterator](): AsyncIterableIterator<[Buffer]>;
  }
  export interface Request {
    sendTimeout: number;
    receiveTimeout: number;
    linger: number;
    connect(endpoint: string): void;
    send(message: string): Promise<void>;
    receive(): Promise<[Buffer]>;
    close(): void;
  }
  export interface ZmqModule {
    Subscriber: new () => Subscriber;
    Request: new () => Request;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ZmqSnapshot {
  type: 'SNAPSHOT' | 'LICENSE_STATUS' | 'GOODBYE';
  timestamp: string;
  platform: 'MT5';
  accountId: string;
  broker: string;
  server?: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  floatingPnL: number;
  currency: string;
  leverage: number;
  status: string;
  isLicenseValid: boolean;
  isPaused: boolean;
  lastError: string | null;
  zmqMode: boolean;
  snapshotIndex: number;
  avgLatencyUs: number;
  positions: ZmqPosition[];
}

export interface ZmqPosition {
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

export interface ZmqCommand {
  action: 'PAUSE' | 'RESUME' | 'CLOSE_ALL' | 'CLOSE_POSITION' | 'STATUS' | 'PING' | 'CONFIG';
  positionId?: string;
  params?: Record<string, unknown>;
}

export interface ZmqResponse {
  success: boolean;
  status?: string;
  error?: string;
  closedCount?: number;
  errors?: string;
  pong?: boolean;
  config?: ZmqConfig;
  // For STATUS command, includes full snapshot
  type?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ZmqConfig {
  zmqEnabled: boolean;
  dataPort: number;
  commandPort: number;
  publishIntervalMs: number;
  licenseCheckIntervalSec: number;
}

export interface ZmqBridgeConfig {
  dataHost: string;
  dataPort: number;
  commandHost: string;
  commandPort: number;
  subscribeFilter?: string;
  reconnectIntervalMs?: number;
  commandTimeoutMs?: number;
}

export interface ZmqConnectionStatus {
  dataSocket: 'disconnected' | 'connecting' | 'connected' | 'error';
  commandSocket: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastSnapshot?: Date;
  snapshotsReceived: number;
  commandsSent: number;
  lastError?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ZMQ_CONFIG: ZmqBridgeConfig = {
  dataHost: '127.0.0.1',
  dataPort: 51810,
  commandHost: '127.0.0.1',
  commandPort: 51811,
  subscribeFilter: '',
  reconnectIntervalMs: 5000,
  commandTimeoutMs: 5000,
};

// ============================================================================
// ZMQ Bridge Class
// ============================================================================

/**
 * ZeroMQ Bridge for MT5 EA Communication
 * 
 * Events:
 * - 'snapshot': Emitted when a new account snapshot is received
 * - 'status': Emitted when connection status changes
 * - 'error': Emitted on errors
 * - 'goodbye': Emitted when EA sends goodbye message (shutting down)
 */
export class ZmqBridge extends EventEmitter {
  private config: ZmqBridgeConfig;
  private status: ZmqConnectionStatus;
  
  // ZeroMQ sockets (will be initialized dynamically)
  private subSocket: any = null;
  private reqSocket: any = null;
  private zmq: any = null;
  
  private isRunning = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pendingCommand: {
    resolve: (value: ZmqResponse) => void;
    reject: (reason: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  constructor(config: Partial<ZmqBridgeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ZMQ_CONFIG, ...config };
    this.status = {
      dataSocket: 'disconnected',
      commandSocket: 'disconnected',
      snapshotsReceived: 0,
      commandsSent: 0,
    };
  }

  /**
   * Initialize and start the ZMQ bridge
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log('[ZmqBridge] Already running');
      return true;
    }

    try {
      // Dynamically import zeromq (optional peer dependency)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.zmq = await import(/* webpackIgnore: true */ 'zeromq') as ZmqTypes.ZmqModule;
      
      console.log('[ZmqBridge] Starting ZeroMQ bridge...');
      console.log(`[ZmqBridge] Data endpoint: tcp://${this.config.dataHost}:${this.config.dataPort}`);
      console.log(`[ZmqBridge] Command endpoint: tcp://${this.config.commandHost}:${this.config.commandPort}`);

      // Create SUB socket for receiving snapshots
      await this.connectDataSocket();
      
      // Create REQ socket for sending commands
      await this.connectCommandSocket();
      
      this.isRunning = true;
      this.emitStatus();
      
      console.log('[ZmqBridge] Started successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ZmqBridge] Failed to start:', errorMessage);
      this.status.lastError = errorMessage;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Connect the data subscription socket
   */
  private async connectDataSocket(): Promise<void> {
    try {
      this.status.dataSocket = 'connecting';
      this.emitStatus();

      this.subSocket = new this.zmq.Subscriber();
      
      // Configure socket options
      this.subSocket.receiveTimeout = 0; // Non-blocking
      this.subSocket.linger = 0;
      
      // Connect to EA's PUB socket
      const endpoint = `tcp://${this.config.dataHost}:${this.config.dataPort}`;
      this.subSocket.connect(endpoint);
      
      // Subscribe to all messages (or specific filter)
      this.subSocket.subscribe(this.config.subscribeFilter || '');
      
      this.status.dataSocket = 'connected';
      console.log(`[ZmqBridge] Data socket connected to ${endpoint}`);
      
      // Start receiving messages
      this.startReceiving();
    } catch (error) {
      this.status.dataSocket = 'error';
      throw error;
    }
  }

  /**
   * Connect the command request socket
   */
  private async connectCommandSocket(): Promise<void> {
    try {
      this.status.commandSocket = 'connecting';
      this.emitStatus();

      this.reqSocket = new this.zmq.Request();
      
      // Configure socket options
      this.reqSocket.sendTimeout = this.config.commandTimeoutMs;
      this.reqSocket.receiveTimeout = this.config.commandTimeoutMs;
      this.reqSocket.linger = 0;
      
      // Connect to EA's REP socket
      const endpoint = `tcp://${this.config.commandHost}:${this.config.commandPort}`;
      this.reqSocket.connect(endpoint);
      
      this.status.commandSocket = 'connected';
      console.log(`[ZmqBridge] Command socket connected to ${endpoint}`);
    } catch (error) {
      this.status.commandSocket = 'error';
      throw error;
    }
  }

  /**
   * Start receiving messages from the SUB socket
   */
  private async startReceiving(): Promise<void> {
    if (!this.subSocket) return;

    try {
      for await (const [msg] of this.subSocket) {
        if (!this.isRunning) break;
        
        try {
          const messageStr = msg.toString();
          const snapshot = JSON.parse(messageStr) as ZmqSnapshot;
          
          this.status.snapshotsReceived++;
          this.status.lastSnapshot = new Date();
          
          // Handle different message types
          if (snapshot.type === 'GOODBYE') {
            console.log('[ZmqBridge] Received GOODBYE from EA');
            this.emit('goodbye', snapshot);
          } else if (snapshot.type === 'LICENSE_STATUS') {
            this.emit('licenseStatus', snapshot);
          } else {
            this.emit('snapshot', snapshot);
          }
        } catch (parseError) {
          console.warn('[ZmqBridge] Failed to parse message:', parseError);
        }
      }
    } catch (error) {
      if (this.isRunning) {
        console.error('[ZmqBridge] Receive error:', error);
        this.status.dataSocket = 'error';
        this.status.lastError = error instanceof Error ? error.message : 'Receive error';
        this.emitStatus();
        
        // Schedule reconnect
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Send a command to the EA and wait for response
   */
  async sendCommand(command: ZmqCommand): Promise<ZmqResponse> {
    if (!this.isRunning || !this.reqSocket) {
      throw new Error('ZMQ bridge not running');
    }

    if (this.status.commandSocket !== 'connected') {
      throw new Error('Command socket not connected');
    }

    // Ensure only one command at a time (REQ/REP pattern)
    if (this.pendingCommand) {
      throw new Error('Another command is pending');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommand = null;
        reject(new Error('Command timeout'));
      }, this.config.commandTimeoutMs);

      this.pendingCommand = { resolve, reject, timeout };

      const commandJson = JSON.stringify(command);
      console.log('[ZmqBridge] Sending command:', command.action);

      this.reqSocket.send(commandJson)
        .then(() => this.reqSocket.receive())
        .then(([response]: [Buffer]) => {
          clearTimeout(timeout);
          this.pendingCommand = null;
          this.status.commandsSent++;
          
          try {
            const responseData = JSON.parse(response.toString()) as ZmqResponse;
            console.log('[ZmqBridge] Command response:', responseData.success ? 'success' : 'failed');
            resolve(responseData);
          } catch (parseError) {
            reject(new Error('Failed to parse command response'));
          }
        })
        .catch((error: Error) => {
          clearTimeout(timeout);
          this.pendingCommand = null;
          console.error('[ZmqBridge] Command error:', error);
          reject(error);
        });
    });
  }

  /**
   * Send PAUSE command
   */
  async pause(): Promise<ZmqResponse> {
    return this.sendCommand({ action: 'PAUSE' });
  }

  /**
   * Send RESUME command
   */
  async resume(): Promise<ZmqResponse> {
    return this.sendCommand({ action: 'RESUME' });
  }

  /**
   * Send CLOSE_ALL command
   */
  async closeAll(): Promise<ZmqResponse> {
    return this.sendCommand({ action: 'CLOSE_ALL' });
  }

  /**
   * Send CLOSE_POSITION command
   */
  async closePosition(positionId: string): Promise<ZmqResponse> {
    return this.sendCommand({ action: 'CLOSE_POSITION', positionId });
  }

  /**
   * Send STATUS command (get current snapshot)
   */
  async requestStatus(): Promise<ZmqResponse> {
    return this.sendCommand({ action: 'STATUS' });
  }

  /**
   * Send PING command
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendCommand({ action: 'PING' });
      return response.success && response.pong === true;
    } catch {
      return false;
    }
  }

  /**
   * Get EA configuration
   */
  async getConfig(): Promise<ZmqConfig | null> {
    try {
      const response = await this.sendCommand({ action: 'CONFIG' });
      return response.success ? response.config || null : null;
    } catch {
      return null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      console.log('[ZmqBridge] Attempting reconnect...');
      
      // Close existing sockets
      await this.closeSockets();
      
      // Reconnect
      try {
        await this.connectDataSocket();
        await this.connectCommandSocket();
        this.emitStatus();
      } catch (error) {
        console.error('[ZmqBridge] Reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, this.config.reconnectIntervalMs);
  }

  /**
   * Close all sockets
   */
  private async closeSockets(): Promise<void> {
    if (this.subSocket) {
      try {
        this.subSocket.close();
      } catch (e) {
        // Ignore close errors
      }
      this.subSocket = null;
    }

    if (this.reqSocket) {
      try {
        this.reqSocket.close();
      } catch (e) {
        // Ignore close errors
      }
      this.reqSocket = null;
    }
  }

  /**
   * Stop the ZMQ bridge
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[ZmqBridge] Stopping...');
    this.isRunning = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pendingCommand) {
      clearTimeout(this.pendingCommand.timeout);
      this.pendingCommand.reject(new Error('Bridge stopped'));
      this.pendingCommand = null;
    }

    await this.closeSockets();

    this.status.dataSocket = 'disconnected';
    this.status.commandSocket = 'disconnected';
    this.emitStatus();

    console.log('[ZmqBridge] Stopped');
  }

  /**
   * Get current connection status
   */
  getStatus(): ZmqConnectionStatus {
    return { ...this.status };
  }

  /**
   * Check if bridge is connected and ready
   */
  isConnected(): boolean {
    return (
      this.isRunning &&
      this.status.dataSocket === 'connected' &&
      this.status.commandSocket === 'connected'
    );
  }

  /**
   * Emit status change event
   */
  private emitStatus(): void {
    this.emit('status', this.getStatus());
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ZMQ bridge with default configuration
 */
export function createZmqBridge(config?: Partial<ZmqBridgeConfig>): ZmqBridge {
  return new ZmqBridge(config);
}

/**
 * Create a ZMQ bridge for a specific port pair
 */
export function createZmqBridgeForPorts(
  dataPort: number,
  commandPort: number,
  host = '127.0.0.1'
): ZmqBridge {
  return new ZmqBridge({
    dataHost: host,
    dataPort,
    commandHost: host,
    commandPort,
  });
}

// ============================================================================
// ZMQ Availability Check
// ============================================================================

let zmqAvailable: boolean | null = null;

/**
 * Check if ZeroMQ is available in the current environment
 */
export async function isZmqAvailable(): Promise<boolean> {
  if (zmqAvailable !== null) {
    return zmqAvailable;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await import(/* webpackIgnore: true */ 'zeromq');
    zmqAvailable = true;
    console.log('[ZmqBridge] ZeroMQ is available');
  } catch {
    zmqAvailable = false;
    console.log('[ZmqBridge] ZeroMQ is not available');
  }

  return zmqAvailable;
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  ZmqSnapshot as ZmqAgentSnapshot,
  ZmqPosition as ZmqAgentPosition,
};
