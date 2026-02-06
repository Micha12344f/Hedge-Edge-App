/**
 * Mock API Responses for Front-End Testing
 * =========================================
 * Simulated API response structures for testing without backend.
 */

// ============================================================================
// Response Wrapper Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  processingTime: number;
}

// ============================================================================
// Mock Response Generators
// ============================================================================

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(data: T, processingTime = 150): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      processingTime,
    },
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      processingTime: 50,
    },
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Common Error Responses
// ============================================================================

export const mockErrors = {
  unauthorized: createErrorResponse(
    'UNAUTHORIZED',
    'Authentication required. Please log in to continue.'
  ),
  
  forbidden: createErrorResponse(
    'FORBIDDEN',
    'You do not have permission to perform this action.'
  ),
  
  notFound: createErrorResponse(
    'NOT_FOUND',
    'The requested resource was not found.'
  ),
  
  validation: (field: string, message: string) => createErrorResponse(
    'VALIDATION_ERROR',
    message,
    { field }
  ),
  
  rateLimit: createErrorResponse(
    'RATE_LIMITED',
    'Too many requests. Please wait before trying again.',
    { retryAfter: 60 }
  ),
  
  serverError: createErrorResponse(
    'INTERNAL_ERROR',
    'An unexpected error occurred. Please try again later.'
  ),
  
  networkError: createErrorResponse(
    'NETWORK_ERROR',
    'Unable to connect to the server. Please check your internet connection.'
  ),
  
  licenseInvalid: createErrorResponse(
    'LICENSE_INVALID',
    'Your license key is invalid or has been revoked.'
  ),
  
  licenseExpired: createErrorResponse(
    'LICENSE_EXPIRED',
    'Your license has expired. Please renew to continue.'
  ),
  
  deviceLimitReached: createErrorResponse(
    'DEVICE_LIMIT',
    'Maximum device limit reached. Please deactivate another device first.',
    { maxDevices: 5, currentDevices: 5 }
  ),
  
  connectionFailed: createErrorResponse(
    'CONNECTION_FAILED',
    'Unable to connect to the trading terminal. Please ensure it is running.'
  ),
};

// ============================================================================
// Mock API Delay Simulator
// ============================================================================

export interface MockApiOptions {
  /** Simulated network delay in ms (default: 500) */
  delay?: number;
  /** Probability of failure (0-1, default: 0) */
  failureRate?: number;
  /** Custom error to return on failure */
  failureError?: ApiResponse<never>;
}

/**
 * Simulate an API call with configurable delay and failure
 */
export async function simulateApiCall<T>(
  data: T,
  options: MockApiOptions = {}
): Promise<ApiResponse<T>> {
  const { 
    delay = 500, 
    failureRate = 0, 
    failureError = mockErrors.serverError 
  } = options;
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Simulate random failure
  if (Math.random() < failureRate) {
    return failureError as ApiResponse<T>;
  }
  
  return createSuccessResponse(data, delay);
}

// ============================================================================
// Specific Mock Endpoints
// ============================================================================

export const mockApi = {
  /**
   * Mock: Get account list
   */
  async getAccounts() {
    const { mockAccounts } = await import('./accounts');
    return simulateApiCall(Object.values(mockAccounts).map(a => ({
      id: a.id,
      email: a.email,
      name: a.fullName,
      tier: a.metadata.subscriptionTier,
    })));
  },
  
  /**
   * Mock: Get positions for an account
   */
  async getPositions(accountId: string) {
    const { mockPositions } = await import('./positions');
    return simulateApiCall(mockPositions, { delay: 300 });
  },
  
  /**
   * Mock: Get hedge mappings
   */
  async getHedges() {
    const { mockHedges } = await import('./hedges');
    return simulateApiCall(mockHedges, { delay: 400 });
  },
  
  /**
   * Mock: Validate license
   */
  async validateLicense(key: string) {
    const { mockLicenses } = await import('./licenses');
    
    if (key.startsWith('INVALID')) {
      return simulateApiCall(null, {
        delay: 800,
        failureRate: 1,
        failureError: mockErrors.licenseInvalid,
      });
    }
    
    if (key.startsWith('EXPIRED')) {
      return simulateApiCall(mockLicenses.expired, { delay: 800 });
    }
    
    return simulateApiCall(mockLicenses.valid, { delay: 800 });
  },
  
  /**
   * Mock: Connect to terminal
   */
  async connectTerminal(accountId: string, credentials: unknown) {
    // Simulate connection with possible failure
    return simulateApiCall(
      { connected: true, accountId },
      { delay: 2000, failureRate: 0.1, failureError: mockErrors.connectionFailed }
    );
  },
  
  /**
   * Mock: Create hedge
   */
  async createHedge(hedgeData: unknown) {
    const { generateHedgeId } = await import('./hedges');
    return simulateApiCall(
      { id: generateHedgeId(), ...hedgeData as object },
      { delay: 600 }
    );
  },
};

// ============================================================================
// WebSocket Mock (for real-time data simulation)
// ============================================================================

export interface MockWebSocketOptions {
  /** Interval between updates in ms */
  updateInterval?: number;
  /** Callback for position updates */
  onPositionUpdate?: (positions: unknown[]) => void;
  /** Callback for metrics updates */
  onMetricsUpdate?: (metrics: unknown) => void;
}

/**
 * Create a mock WebSocket-like connection for real-time data
 */
export function createMockWebSocket(options: MockWebSocketOptions = {}) {
  const { updateInterval = 1000, onPositionUpdate, onMetricsUpdate } = options;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  
  return {
    connect() {
      console.log('[MockWS] Connected');
      
      intervalId = setInterval(async () => {
        const { mockPositions } = await import('./positions');
        const { mockMetrics } = await import('./positions');
        
        // Add slight random variation to simulate live data
        const updatedPositions = mockPositions.map(p => ({
          ...p,
          currentPrice: p.currentPrice * (1 + (Math.random() - 0.5) * 0.0001),
          profit: p.profit + (Math.random() - 0.5) * 5,
        }));
        
        onPositionUpdate?.(updatedPositions);
        onMetricsUpdate?.(mockMetrics.medium);
      }, updateInterval);
    },
    
    disconnect() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      console.log('[MockWS] Disconnected');
    },
    
    isConnected() {
      return intervalId !== null;
    },
  };
}
