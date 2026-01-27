// Supabase client with enhanced security configuration
import { createClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from './types';
import { 
  SESSION_CONFIG, 
  updateLastActivity, 
  isSessionIdle,
  logSecurityEvent 
} from '@/lib/security';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Use localStorage for persistent sessions, but with security controls
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Detect session in URL (for OAuth callbacks) but clear it after use
    detectSessionInUrl: true,
    // Flow type for better security
    flowType: 'pkce',
    // Storage key prefix for isolation
    storageKey: 'hedge-edge-auth',
  },
  global: {
    headers: {
      // Add custom headers for request tracking
      'X-Client-Info': 'hedge-edge-web',
    },
  },
  // Realtime configuration with security settings
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting
    },
  },
});

/**
 * Session monitor for idle timeout and security checks
 */
let activityInterval: ReturnType<typeof setInterval> | null = null;
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start monitoring user activity for idle timeout
 */
export function startSessionMonitoring(): void {
  // Update activity on user interactions
  const updateActivity = () => updateLastActivity();
  
  window.addEventListener('mousedown', updateActivity);
  window.addEventListener('keydown', updateActivity);
  window.addEventListener('scroll', updateActivity);
  window.addEventListener('touchstart', updateActivity);
  
  // Initial activity update
  updateLastActivity();
  
  // Check for idle timeout every minute
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  
  sessionCheckInterval = setInterval(async () => {
    if (isSessionIdle()) {
      logSecurityEvent('session_expired', { reason: 'idle_timeout' });
      await supabase.auth.signOut();
      window.location.href = '/auth?reason=idle';
    }
  }, 60000); // Check every minute
}

/**
 * Stop session monitoring (call on logout)
 */
export function stopSessionMonitoring(): void {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

/**
 * Enhanced sign out that clears all security-related storage
 */
export async function secureSignOut(): Promise<void> {
  try {
    stopSessionMonitoring();
    
    // Clear session-related storage
    sessionStorage.removeItem('csrf_token');
    sessionStorage.removeItem('csrf_token_timestamp');
    sessionStorage.removeItem('last_activity');
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    logSecurityEvent('login_success', { action: 'logout' });
  } catch (error) {
    console.error('Error during sign out:', error);
    // Force clear even on error
    localStorage.removeItem('hedge-edge-auth');
  }
}

/**
 * Listen for auth state changes and handle security events
 */
supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
  switch (event) {
    case 'SIGNED_IN':
      startSessionMonitoring();
      logSecurityEvent('login_success');
      break;
    case 'SIGNED_OUT':
      stopSessionMonitoring();
      break;
    case 'TOKEN_REFRESHED':
      updateLastActivity();
      break;
    case 'USER_UPDATED':
      // Validate session is still valid after user update
      if (!session) {
        stopSessionMonitoring();
      }
      break;
  }
});