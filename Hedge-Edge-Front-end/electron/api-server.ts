/**
 * Embedded License API Server for HedgeEdge Desktop App
 * 
 * Runs on localhost:3002 to provide license validation endpoint
 * Calls Creem API directly - no dependency on external servers
 * 
 * Endpoints:
 * - POST /api/validate-license (validate a license key)
 * - GET /api/health (server health check)
 */

import express, { Express, Request, Response } from 'express';
import { app as electronApp } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// Get the directory of this file for finding .env.desktop
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.desktop in the electron directory
const envPath = path.join(__dirname, '.env.desktop');
console.log(`[APIServer] Loading env from: ${envPath}`);
loadEnv({ path: envPath, override: false });

// ============================================================================
// Types
// ============================================================================

interface ValidateLicenseRequest {
  license_key: string;
  device_id: string;
  instance_name?: string;
  platform?: string;
}

interface CreemValidateResponse {
  status: string;
  instance_id?: string;
  activation_limit?: number;
  activations_remaining?: number;
  expires_at?: string;
  product_id?: string;
  [key: string]: any;
}

interface ValidateLicenseResponse {
  valid: boolean;
  status?: string;
  tier?: string;
  plan?: string;
  expiresAt?: string;
  token?: string;
  ttlSeconds?: number;
  message?: string;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const API_PORT = 3002;
const CREEM_API_MODE = process.env.CREEM_API_MODE || 'production';
const CREEM_API_BASE = CREEM_API_MODE === 'sandbox'
  ? 'https://test-api.creem.io'
  : 'https://api.creem.io';
const CREEM_API_KEY = process.env.CREEM_API_KEY || '';

console.log(`[APIServer] Using Creem API: ${CREEM_API_BASE} (${CREEM_API_MODE} mode)`);
console.log(`[APIServer] CREEM_API_KEY present: ${CREEM_API_KEY ? 'yes' : 'no'}`);

// ============================================================================
// Express Server Setup
// ============================================================================

export class LicenseAPIServer extends EventEmitter {
  private server: Express;
  private httpServer: any = null;
  private isRunning = false;

  constructor() {
    super();
    this.server = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.server.use(express.json());

    // Request logging
    this.server.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[APIServer] ${timestamp} ${req.method} ${req.path}`);
      next();
    });

    // Error handling middleware
    this.server.use((err: any, req: Request, res: Response, next: any) => {
      console.error('[APIServer] Error:', err);
      res.status(500).json({
        valid: false,
        error: 'Internal server error',
      });
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.server.get('/api/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: electronApp.getVersion(),
      });
    });

    // License validation endpoint
    this.server.post('/api/validate-license', async (req: Request, res: Response) => {
      try {
        const { license_key, device_id, instance_name, platform } = req.body as ValidateLicenseRequest;

        if (!license_key) {
          return res.status(400).json({
            valid: false,
            error: 'license_key is required',
          });
        }

        if (!device_id) {
          return res.status(400).json({
            valid: false,
            error: 'device_id is required',
          });
        }

        // Validate with Creem API
        const result = await this.validateLicenseWithCreem(
          license_key,
          device_id,
          instance_name,
          platform
        );

        res.json(result);
      } catch (error) {
        console.error('[APIServer] Validation error:', error);
        res.status(500).json({
          valid: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        });
      }
    });
  }

  /**
   * Activate + Validate license with Creem API
   * 
   * Creem requires a two-step flow:
   * 1. ACTIVATE: POST /v1/licenses/activate  { key, instance_name } → returns instance_id
   * 2. VALIDATE: POST /v1/licenses/validate  { key, instance_id }   → confirms status
   * 
   * For first-time use, we activate (which also confirms validity).
   * For subsequent use, we validate with the stored instance_id.
   */
  private async validateLicenseWithCreem(
    licenseKey: string,
    deviceId: string,
    instanceName?: string,
    platform?: string
  ): Promise<ValidateLicenseResponse> {
    if (!CREEM_API_KEY) {
      console.error('[APIServer] CREEM_API_KEY not configured');
      return {
        valid: false,
        error: 'License API not configured (missing CREEM_API_KEY)',
      };
    }

    const normalizedKey = licenseKey.toUpperCase().trim();
    const effectiveInstanceName = instanceName || `HedgeEdge-${deviceId.substring(0, 8)}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': CREEM_API_KEY,
      'User-Agent': `HedgeEdge/${electronApp.getVersion()}`,
    };

