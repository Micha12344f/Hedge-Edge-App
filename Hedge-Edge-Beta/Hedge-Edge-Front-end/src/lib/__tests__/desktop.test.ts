import { describe, it, expect, beforeEach } from 'vitest';
import { isElectron, isConnectionsApiAvailable } from '@/lib/desktop';

describe('desktop utilities', () => {
  beforeEach(() => {
    // Reset electronAPI between tests
    (window as any).electronAPI = undefined;
  });

  describe('isElectron', () => {
    it('returns true when electronAPI.isElectron is set', () => {
      (window as any).electronAPI = { isElectron: true };
      expect(isElectron()).toBe(true);
    });

    it('returns false when electronAPI is missing', () => {
      expect(isElectron()).toBe(false);
    });

    it('returns false when isElectron property is falsy', () => {
      (window as any).electronAPI = { isElectron: false };
      expect(isElectron()).toBe(false);
    });
  });

  describe('isConnectionsApiAvailable', () => {
    it('returns true when connections API exists', () => {
      (window as any).electronAPI = {
        isElectron: true,
        connections: { list: () => [] },
      };
      expect(isConnectionsApiAvailable()).toBe(true);
    });

    it('returns false when not in electron', () => {
      expect(isConnectionsApiAvailable()).toBe(false);
    });

    it('returns false when connections is undefined', () => {
      (window as any).electronAPI = { isElectron: true };
      expect(isConnectionsApiAvailable()).toBe(false);
    });
  });
});
