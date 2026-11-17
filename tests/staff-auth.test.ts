/// <reference types="node" />
import { beforeEach, afterEach, describe, expect, jest, test } from '@jest/globals';

let mockStored: string | null = null;
const mockRead = jest.fn(async () => mockStored);
const mockWrite = jest.fn(async (_key: string, value: string) => { mockStored = value; });

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'this-device',
  getItemAsync: (...args: []) => mockRead(...args),
  setItemAsync: (...args: [string, string]) => mockWrite(...args),
}));
jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'sha256' },
    digestStringAsync: async (_algorithm: string, value: string) => crypto.createHash('sha256').update(value).digest('hex'),
    getRandomBytesAsync: async (size: number) => crypto.randomBytes(size),
  };
});

type Auth = typeof import('../src/storage/staff-auth');
let auth: Auth;

beforeEach(() => {
  mockStored = null;
  mockRead.mockClear();
  mockWrite.mockClear();
  jest.isolateModules(() => { auth = jest.requireActual<Auth>('../src/storage/staff-auth'); });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('local staff credentials', () => {
  test('setup stores only salted verifiers and refuses to overwrite an existing PIN', async () => {
    const recovery = await auth.setupStaff('123456');
    expect(recovery).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/);
    const credentials = JSON.parse(mockStored!) as Record<string, unknown>;
    expect(credentials.salt).toMatch(/^[a-f0-9]{32}$/);
    expect(credentials.pinHash).toMatch(/^[a-f0-9]{64}$/);
    expect(credentials.recoveryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(credentials).not.toHaveProperty('pin');
    expect(credentials).not.toHaveProperty('recovery');
    expect(mockStored).not.toContain('123456');
    expect(mockStored).not.toContain(recovery.replaceAll('-', '').toLowerCase());
    await expect(auth.setupStaff('654321')).rejects.toThrow('ALREADY_CONFIGURED');
    await expect(auth.unlockStaff('123456')).resolves.toBeUndefined();
  });

  test('five failures enforce a persistent 30-second cooldown even after service reload', async () => {
    let now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await auth.setupStaff('123456');
    for (let attempt = 0; attempt < 4; attempt++) await expect(auth.unlockStaff('000000')).rejects.toThrow('PIN_INVALID');
    await expect(auth.unlockStaff('000000')).rejects.toThrow('PIN_COOLDOWN');
    expect((await auth.staffStatus()).blockedUntil).toBe(now + 30_000);
    jest.isolateModules(() => { auth = jest.requireActual<Auth>('../src/storage/staff-auth'); });
    now += 29_999;
    await expect(auth.unlockStaff('123456')).rejects.toThrow('PIN_COOLDOWN');
    now += 1;
    await expect(auth.unlockStaff('123456')).resolves.toBeUndefined();
    expect((await auth.staffStatus()).blockedUntil).toBe(0);
    expect(JSON.parse(mockStored!).failed).toBe(0);
  });

  test('concurrent attempts cannot bypass the serialized failure counter', async () => {
    await auth.setupStaff('123456');
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => auth.unlockStaff('000000')));
    const errors = attempts.map((attempt) => attempt.status === 'rejected' ? (attempt.reason as Error).message : 'unexpected success');
    expect(errors.filter((code) => code === 'PIN_INVALID')).toHaveLength(4);
    expect(errors.filter((code) => code === 'PIN_COOLDOWN')).toHaveLength(2);
  });

  test('recovery rotates both verifiers and invalidates the old PIN and recovery code', async () => {
    const originalRecovery = await auth.setupStaff('123456');
    const oldStorage = mockStored;
    const newRecovery = await auth.recoverStaff(originalRecovery.toLowerCase().replaceAll('-', ' '), '654321');
    expect(newRecovery).not.toBe(originalRecovery);
    expect(mockStored).not.toBe(oldStorage);
    expect(mockStored).not.toContain('654321');
    await expect(auth.unlockStaff('123456')).rejects.toThrow('PIN_INVALID');
    await expect(auth.recoverStaff(originalRecovery, '111111')).rejects.toThrow('PIN_INVALID');
    await expect(auth.unlockStaff('654321')).resolves.toBeUndefined();
    await expect(auth.recoverStaff(newRecovery, '111111')).resolves.toMatch(/^[A-F0-9-]+$/);
  });

  test('malformed stored data fails closed instead of offering fresh setup', async () => {
    for (const stored of ['', '{}', 'not-json', JSON.stringify({ salt: 'x', pinHash: {}, recoveryHash: 'y', failed: -1, blockedUntil: 0 })]) {
      mockStored = stored;
      await expect(auth.staffStatus()).rejects.toThrow('AUTH_STORAGE');
      await expect(auth.setupStaff('123456')).rejects.toThrow('AUTH_STORAGE');
      expect(mockStored).toBe(stored);
    }
  });

  test('invalid PIN formats and failed secure writes never grant access', async () => {
    await expect(auth.setupStaff('123')).rejects.toThrow('PIN_FORMAT');
    expect(mockStored).toBeNull();
    await auth.setupStaff('123456');
    mockWrite.mockRejectedValueOnce(new Error('Secure storage unavailable'));
    await expect(auth.unlockStaff('123456')).rejects.toThrow('Secure storage unavailable');
    await expect(auth.unlockStaff('not-a-pin')).rejects.toThrow('PIN_FORMAT');
  });
});
