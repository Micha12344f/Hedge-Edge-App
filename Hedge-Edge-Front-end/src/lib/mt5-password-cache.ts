/**
 * MT5 Password Storage
 * ====================
 * Production: Uses Electron's safeStorage API for OS-level encryption
 *             (Windows DPAPI, macOS Keychain, Linux Secret Service)
 * Fallback:   Session storage when safeStorage is unavailable
 * 
 * Passwords are encrypted before storage and automatically expire after 24 hours.
 */

// Storage keys
const PASSWORD_CACHE_KEY = 'mt5_passwords_cache';
const ENCRYPTED_CACHE_KEY = 'mt5_encrypted_cache';

interface PasswordEntry {
  login: string;
  encryptedPassword: string; // Base64 encoded encrypted password
  server: string;
  timestamp: number;
}

interface LegacyPasswordEntry {
  login: string;
  password: string;
  server: string;
  timestamp: number;
}

/**
 * Check if running in Electron with secure storage available
 */
async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    return window.electronAPI?.secureStorage?.isAvailable?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Get cached password for an account
 * Attempts to use encrypted storage first, falls back to session storage
 */
export async function getCachedPassword(login: string, server: string): Promise<string | null> {
  try {
    // Try encrypted storage first
    if (await isSecureStorageAvailable()) {
      const cache = localStorage.getItem(ENCRYPTED_CACHE_KEY);
      if (cache) {
        const entries: PasswordEntry[] = JSON.parse(cache);
        const entry = entries.find(e => e.login === login && e.server === server);
        
        if (entry) {
          // Check expiration (24 hours)
          if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
            await removeCachedPassword(login, server);
            return null;
          }
          
          // Decrypt the password
          const result = await window.electronAPI!.secureStorage.decrypt(entry.encryptedPassword);
          if (result.success && result.data) {
            return result.data;
          }
        }
      }
    }
    
    // Fallback to legacy session storage (for non-Electron or unavailable safeStorage)
    const legacyCache = sessionStorage.getItem(PASSWORD_CACHE_KEY);
    if (legacyCache) {
      const entries: LegacyPasswordEntry[] = JSON.parse(legacyCache);
      const entry = entries.find(e => e.login === login && e.server === server);
      
      if (entry) {
        if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
          removeCachedPasswordSync(login, server);
          return null;
        }
        return entry.password;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache password for an account using encrypted storage when available
 */
export async function cachePassword(login: string, password: string, server: string): Promise<void> {
  try {
    // Try encrypted storage first
    if (await isSecureStorageAvailable()) {
      const encryptResult = await window.electronAPI!.secureStorage.encrypt(password);
      
      if (encryptResult.success && encryptResult.data) {
        const cache = localStorage.getItem(ENCRYPTED_CACHE_KEY);
        let entries: PasswordEntry[] = cache ? JSON.parse(cache) : [];
        
        // Remove existing entry for this account
        entries = entries.filter(e => !(e.login === login && e.server === server));
        
        // Add new encrypted entry
        entries.push({
          login,
          encryptedPassword: encryptResult.data,
          server,
          timestamp: Date.now(),
        });
        
        localStorage.setItem(ENCRYPTED_CACHE_KEY, JSON.stringify(entries));
        
        // Clear any legacy entries for this account
        removeCachedPasswordSync(login, server);
        return;
      }
    }
    
    // Fallback to legacy session storage
    const cache = sessionStorage.getItem(PASSWORD_CACHE_KEY);
    let entries: LegacyPasswordEntry[] = cache ? JSON.parse(cache) : [];
    
    entries = entries.filter(e => !(e.login === login && e.server === server));
    entries.push({
      login,
      password,
      server,
      timestamp: Date.now(),
    });
    
    sessionStorage.setItem(PASSWORD_CACHE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to cache password:', error);
  }
}

/**
 * Synchronous removal from legacy session storage
 */
function removeCachedPasswordSync(login: string, server: string): void {
  try {
    const cache = sessionStorage.getItem(PASSWORD_CACHE_KEY);
    if (!cache) return;
    
    let entries: LegacyPasswordEntry[] = JSON.parse(cache);
    entries = entries.filter(e => !(e.login === login && e.server === server));
    sessionStorage.setItem(PASSWORD_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore errors
  }
}

/**
 * Remove cached password from both encrypted and legacy storage
 */
export async function removeCachedPassword(login: string, server: string): Promise<void> {
  try {
    // Remove from encrypted storage
    const encCache = localStorage.getItem(ENCRYPTED_CACHE_KEY);
    if (encCache) {
      let entries: PasswordEntry[] = JSON.parse(encCache);
      entries = entries.filter(e => !(e.login === login && e.server === server));
      localStorage.setItem(ENCRYPTED_CACHE_KEY, JSON.stringify(entries));
    }
    
    // Remove from legacy storage
    removeCachedPasswordSync(login, server);
  } catch (error) {
    console.error('Failed to remove cached password:', error);
  }
}

/**
 * Clear all cached passwords from both encrypted and legacy storage
 */
export async function clearAllCachedPasswords(): Promise<void> {
  localStorage.removeItem(ENCRYPTED_CACHE_KEY);
  sessionStorage.removeItem(PASSWORD_CACHE_KEY);
}

/**
 * Check if password is cached for an account
 */
export async function hasPasswordCached(login: string, server: string): Promise<boolean> {
  return (await getCachedPassword(login, server)) !== null;
}
