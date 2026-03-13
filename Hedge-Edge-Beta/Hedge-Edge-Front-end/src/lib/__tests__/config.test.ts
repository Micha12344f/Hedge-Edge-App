import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports all expected URL constants', async () => {
    const config = await import('@/lib/config');
    expect(config.API_BASE_URL).toBeDefined();
    expect(config.LICENSE_VALIDATE_URL).toContain('/v1/license/validate');
    expect(config.LICENSE_HEARTBEAT_URL).toContain('/v1/license/heartbeat');
    expect(config.LICENSE_DEACTIVATE_URL).toContain('/v1/license/deactivate');
  });

  it('URLs are derived from API_BASE_URL', async () => {
    const config = await import('@/lib/config');
    expect(config.LICENSE_VALIDATE_URL).toBe(`${config.API_BASE_URL}/v1/license/validate`);
    expect(config.LICENSE_HEARTBEAT_URL).toBe(`${config.API_BASE_URL}/v1/license/heartbeat`);
    expect(config.LICENSE_DEACTIVATE_URL).toBe(`${config.API_BASE_URL}/v1/license/deactivate`);
  });

  it('falls back to Railway URL when env var not set', async () => {
    const config = await import('@/lib/config');
    expect(config.API_BASE_URL).toBe('https://hedge-edge-app-backend-production.up.railway.app');
  });

  it('exports IS_DEV boolean', async () => {
    const config = await import('@/lib/config');
    expect(typeof config.IS_DEV).toBe('boolean');
  });

  it('exports SENTRY_DSN as string', async () => {
    const config = await import('@/lib/config');
    expect(typeof config.SENTRY_DSN).toBe('string');
  });

  it('exports APP_VERSION as string', async () => {
    const config = await import('@/lib/config');
    expect(typeof config.APP_VERSION).toBe('string');
  });
});
