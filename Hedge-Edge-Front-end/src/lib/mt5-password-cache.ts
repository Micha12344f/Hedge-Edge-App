/**
 * MT5 Password Storage
 * ====================
 * For development: Store passwords in session storage (lost on tab close)
 * For production: You should encrypt passwords before storing in database
 * 
 * This simple approach works for development/demo purposes.
 */

// Session storage key (temporary, secure for development)
const PASSWORD_CACHE_KEY = 'mt5_passwords_cache';

interface PasswordEntry {
  login: string;
  password: string;
  server: string;
  timestamp: number;
}

/**
 * Get cached password for an account
 */
export function getCachedPassword(login: string, server: string): string | null {
  try {
    const cache = sessionStorage.getItem(PASSWORD_CACHE_KEY);
    if (!cache) return null;
    
    const entries: PasswordEntry[] = JSON.parse(cache);
    const entry = entries.find(e => e.login === login && e.server === server);
    
    if (!entry) return null;
    
    // Expire after 24 hours
    if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
      removeCachedPassword(login, server);
      return null;
    }
    
    return entry.password;
  } catch {
    return null;
  }
}

/**
 * Cache password for an account (session storage - lost on tab close)
 */
export function cachePassword(login: string, password: string, server: string): void {
  try {
    const cache = sessionStorage.getItem(PASSWORD_CACHE_KEY);
    let entries: PasswordEntry[] = cache ? JSON.parse(cache) : [];
    
    // Remove existing entry for this account
    entries = entries.filter(e => !(e.login === login && e.server === server));
    
    // Add new entry
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
 * Remove cached password
 */
export function removeCachedPassword(login: string, server: string): void {
  try {
    const cache = sessionStorage.getItem(PASSWORD_CACHE_KEY);
    if (!cache) return;
    
    let entries: PasswordEntry[] = JSON.parse(cache);
    entries = entries.filter(e => !(e.login === login && e.server === server));
    
    sessionStorage.setItem(PASSWORD_CACHE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to remove cached password:', error);
  }
}

/**
 * Clear all cached passwords
 */
export function clearAllCachedPasswords(): void {
  sessionStorage.removeItem(PASSWORD_CACHE_KEY);
}

/**
 * Check if password is cached for an account
 */
export function hasPasswordCached(login: string, server: string): boolean {
  return getCachedPassword(login, server) !== null;
}
