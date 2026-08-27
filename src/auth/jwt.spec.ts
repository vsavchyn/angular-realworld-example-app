import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyToken, getToken, saveToken } from './jwt';

describe('jwt', () => {
  let localStorageSpy: Record<string, unknown> & {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorageSpy = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageSpy,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getToken', () => {
    it('should retrieve token from localStorage', () => {
      localStorageSpy['jwtToken'] = 'test-jwt-token-123';
      expect(getToken()).toBe('test-jwt-token-123');
    });

    it('should return undefined when no token exists', () => {
      expect(getToken()).toBeUndefined();
    });

    it('should handle empty string token', () => {
      localStorageSpy['jwtToken'] = '';
      expect(getToken()).toBe('');
    });
  });

  describe('saveToken', () => {
    it('should save token to localStorage', () => {
      saveToken('new-jwt-token-456');
      expect(localStorageSpy['jwtToken']).toBe('new-jwt-token-456');
    });

    it('should overwrite existing token', () => {
      localStorageSpy['jwtToken'] = 'old-token';
      saveToken('new-token');
      expect(localStorageSpy['jwtToken']).toBe('new-token');
    });

    it('should persist token after save', () => {
      saveToken('persist-test-token');
      expect(getToken()).toBe('persist-test-token');
    });
  });

  describe('destroyToken', () => {
    it('should remove token from localStorage', () => {
      localStorageSpy['jwtToken'] = 'test-token';
      destroyToken();
      expect(localStorageSpy.removeItem).toHaveBeenCalledWith('jwtToken');
    });

    it('should be idempotent', () => {
      destroyToken();
      destroyToken();
      expect(localStorageSpy.removeItem).toHaveBeenCalledTimes(2);
    });
  });
});
