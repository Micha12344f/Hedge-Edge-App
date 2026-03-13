/**
 * Centralized application configuration.
 * All environment-dependent values live here so there is one source of truth.
 */

/** Railway-hosted license API base URL */
export const API_BASE_URL =
  import.meta.env.VITE_LICENSE_API_URL ||
  'https://hedge-edge-app-backend-production.up.railway.app';

/** License validation endpoint */
export const LICENSE_VALIDATE_URL = `${API_BASE_URL}/v1/license/validate`;

/** License heartbeat endpoint */
export const LICENSE_HEARTBEAT_URL = `${API_BASE_URL}/v1/license/heartbeat`;

/** License deactivation endpoint */
export const LICENSE_DEACTIVATE_URL = `${API_BASE_URL}/v1/license/deactivate`;

/** Whether the app is running in development mode */
export const IS_DEV = import.meta.env.DEV;

/** Sentry DSN for error monitoring */
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

/** Current app version */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
