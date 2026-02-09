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

/**
 * Event types from the EA (event-driven mode)
 */
export type ZmqEventType = 
  | 'CONNECTED'        // EA started, initial account state
  | 'DISCONNECTED'     // EA shutting down
  | 'HEARTBEAT'        // Periodic keepalive with basic metrics
  | 'POSITION_OPENED'  // New position opened
  | 'POSITION_CLOSED'  // Position closed
  | 'POSITION_MODIFIED' // SL/TP changed
  | 'POSITION_REVERSED' // Position reversed (in-out)
  | 'DEAL_EXECUTED'    // Generic deal execution
  | 'ORDER_PLACED'     // Pending order placed
  | 'ORDER_CANCELLED'  // Pending order cancelled
  | 'ACCOUNT_UPDATE'   // Full account state update (after trade)
  | 'PRICE_UPDATE'     // Position price/profit update (optional high-bandwidth)
  | 'PAUSED'           // Trading paused
  | 'RESUMED';         // Trading resumed

/**
 * Base event structure from EA
 */
export interface ZmqEvent {
  type: ZmqEventType;
  eventIndex: number;
  timestamp: string;
  platform: 'MT5';
  accountId: string;
  data: unknown;
}

/**
 * Account data (sent with CONNECTED, ACCOUNT_UPDATE events)
 */
export interface ZmqAccountData {
  accountId?: string;
  accountName?: string;
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
  eventDriven: boolean;
  positions: ZmqPosition[];
}

/**
 * Heartbeat data (real-time metrics with positions for live updates)
 */
export interface ZmqHeartbeatData {
  balance: number;
  equity: number;
  profit: number;
  margin?: number;
  freeMargin?: number;
  positionCount: number;
  isLicenseValid: boolean;
  isPaused: boolean;
  positions?: ZmqPosition[];
}

/**
 * Position event data (POSITION_OPENED, POSITION_CLOSED, etc.)
 */
export interface ZmqPositionEventData {
  deal?: number;
  position: number;
  symbol: string;
  volume?: number;
  price?: number;
  profit?: number;
  type?: 'BUY' | 'SELL';
  entry?: 'IN' | 'OUT' | 'INOUT' | 'OTHER';
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * Legacy snapshot format (backwards compatibility)
 * @deprecated Use ZmqEvent with CONNECTED/ACCOUNT_UPDATE type instead
 */
export interface ZmqSnapshot {
  type: 'SNAPSHOT' | 'LICENSE_STATUS' | 'GOODBYE' | ZmqEventType;
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
  zmqMode?: boolean;
  eventDriven?: boolean;
  snapshotIndex?: number;
  eventIndex?: number;
  avgLatencyUs?: number;
  positions: ZmqPosition[];
  // Event data (when type is an event type)
  data?: unknown;
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
  action: 'PAUSE' | 'RESUME' | 'CLOSE_ALL' | 'CLOSE_POSITION' | 'OPEN_POSITION' | 'MODIFY_POSITION' | 'STATUS' | 'GET_ACCOUNT' | 'PING' | 'CONFIG' | 'GET_HISTORY';
  positionId?: string;
  params?: Record<string, unknown>;
  // OPEN_POSITION fields
  symbol?: string;
  side?: 'BUY' | 'SELL';
  volume?: number;
  sl?: number;
  tp?: number;
  magic?: number;
  comment?: string;
  deviation?: number;
  // MODIFY_POSITION fields
  ticket?: string;
}

export interface ZmqHistoryDeal {
  ticket: number;
  positionId: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry: 'IN' | 'OUT' | 'INOUT' | 'OTHER';
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  time: string;
  comment: string;
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
  // For GET_HISTORY command
  deals?: ZmqHistoryDeal[];
  accountId?: string;
  // For OPEN_POSITION command
  ticket?: string | number;
  order?: string | number;
  symbol?: string;
  side?: string;
  volume?: number;
  price?: number;
  sl?: number;
  tp?: number;
  retcode?: number;
  [key: string]: unknown;
}

export interface ZmqConfig {
  eventDriven: boolean;
  dataPort: number;
  commandPort: number;
  heartbeatIntervalMs: number;
  streamPriceUpdates: boolean;
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
  lastEvent?: Date;
  eventsReceived: number;
  commandsSent: number;
  lastError?: string;
  // Track last account state from events
  lastAccountState?: ZmqAccountData;
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
 * ZeroMQ Bridge for MT5 EA Communication (Event-Driven Mode)
 * 
 * Events emitted:
 * - 'event': Emitted for all EA events (type in event.type)
 * - 'connected': EA connected (CONNECTED event with full account state)
 * - 'disconnected': EA disconnecting (DISCONNECTED event)
 * - 'heartbeat': Periodic keepalive (HEARTBEAT event)
 * - 'positionOpened': New position opened (POSITION_OPENED event)
 * - 'positionClosed': Position closed (POSITION_CLOSED event)
 * - 'positionModified': SL/TP changed (POSITION_MODIFIED event)
 * - 'accountUpdate': Full account state update (ACCOUNT_UPDATE event)
 * - 'status': Connection status changes
 * - 'error': Errors
 * - 'snapshot': Legacy - emitted for backwards compatibility
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
  
