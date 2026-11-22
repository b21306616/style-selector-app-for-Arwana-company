import { strFromU8 } from 'fflate';
import { AppError } from './errors';

export interface ZipEntry { name: string; size: number; compressedSize: number; crc: number }
export const safeArchivePath = (name: string) => !!name && !/[\\:\x00-\x1f]/.test(name) && !name.startsWith('/') && name.split('/').every(part => part !== '..' && part !== '.');
const badZip = () => new AppError('INVALID_ARCHIVE');

/** Reads only the bounded central directory, including for large on-device archives. */
export function readZipIndex(size: number, read: (offset: number, length: number) => Uint8Array, maxBytes: number, maxEntries = 1000): ZipEntry[] {
  if (size < 22) throw badZip();
  const tailOffset = Math.max(0, size - 65557);
  const tail = read(tailOffset, size - tailOffset);
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === tail.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw badZip();
  const count = view.getUint16(end + 10, true);
  const length = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  if (count > maxEntries || count !== view.getUint16(end + 8, true) || length > 2 * 1024 * 1024 || offset + length !== tailOffset + end) throw badZip();
  const directory = read(offset, length);
  const dv = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let cursor = 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directory.length || dv.getUint32(cursor, true) !== 0x02014b50) throw badZip();
    const flags = dv.getUint16(cursor + 8, true);
    const method = dv.getUint16(cursor + 10, true);
    const compressedSize = dv.getUint32(cursor + 20, true);
    const originalSize = dv.getUint32(cursor + 24, true);
    const nameLength = dv.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLength + dv.getUint16(cursor + 30, true) + dv.getUint16(cursor + 32, true);
    if (next > directory.length || flags & 1 || ![0, 8].includes(method) || originalSize === 0xffffffff || dv.getUint32(cursor + 42, true) >= offset) throw badZip();
    const name = strFromU8(directory.subarray(cursor + 46, cursor + 46 + nameLength), !(flags & 2048));
    if (!safeArchivePath(name) || names.has(name)) throw badZip();
    total += originalSize;
    if (total > maxBytes) throw new AppError('TRANSFER_LIMIT');
    names.add(name);
    entries.push({ name, size: originalSize, compressedSize, crc: dv.getUint32(cursor + 16, true) });
    cursor = next;
  }
  if (cursor !== directory.length) throw badZip();
  return entries;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function updateCrc(crc: number, data: Uint8Array): number {
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return crc;
}
