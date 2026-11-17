import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'arwana.staff.credentials.v1';
interface Credentials {
  salt: string;
  pinHash: string;
  recoveryHash: string;
  failed: number;
  blockedUntil: number;
}
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}
async function read(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (raw === null) return null;
  let value: Credentials;
  try { value = JSON.parse(raw) as Credentials; }
  catch { throw new Error('AUTH_STORAGE'); }
  if (!value || typeof value !== 'object' ||
      typeof value.salt !== 'string' || !/^[a-f0-9]{32}$/.test(value.salt) ||
      typeof value.pinHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.pinHash) ||
      typeof value.recoveryHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.recoveryHash) ||
      !Number.isInteger(value.failed) || value.failed < 0 || value.failed > 4 ||
      !Number.isFinite(value.blockedUntil) || value.blockedUntil < 0) {
    throw new Error('AUTH_STORAGE');
  }
  return value;
}
async function write(value: Credentials) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
const digest = (salt: string, secret: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${secret}`);
function equal(a: string, b: string) {
  let result = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return result === 0;
}
async function randomHex() {
  return Array.from(await Crypto.getRandomBytesAsync(16), b => b.toString(16).padStart(2, '0')).join('');
}
function validatePin(pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN_FORMAT');
}
async function makeCredentials(pin: string) {
  validatePin(pin);
  const salt = await randomHex();
  const recovery = await randomHex();
  const credentials: Credentials = {
    salt,
    pinHash: await digest(salt, pin),
    recoveryHash: await digest(salt, recovery),
    failed: 0,
    blockedUntil: 0,
  };
  await write(credentials);
  return recovery.toUpperCase().match(/.{1,4}/g)!.join('-');
}
export async function staffStatus() {
  const credentials = await read();
  return { configured: !!credentials, blockedUntil: credentials?.blockedUntil ?? 0 };
}
export function setupStaff(pin: string) {
  return exclusive(async () => {
    if (await read()) throw new Error('ALREADY_CONFIGURED');
    return makeCredentials(pin);
  });
}
async function verify(secret: string, recovery: boolean) {
  const credentials = await read();
  if (!credentials) throw new Error('NOT_CONFIGURED');
  if (credentials.blockedUntil > Date.now()) throw new Error('PIN_COOLDOWN');
  const normalized = recovery ? secret.replace(/[-\s]/g, '').toLowerCase() : secret;
  const valid = equal(await digest(credentials.salt, normalized), recovery ? credentials.recoveryHash : credentials.pinHash);
  if (!valid) {
    credentials.failed += 1;
    if (credentials.failed >= 5) {
      credentials.failed = 0;
      credentials.blockedUntil = Date.now() + 30_000;
    }
    await write(credentials);
    throw new Error(credentials.blockedUntil > Date.now() ? 'PIN_COOLDOWN' : 'PIN_INVALID');
  }
  credentials.failed = 0;
  credentials.blockedUntil = 0;
  await write(credentials);
}
export function unlockStaff(pin: string) {
  return exclusive(async () => { validatePin(pin); await verify(pin, false); });
}
export function recoverStaff(code: string, newPin: string) {
  return exclusive(async () => {
    validatePin(newPin);
    await verify(code, true);
    return makeCredentials(newPin);
  });
}