  // Track last time any PUB/SUB message was received for liveness detection
  // ZMQ SUB sockets are stateless - they don't detect publisher disconnection.
  // We must track message receipt times to determine if the EA is still alive.
  private lastMessageReceivedAt: Date | null = null;
  private static readonly LIVENESS_TIMEOUT_MS = 8000; // 8 seconds (EA heartbeats every 1-2s)
  
  // Command queue: serializes concurrent sendCommand() calls to prevent
  // REQ/REP socket corruption. ZMQ REQ sockets enforce strict send-then-
  // receive ordering; concurrent sends corrupt the socket state.
  private commandQueue: Array<{
    command: ZmqCommand;
    resolve: (value: ZmqResponse) => void;
    reject: (reason: Error) => void;
  }> = [];
  private isProcessingQueue = false;
  
  // Cached account state (built from events)
  private cachedAccountState: ZmqAccountData | null = null;

  constructor(config: Partial<ZmqBridgeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ZMQ_CONFIG, ...config };
    this.status = {
      dataSocket: 'disconnected',
      commandSocket: 'disconnected',
      eventsReceived: 0,
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
      
      // Detection is purely event-driven via PUB/SUB
      // The EA publishes HEARTBEAT events periodically - these will populate account state
      // STATUS commands are available on-demand but NOT used for detection or startup
      
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
      // NOTE: Do NOT set receiveTimeout = 0 here. Non-blocking mode breaks
      // the `for await` async iterator in zeromq v6 beta, causing it to
      // silently receive nothing. Default (-1 = infinite wait) is correct
      // for async iteration.
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
   * Handles event-driven messages from the EA
   */
  private async startReceiving(): Promise<void> {
    if (!this.subSocket) return;

    console.log('[ZmqBridge] Starting async receive loop on SUB socket...');

    try {
      for await (const [msg] of this.subSocket) {
        if (!this.isRunning) break;
        
        try {
          const messageStr = msg.toString();
          const event = JSON.parse(messageStr) as ZmqEvent;
          
          this.status.eventsReceived++;
          this.status.lastEvent = new Date();
          this.lastMessageReceivedAt = new Date();

          if (this.status.eventsReceived === 1) {
            console.log(`[ZmqBridge] First PUB message received! (${messageStr.length} bytes, type: ${event.type})`);
          }
          
          // Handle event-driven message types
          this.handleEvent(event);
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
   * Convert a legacy SNAPSHOT/GOODBYE message from the EA into event-driven format.
   * The EA publishes account data at the top level with "type":"SNAPSHOT".
   * The bridge expects "type":"CONNECTED"/"ACCOUNT_UPDATE" with data in a nested field.
   */
  private normalizeEAMessage(raw: any): ZmqEvent {
    const messageType: string = raw.type || 'SNAPSHOT';
    
    // Already in event-driven format (has a `data` field and known event type)
    if (raw.data !== undefined && ['CONNECTED', 'DISCONNECTED', 'HEARTBEAT', 
        'POSITION_OPENED', 'POSITION_CLOSED', 'POSITION_MODIFIED', 'POSITION_REVERSED',
        'DEAL_EXECUTED', 'ORDER_PLACED', 'ORDER_CANCELLED', 'ACCOUNT_UPDATE',
        'PRICE_UPDATE', 'PAUSED', 'RESUMED'].includes(messageType)) {
      return raw as ZmqEvent;
    }
    
    // Legacy SNAPSHOT/GOODBYE format: account data is at top level
    // Extract account data from top-level fields into a nested `data` field
    const accountData: ZmqAccountData = {
      accountId: raw.accountId,
      accountName: raw.accountName,
      broker: raw.broker || '',
      server: raw.server,
      balance: raw.balance ?? 0,
      equity: raw.equity ?? 0,
      margin: raw.margin ?? 0,
      freeMargin: raw.freeMargin ?? 0,
      marginLevel: raw.marginLevel ?? null,
      floatingPnL: raw.floatingPnL ?? 0,
      currency: raw.currency || 'USD',
      leverage: raw.leverage ?? 0,
      status: raw.status || 'Active',
      isLicenseValid: raw.isLicenseValid ?? true,
      isPaused: raw.isPaused ?? false,
      lastError: raw.lastError ?? null,
      eventDriven: raw.eventDriven ?? false,
      positions: raw.positions || [],
    };
    
    // Map legacy type to event type
    let eventType: ZmqEventType;
    if (messageType === 'GOODBYE') {
      eventType = 'DISCONNECTED';
    } else if (!this.cachedAccountState) {
      // First SNAPSHOT = CONNECTED
      eventType = 'CONNECTED';
    } else {
      // Subsequent SNAPSHOTs = ACCOUNT_UPDATE (contains full state including positions)
      eventType = 'ACCOUNT_UPDATE';
    }
    
    return {
      type: eventType,
      eventIndex: raw.snapshotIndex ?? raw.eventIndex ?? 0,
      timestamp: raw.timestamp || new Date().toISOString(),
      platform: 'MT5',
      accountId: raw.accountId || '0',
      data: accountData,
    };
  }

  /**
   * Handle an event from the EA
   */
  private handleEvent(rawEvent: ZmqEvent): void {
    // Normalize legacy SNAPSHOT format to event-driven format
    const event = this.normalizeEAMessage(rawEvent);
    
    // Emit generic event
    this.emit('event', event);
    
    // Handle specific event types
    switch (event.type) {
      case 'CONNECTED':
        console.log('[ZmqBridge] EA connected - received initial account state');
        this.cachedAccountState = event.data as ZmqAccountData;
        this.status.lastAccountState = this.cachedAccountState;
        this.emit('connected', event);
        break;
        
      case 'DISCONNECTED':
        console.log('[ZmqBridge] EA disconnecting');
        this.emit('disconnected', event);
        this.emit('goodbye', event);
        break;
        
      case 'HEARTBEAT':
        // Silently update cached metrics - no log, no push to UI
        // Heartbeats are just keepalives; UI refreshes on 30s timer or manual
        this.updateFromHeartbeat(event.data as ZmqHeartbeatData);
        this.emit('heartbeat', event);
        break;
        
      case 'ACCOUNT_UPDATE': {
        // Diff positions to detect opens/closes from legacy SNAPSHOT messages.
        // The EA doesn't send discrete POSITION_OPENED / POSITION_CLOSED events;
        // it re-publishes a full snapshot after every trade transaction.
        const newState = event.data as ZmqAccountData;
        const oldPositions = this.cachedAccountState?.positions ?? [];
        const newPositions = newState.positions ?? [];

        const oldIds = new Set(oldPositions.map(p => p.id));
        const newIds = new Set(newPositions.map(p => p.id));

        // Positions present before but missing now → closed
        for (const pos of oldPositions) {
          if (!newIds.has(pos.id)) {
            const closedEvent: ZmqEvent = {
              type: 'POSITION_CLOSED',
              eventIndex: event.eventIndex,
              timestamp: event.timestamp,
              platform: event.platform || 'MT5',
              accountId: event.accountId,
              data: {
                position: Number(pos.id) || 0,
                symbol: pos.symbol,
                volume: pos.volumeLots ?? pos.volume,
                price: pos.currentPrice,
                profit: pos.profit + (pos.swap ?? 0) + (pos.commission ?? 0),
                type: pos.side as 'BUY' | 'SELL',
                entry: 'OUT' as const,
                stopLoss: pos.stopLoss ?? undefined,
                takeProfit: pos.takeProfit ?? undefined,
              } as ZmqPositionEventData,
            };
            console.log(`[ZmqBridge] Position closed (diff): ${pos.symbol} #${pos.id}  profit=${pos.profit}`);
            this.emit('positionClosed', closedEvent);
          }
        }

        // Positions absent before but present now → opened
        for (const pos of newPositions) {
          if (!oldIds.has(pos.id)) {
            const openedEvent: ZmqEvent = {
              type: 'POSITION_OPENED',
              eventIndex: event.eventIndex,
              timestamp: event.timestamp,
              platform: event.platform || 'MT5',
              accountId: event.accountId,
              data: {
                position: Number(pos.id) || 0,
                symbol: pos.symbol,
                volume: pos.volumeLots ?? pos.volume,
                price: pos.entryPrice,
                profit: pos.profit,
                type: pos.side as 'BUY' | 'SELL',
                entry: 'IN' as const,
                stopLoss: pos.stopLoss ?? undefined,
                takeProfit: pos.takeProfit ?? undefined,
              } as ZmqPositionEventData,
            };
            console.log(`[ZmqBridge] Position opened (diff): ${pos.symbol} #${pos.id}`);
            this.emit('positionOpened', openedEvent);
          }
        }

        // Now update cached state
        this.cachedAccountState = newState;
        this.status.lastAccountState = this.cachedAccountState;
        this.emit('accountUpdate', event);
        break;
      }
        
      case 'POSITION_OPENED':
        // TRADE EVENT - log and emit immediately (triggers hedge logic)
        console.log('[ZmqBridge] Position opened:', (event.data as ZmqPositionEventData).position);
        this.emit('positionOpened', event);
        break;
        
      case 'POSITION_CLOSED':
        // TRADE EVENT - log and emit immediately (triggers hedge logic)
        console.log('[ZmqBridge] Position closed:', (event.data as ZmqPositionEventData).position);
        this.emit('positionClosed', event);
        break;
        
      case 'POSITION_MODIFIED':
        // TRADE EVENT - log and emit immediately
        console.log('[ZmqBridge] Position modified:', (event.data as ZmqPositionEventData).position);
        this.emit('positionModified', event);
        break;
        
      case 'POSITION_REVERSED':
        // TRADE EVENT - log and emit immediately
        console.log('[ZmqBridge] Position reversed:', (event.data as ZmqPositionEventData).position);
        this.emit('positionReversed', event);
        break;
        
      case 'ORDER_PLACED':
        this.emit('orderPlaced', event);
        break;
        
      case 'ORDER_CANCELLED':
        this.emit('orderCancelled', event);
        break;
        
      case 'PRICE_UPDATE':
        // Price updates are cached silently - no emit to avoid flooding
        // UI reads from cached state on refresh
        break;
        
      case 'PAUSED':
        console.log('[ZmqBridge] Trading paused');
        this.emit('paused', event);
        break;
        
      case 'RESUMED':
        console.log('[ZmqBridge] Trading resumed');
        this.emit('resumed', event);
        break;
        
      default:
        // Unknown event type - silently ignore
        break;
    }
  }
  
  /**
   * Update cached account state from heartbeat (now includes positions for real-time updates)
   */
  private updateFromHeartbeat(heartbeat: ZmqHeartbeatData): void {
    if (this.cachedAccountState) {
      this.cachedAccountState.balance = heartbeat.balance;
      this.cachedAccountState.equity = heartbeat.equity;
      this.cachedAccountState.floatingPnL = heartbeat.profit;
      this.cachedAccountState.isLicenseValid = heartbeat.isLicenseValid;
      this.cachedAccountState.isPaused = heartbeat.isPaused;
      
      // Update margin info if provided
      if (heartbeat.margin !== undefined) {
        this.cachedAccountState.margin = heartbeat.margin;
      }
      if (heartbeat.freeMargin !== undefined) {
        this.cachedAccountState.freeMargin = heartbeat.freeMargin;
      }
      
      // Update positions if provided (for real-time position updates)
      if (heartbeat.positions && heartbeat.positions.length >= 0) {
        this.cachedAccountState.positions = heartbeat.positions;
      }
      
      this.status.lastAccountState = this.cachedAccountState;
    }
  }
  
  /**
   * Request initial account state from EA
   * Called after connection to ensure we have account data even if we connected after EA init
   */
  private async requestInitialState(): Promise<void> {
    try {
      console.log('[ZmqBridge] Requesting initial account state...');
      
      // Brief delay to let sockets fully establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await this.sendCommand({ action: 'STATUS' });
      
      if (response.success && response.data) {
        console.log('[ZmqBridge] Received initial account state');
        
        // Parse the account data from the response
        const accountData = response.data as ZmqAccountData;
        
        if (accountData && accountData.broker) {
          this.cachedAccountState = accountData;
          this.status.lastAccountState = accountData;
          
          // Get accountId from the account data (EA now includes it)
          const accountId = accountData.accountId || '0';
          
          // Build a synthetic CONNECTED event and emit it
          const syntheticEvent: ZmqEvent = {
            type: 'CONNECTED',
            eventIndex: 0,
            timestamp: new Date().toISOString(),
            platform: 'MT5',
            accountId: accountId,
            data: accountData,
          };
          
          // Emit the connected event so agent-channel-reader can update its snapshot
          this.emit('connected', syntheticEvent);
          this.emit('event', syntheticEvent);
          
          // Also emit legacy snapshot for backwards compatibility
          const legacySnapshot = this.buildLegacySnapshot(syntheticEvent);
          this.emit('snapshot', legacySnapshot);
          
          console.log('[ZmqBridge] Initial state loaded - Account ID:', accountId, 'Broker:', accountData.broker);
        }
      } else {
        console.log('[ZmqBridge] No initial state available from STATUS command');
      }
    } catch (error) {
      console.warn('[ZmqBridge] Failed to request initial state:', error instanceof Error ? error.message : error);
      // This is not fatal - events will still come through when things change
    }
  }
  
  /**
   * Build a legacy snapshot from an event (backwards compatibility)
   */
  private buildLegacySnapshot(event: ZmqEvent): ZmqSnapshot {
    const data = event.data as ZmqAccountData;
    return {
      type: event.type as any,
      timestamp: event.timestamp,
      platform: event.platform,
      accountId: event.accountId,
      broker: data.broker,
      server: data.server,
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      freeMargin: data.freeMargin,
      marginLevel: data.marginLevel,
      floatingPnL: data.floatingPnL,
      currency: data.currency,
      leverage: data.leverage,
      status: data.status,
      isLicenseValid: data.isLicenseValid,
      isPaused: data.isPaused,
      lastError: data.lastError,
      eventDriven: true,
      eventIndex: event.eventIndex,
      positions: data.positions,
      data: event.data,
    };
  }
  
  /**
   * Get cached account state
   */
  getCachedAccountState(): ZmqAccountData | null {
    return this.cachedAccountState;
  }

  /**
   * Send a command via the queue (safe for concurrent callers).
   * Commands are serialized: each waits for the previous to complete
   * before being sent on the REQ/REP socket.
   */
  async sendCommand(command: ZmqCommand): Promise<ZmqResponse> {
    if (!this.isRunning || !this.reqSocket) {
      throw new Error('ZMQ bridge not running');
    }

    if (this.status.commandSocket !== 'connected') {
      throw new Error('Command socket not connected');
    }

    // Enqueue and process serially
    return new Promise<ZmqResponse>((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      this.processCommandQueue();
    });
  }

  /**
   * Process the command queue one-at-a-time.
   * Only one REQ/REP exchange happens at any time.
   */
  private async processCommandQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift()!;
      try {
        const result = await this.executeCommand(item.command);
        item.resolve(result);
      } catch (err) {
        item.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single command on the REQ/REP socket.
   * Private — callers should use sendCommand() which goes through the queue.
   */
  private executeCommand(command: ZmqCommand): Promise<ZmqResponse> {
    return new Promise((resolve, reject) => {
      if (!this.reqSocket) {
        return reject(new Error('REQ socket not available'));
      }

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
   * Send OPEN_POSITION command to open a new trade
   */
  async openPosition(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    sl?: number;
    tp?: number;
    magic?: number;
    comment?: string;
    deviation?: number;
  }): Promise<ZmqResponse> {
    return this.sendCommand({
      action: 'OPEN_POSITION',
      symbol: params.symbol,
      side: params.side,
      volume: params.volume,
      sl: params.sl,
      tp: params.tp,
      magic: params.magic,
      comment: params.comment,
      deviation: params.deviation,
    });
  }

  /**
   * Send MODIFY_POSITION command to change SL/TP
   */
  async modifyPosition(ticket: string, sl?: number, tp?: number): Promise<ZmqResponse> {
    return this.sendCommand({
      action: 'MODIFY_POSITION',
      ticket,
      sl,
      tp,
    });
  }

  /**
   * Get historical deal data from MT5
   * @param days Number of days of history to fetch (default 30)
   */
  async getHistory(days: number = 30): Promise<{ deals: ZmqHistoryDeal[]; accountId?: string }> {
    try {
      const response = await this.sendCommand({ action: 'GET_HISTORY', params: { days } });
      if (response.success && Array.isArray(response.deals)) {
        console.log(`[ZmqBridge] Received ${response.deals.length} historical deals, accountId=${response.accountId}`);
        return { deals: response.deals as ZmqHistoryDeal[], accountId: response.accountId };
      }
      console.warn('[ZmqBridge] GET_HISTORY returned no deals:', response.error || 'unknown');
      return { deals: [] };
    } catch (err) {
      console.error('[ZmqBridge] GET_HISTORY failed:', err);
      return { deals: [] };
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

    // Reject all queued commands
    for (const item of this.commandQueue) {
      item.reject(new Error('Bridge stopped'));
    }
    this.commandQueue = [];
    this.isProcessingQueue = false;

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
   * Check if bridge sockets are open (does NOT guarantee EA is alive)
   * For liveness, use isAlive() which also checks message freshness.
   */
  isConnected(): boolean {
    return (
      this.isRunning &&
      this.status.dataSocket === 'connected' &&
      this.status.commandSocket === 'connected'
    );
  }
  
  /**
   * Check if the EA is actually alive (connected + receiving messages recently)
   * ZMQ SUB sockets are stateless — they stay "connected" even if the publisher
   * (MT5 EA) stops. This method checks whether we've received any PUB message
   * within the liveness timeout window.
   */
  isAlive(): boolean {
    if (!this.isConnected()) return false;
    if (!this.lastMessageReceivedAt) return false;
    const age = Date.now() - this.lastMessageReceivedAt.getTime();
    return age < ZmqBridge.LIVENESS_TIMEOUT_MS;
  }
  
  /**
   * Get the timestamp of the last received message (for external staleness checks)
   */
  getLastMessageTime(): Date | null {
    return this.lastMessageReceivedAt;
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