    try {
      // ── Step 1: Activate the license key (creates an instance) ──
      // This is idempotent-ish: if already at activation limit, Creem returns 403.
      // On first use it creates the instance and returns the instance_id.
      const activateUrl = `${CREEM_API_BASE}/v1/licenses/activate`;
      const activatePayload = {
        key: normalizedKey,
        instance_name: effectiveInstanceName,
      };

      console.log(`[APIServer] Step 1 - Activating license: ${activateUrl}`);
      console.log(`[APIServer] Activate payload:`, JSON.stringify(activatePayload, null, 2));

      const activateResponse = await fetch(activateUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(activatePayload),
      });

      const activateData = (await activateResponse.json()) as any;
      console.log(`[APIServer] Activate response status: ${activateResponse.status}`);
      console.log(`[APIServer] Activate response data:`, JSON.stringify(activateData, null, 2));

      // Handle activation errors
      if (!activateResponse.ok) {
        // 403 = activation limit reached (key already fully activated)
        // In that case, try to validate with existing instances
        if (activateResponse.status === 403) {
          console.log(`[APIServer] Activation limit reached - trying to validate existing instance`);
        } else {
          // Real error (404 = invalid key, 401 = bad API key, etc.)
          const errorMsg = Array.isArray(activateData.message)
            ? activateData.message.join(', ')
            : activateData.message || activateData.error || 'Activation failed';
          console.error(`[APIServer] Activation failed: ${errorMsg}`);
          return {
            valid: false,
            status: String(activateData.status || 'error'),
            error: errorMsg,
          };
        }
      }

      // Extract instance_id from activation response
      // The response has an "instance" field - can be an object or an array
      let instanceId: string | null = null;
      if (activateData.instance) {
        if (Array.isArray(activateData.instance)) {
          // Array of instances - use the last one
          if (activateData.instance.length > 0) {
            instanceId = activateData.instance[activateData.instance.length - 1].id;
          }
        } else if (typeof activateData.instance === 'object' && activateData.instance.id) {
          // Single instance object
          instanceId = activateData.instance.id;
        }
        console.log(`[APIServer] Got instance_id from activation: ${instanceId}`);
      }

      // If we couldn't get an instance_id from activation (e.g. limit reached),
      // we can still try validate - Creem may return instance data
      if (!instanceId) {
        console.log(`[APIServer] No instance_id from activation, attempting validate anyway`);
      }

      // ── Step 2: Validate the license with the instance_id ──
      if (instanceId) {
        const validateUrl = `${CREEM_API_BASE}/v1/licenses/validate`;
        const validatePayload = {
          key: normalizedKey,
          instance_id: instanceId,
        };

        console.log(`[APIServer] Step 2 - Validating license: ${validateUrl}`);
        console.log(`[APIServer] Validate payload:`, JSON.stringify(validatePayload, null, 2));

        const validateResponse = await fetch(validateUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(validatePayload),
        });

        const validateData = (await validateResponse.json()) as CreemValidateResponse;
        console.log(`[APIServer] Validate response status: ${validateResponse.status}`);
        console.log(`[APIServer] Validate response data:`, JSON.stringify(validateData, null, 2));

        if (validateResponse.ok) {
          const isValid = validateData.status === 'active';
          const result: ValidateLicenseResponse = {
            valid: isValid,
            status: validateData.status,
            tier: validateData.product_id || 'standard',
            plan: validateData.product_id || 'standard',
            expiresAt: validateData.expires_at,
            message: isValid ? 'License is valid' : `License status: ${validateData.status}`,
          };

          if (isValid) {
            result.token = Buffer.from(`${normalizedKey}:${instanceId}:${deviceId}`).toString('base64');
            result.ttlSeconds = 3600;
          }

          return result;
        }

        console.error(`[APIServer] Validate failed:`, validateData);
      }

      // If activation succeeded (even without explicit validate step), use that data
      if (activateResponse.ok && activateData.status) {
        const isValid = activateData.status === 'active';
        return {
          valid: isValid,
          status: activateData.status,
          tier: activateData.product_id || 'standard',
          plan: activateData.product_id || 'standard',
          expiresAt: activateData.expires_at,
          message: isValid ? 'License activated and valid' : `License status: ${activateData.status}`,
          token: isValid ? Buffer.from(`${normalizedKey}:${deviceId}`).toString('base64') : undefined,
          ttlSeconds: isValid ? 3600 : undefined,
        };
      }

      return {
        valid: false,
        error: 'License validation failed - could not activate or validate',
      };
    } catch (error) {
      console.error('[APIServer] Fetch error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.server.listen(API_PORT, 'localhost', () => {
          this.isRunning = true;
          console.log(`[APIServer] License API server started on http://localhost:${API_PORT}`);
          this.emit('started');
          resolve();
        });
      } catch (error) {
        console.error('[APIServer] Failed to start:', error);
        this.emit('error', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close(() => {
        this.isRunning = false;
        console.log('[APIServer] License API server stopped');
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Check if server is running
   */
  running(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const licenseAPIServer = new LicenseAPIServer();
