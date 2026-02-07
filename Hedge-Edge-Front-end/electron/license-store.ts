/**
 * License Store Module for HedgeEdge
 * 
 * Manages license key storage using OS keychain (Windows DPAPI via Electron safeStorage)
 * with in-memory fallback when encryption is not available.
 * 
 * Security features:
 * - Never stores plaintext license key on disk
 * - Uses DPAPI/Credential Locker on Windows
 * - In-memory only fallback for unsupported systems
 * - Masked key for UI display
 */

import { safeStorage, app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type LicenseStatus = 'valid' | 'expired' | 'invalid' | 'not-configured' | 'checking' | 'error';

export interface LicenseInfo {
  status: LicenseStatus;
  maskedKey?: string;
  lastChecked?: string;
  nextCheckAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
  errorMessage?: string;
  features?: string[];
  email?: string;
  tier?: string;
  plan?: string;
}

export interface LicenseValidationResponse {
  valid: boolean;
  token?: string;
  ttlSeconds?: number;
  message?: string;
  plan?: string;
  expiresAt?: string;
}

interface StoredLicenseData {
  encryptedKey: string; // base64 encoded encrypted key
  lastValidated?: string;
  tier?: string;
  expiresAt?: string;
}

// ============================================================================
// Constants
// ============================================================================

const LICENSE_API_URL = 'https://api.hedge-edge.com/v1/license/validate';
const LICENSE_FILE_NAME = 'license.dat';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// License Store Class
// ============================================================================

export class LicenseStore {
  private licenseKey: string | null = null;
  private licenseInfo: LicenseInfo | null = null;
  private encryptionAvailable: boolean;
  private licenseFilePath: string;
  
  constructor() {
    this.encryptionAvailable = safeStorage.isEncryptionAvailable();
    this.licenseFilePath = path.join(app.getPath('userData'), LICENSE_FILE_NAME);
  }
  
  /**
   * Initialize the store - load any persisted license
   */
  async initialize(): Promise<void> {
    if (!this.encryptionAvailable) {
      console.warn('[LicenseStore] OS keychain encryption not available - using in-memory only');
      this.licenseInfo = { status: 'not-configured' };
      return;
    }
    
    try {
      await this.loadPersistedLicense();
    } catch (error) {
      console.error('[LicenseStore] Failed to load persisted license:', error);
      this.licenseInfo = { status: 'not-configured' };
    }
  }
  
  /**
   * Load persisted license from encrypted storage
   */
  private async loadPersistedLicense(): Promise<void> {
    try {
      const exists = await fs.access(this.licenseFilePath).then(() => true).catch(() => false);
      if (!exists) {
        this.licenseInfo = { status: 'not-configured' };
        return;
      }
      
      const encryptedData = await fs.readFile(this.licenseFilePath);
      const data: StoredLicenseData = JSON.parse(encryptedData.toString());
      
      // Decrypt the license key
      const encryptedBuffer = Buffer.from(data.encryptedKey, 'base64');
      this.licenseKey = safeStorage.decryptString(encryptedBuffer);
      
      // Restore basic info (actual validation happens separately)
      this.licenseInfo = {
        status: 'checking',
        maskedKey: this.maskLicenseKey(this.licenseKey),
        lastChecked: data.lastValidated,
        tier: data.tier,
        expiresAt: data.expiresAt,
      };
      
      console.log('[LicenseStore] Loaded persisted license (masked):', this.licenseInfo.maskedKey);
    } catch (error) {
      console.error('[LicenseStore] Failed to decrypt persisted license:', error);
      // Clear corrupted file
      await this.clearPersistedLicense();
      this.licenseInfo = { status: 'not-configured' };
    }
  }
  
  /**
   * Save license key to encrypted storage
   */
  private async persistLicense(tier?: string, expiresAt?: string): Promise<void> {
    if (!this.encryptionAvailable || !this.licenseKey) {
      return;
    }
    
    try {
      const encryptedBuffer = safeStorage.encryptString(this.licenseKey);
      const data: StoredLicenseData = {
        encryptedKey: encryptedBuffer.toString('base64'),
        lastValidated: new Date().toISOString(),
        tier,
        expiresAt,
      };
      
      await fs.writeFile(this.licenseFilePath, JSON.stringify(data), 'utf-8');
      console.log('[LicenseStore] License key persisted securely');
    } catch (error) {
      console.error('[LicenseStore] Failed to persist license:', error);
      // Non-fatal - license will work for this session
    }
  }
  
  /**
   * Clear persisted license file
   */
  private async clearPersistedLicense(): Promise<void> {
    try {
      await fs.unlink(this.licenseFilePath);
    } catch {
      // File may not exist
    }
  }
  
  /**
   * Mask a license key for safe display
   */
  maskLicenseKey(key: string): string {
    if (!key || key.length <= 8) return '••••-••••';
    const parts = key.split('-');
    if (parts.length >= 4) {
      return `${parts[0].slice(0, 2)}••-••••-••••-••${parts[parts.length - 1].slice(-2)}`;
    }
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  }
  
  /**
   * Get device/machine ID for license binding
   */
  private getDeviceId(): string {
    // Use a combination of factors for device identification
    // In production, this would be more sophisticated
    const factors = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown',
    ].join('|');
    
    return crypto.createHash('sha256').update(factors).digest('hex').substring(0, 32);
  }
  
  /**
   * Validate license key format
   */
  private isValidFormat(key: string): boolean {
    // Expected format: XXXX-XXXX-XXXX-XXXX (alphanumeric)
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key);
  }
  
  /**
   * Validate license key with the API
   */
  async validateLicense(licenseKey: string): Promise<{
    success: boolean;
    info?: LicenseInfo;
    error?: string;
  }> {
    // Format validation
    if (!this.isValidFormat(licenseKey)) {
      return {
        success: false,
        error: 'Invalid license key format. Expected: XXXX-XXXX-XXXX-XXXX',
      };
    }
    
    try {
      const requestBody = {
        licenseKey,
        deviceId: this.getDeviceId(),
        platform: 'desktop',
        version: app.getVersion(),
      };
      
      console.log('[LicenseStore] Validating license key...');
      
      const response = await fetch(LICENSE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `HedgeEdge/${app.getVersion()}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        // Handle HTTP errors
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: 'Invalid or expired license key',
            info: { status: 'invalid', maskedKey: this.maskLicenseKey(licenseKey) },
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: LicenseValidationResponse = await response.json();
      
      if (!data.valid) {
        return {
          success: false,
          error: data.message || 'License validation failed',
          info: {
            status: 'invalid',
            maskedKey: this.maskLicenseKey(licenseKey),
            errorMessage: data.message,
          },
        };
      }
      
      // Calculate days remaining
      const now = new Date();
      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      const daysRemaining = expiresAt 
        ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : undefined;
      
      const info: LicenseInfo = {
        status: daysRemaining === 0 ? 'expired' : 'valid',
        maskedKey: this.maskLicenseKey(licenseKey),
        lastChecked: now.toISOString(),
        nextCheckAt: new Date(now.getTime() + CHECK_INTERVAL_MS).toISOString(),
        expiresAt: data.expiresAt,
        daysRemaining,
        tier: 'pro',
        plan: data.plan,
        features: ['trade-copying', 'hedge-detection', 'multi-account'],
      };
      
      return { success: true, info };
    } catch (error) {
      console.error('[LicenseStore] License validation error:', error);
      
      // Network error - return error state but don't invalidate existing license
      return {
        success: false,
        error: error instanceof Error ? error.message : 'License validation failed',
        info: {
          status: 'error',
          maskedKey: this.maskLicenseKey(licenseKey),
          errorMessage: 'Unable to reach license server. Check your internet connection.',
        },
      };
    }
  }
  
  /**
   * Activate a license key
   */
  async activate(licenseKey: string): Promise<{
    success: boolean;
    info?: LicenseInfo;
    error?: string;
  }> {
    const trimmedKey = licenseKey.trim().toUpperCase();
    
    // Validate with API
    const result = await this.validateLicense(trimmedKey);
    
    if (result.success && result.info) {
      // Store the key
      this.licenseKey = trimmedKey;
      this.licenseInfo = result.info;
      
      // Persist to encrypted storage
      await this.persistLicense(result.info.tier, result.info.expiresAt);
      
      return { success: true, info: result.info };
    }
    
    // Validation failed
    this.licenseInfo = result.info || { status: 'invalid' };
    return { success: false, error: result.error, info: result.info };
  }
  
  /**
   * Refresh the current license status
   */
  async refresh(): Promise<{
    success: boolean;
    info?: LicenseInfo;
    error?: string;
  }> {
    if (!this.licenseKey) {
      return { success: false, error: 'No license key configured' };
    }
    
    this.licenseInfo = { ...this.licenseInfo, status: 'checking' } as LicenseInfo;
    
    const result = await this.validateLicense(this.licenseKey);
    
    if (result.success && result.info) {
      this.licenseInfo = result.info;
      // Update persisted data
      await this.persistLicense(result.info.tier, result.info.expiresAt);
      return { success: true, info: result.info };
    }
    
    // Keep existing info but update status
    if (result.info) {
      this.licenseInfo = result.info;
    }
    return { success: false, error: result.error, info: result.info };
  }
  
  /**
   * Remove the license
   */
  async remove(): Promise<void> {
    this.licenseKey = null;
    this.licenseInfo = { status: 'not-configured' };
    await this.clearPersistedLicense();
  }
  
  /**
   * Get current license status
   */
  getStatus(): LicenseInfo {
    return this.licenseInfo || { status: 'not-configured' };
  }
  
  /**
   * Get the raw license key (for internal use only - never expose to renderer)
   */
  getLicenseKey(): string | null {
    return this.licenseKey;
  }
  
  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean {
    return this.encryptionAvailable;
  }
}

// Singleton instance
export const licenseStore = new LicenseStore();
