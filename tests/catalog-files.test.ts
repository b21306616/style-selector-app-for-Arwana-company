import { beforeEach, expect, jest, test } from '@jest/globals';
import { Zip, ZipDeflate, unzipSync, zipSync } from 'fflate';
import { Platform } from 'react-native';
import { createExport, pickImportImages, pickWorkbook, shareExport } from '../src/storage/catalog-files';
import { decodeWorkbook, encodeWorkbook } from '../src/storage/workbook';
import { seedCatalog } from '../src/data/catalog';
import { cloneCatalog } from '../src/domain/catalog';
import { normalizePhotoFilenames } from '../src/domain/photo-filenames';
import type { Photo } from '../src/domain/types';
import { AppError } from '../src/domain/errors';
import { File } from 'expo-file-system';

type Stored = { data: Uint8Array; size: number };
const mockFiles = new Map<string, Stored>();
const mockDirs = new Set<string>();
const mockPaths = { cache: '/cache', availableDiskSpace: 3 * 1024 ** 3 };
const mockWholeReads: string[] = [];
const mockReadSizes: number[] = [];
let mockOpenHandles = 0;
let mockId = 0;
let mockCopyError: Error | null = null;
const mockPick = jest.fn<(options?: unknown) => Promise<{ canceled: boolean; assets: { name: string; uri: string; size?: number }[] }>>();
const mockWorkbookPick = jest.fn<() => Promise<{ canceled: boolean; result: File | null }>>();
const mockShare = jest.fn<(uri: string, options?: unknown) => Promise<void>>().mockResolvedValue(undefined);
const mockShareAvailable = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
const mockPrepare = jest.fn<(assets: { uri: string }[]) => Promise<Photo[]>>();
const mockDiscard = jest.fn<(photos: Iterable<Photo>) => void>();
function mockPut(uri: string, bytes: Uint8Array) { mockFiles.set(uri, { data: bytes.slice(), size: bytes.length }); }
function mockData(uri: string) { const value = mockFiles.get(uri)!; return value.data.subarray(0, value.size); }

jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockId}` }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (options?: unknown) => mockPick(options) }));
jest.mock('expo-sharing', () => ({ shareAsync: (uri: string, options?: unknown) => mockShare(uri, options), isAvailableAsync: () => mockShareAvailable() }));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: '/bundled/sample.jpg' }) }) } }));
jest.mock('../src/storage/images', () => ({
  photoSource: (photo: Photo) => photo.image.kind === 'bundled' ? 1 : { uri: `/images/${photo.image.file}` },
  preparePhotoFiles: (assets: { uri: string }[]) => mockPrepare(assets),
  discardPreparedPhotos: (photos: Iterable<Photo>) => mockDiscard(photos),
}));
jest.mock('expo-file-system', () => {
  const join = (parts: (string | { uri: string })[]) => parts.map(part => (typeof part === 'string' ? part : part.uri).replace(/\/$/, '')).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = join(parts); }
    get name() { return this.uri.split('/').at(-1) ?? ''; }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri)?.size ?? 0; }
    create() { mockPut(this.uri, new Uint8Array()); }
    delete() { mockFiles.delete(this.uri); }
    async copy(target: File) {
      if (mockCopyError) throw mockCopyError;
      mockPut(target.uri, mockData(this.uri));
    }
    async write(bytes: Uint8Array) { mockPut(this.uri, bytes); }
    async bytes() { mockWholeReads.push(this.uri); return mockData(this.uri); }
    static pickFileAsync() { return mockWorkbookPick(); }
    open() {
      if (this.uri.startsWith('content://')) throw new Error('Content URI does not support random-access FileHandle');
      let offset = 0;
      let closed = false;
      mockOpenHandles++;
      const read = (size: number) => { mockReadSizes.push(size); const result = mockData(this.uri).slice(offset, offset + size); offset += result.length; return result; };
      return {
        get offset() { return offset; }, set offset(value: number) { offset = value; },
        readBytesSync: read, readBytes: async (size: number) => read(size),
        writeBytesSync: (bytes: Uint8Array) => {
          const stored = mockFiles.get(this.uri)!;
          if (stored.data.length < offset + bytes.length) {
            const grown = new Uint8Array(Math.max(offset + bytes.length, stored.data.length * 2, 1024)); grown.set(stored.data); stored.data = grown;
          }
          stored.data.set(bytes, offset); offset += bytes.length; stored.size = Math.max(stored.size, offset);
        },
        close: () => { if (!closed) mockOpenHandles--; closed = true; },
      };
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = join(parts); }
    get exists() { return mockDirs.has(this.uri); }
    create() { mockDirs.add(this.uri); }
    delete() { for (const uri of mockFiles.keys()) if (uri.startsWith(`${this.uri}/`)) mockFiles.delete(uri); mockDirs.delete(this.uri); }
  }
  return { File, Directory, get Paths() { return mockPaths; }, FileMode: { ReadOnly: 'r', WriteOnly: 'w' } };
});

beforeEach(() => {
  jest.clearAllMocks(); mockFiles.clear(); mockDirs.clear(); mockId = 0; mockOpenHandles = 0; mockCopyError = null;
  mockWorkbookPick.mockReset();
  mockReadSizes.length = 0; mockWholeReads.length = 0; mockPaths.availableDiskSpace = 3 * 1024 ** 3;
  mockPrepare.mockImplementation(async assets => assets.map(() => ({ ...seedCatalog.photos[0], id: `prepared-${++mockId}`, image: { kind: 'local', file: 'prepared.jpg', thumbnail: 'prepared-thumb.jpg' } })));
  mockShareAvailable.mockResolvedValue(true);
});
const selection = (name: string, uri: string, size?: number) => ({ canceled: false, assets: [{ name, uri, ...(size !== undefined ? { size } : {}) }] });
const cachedFiles = () => [...mockFiles.keys()].filter(uri => uri.startsWith('/cache/arwana-transfers/'));

function streamedZip(entries: Record<string, Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const zip = new Zip((error, data, final) => {
    if (error) throw error;
    chunks.push(data);
    if (final) return;
  });
  for (const [name, payload] of Object.entries(entries)) {
    const entry = new ZipDeflate(name);
    zip.add(entry);
    entry.push(payload, true);
  }
  zip.end();
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

test('native export streams both bundled and local images and produces matching workbook filenames', async () => {
  const catalog = cloneCatalog(seedCatalog);
  catalog.photos = [catalog.photos[0], { ...catalog.photos[1], image: { kind: 'local', file: 'local.jpg', thumbnail: 'local-thumb.jpg' } }];
  mockPut('/bundled/sample.jpg', new Uint8Array([1, 2, 3]));
  mockPut('/images/local.jpg', new Uint8Array([4, 5, 6]));
  const files = await createExport(catalog, jest.fn());
  const archive = unzipSync(mockData(files.photos!));
  const book = decodeWorkbook(mockData(files.workbook));
  expect(Object.keys(archive)).toEqual(['photos/photo-0001.jpg', 'photos/photo-0002.jpg']);
  expect(archive['photos/photo-0002.jpg']).toEqual(new Uint8Array([4, 5, 6]));
  expect(book.photos.map(row => row.value.filename)).toEqual(['photo-0001.jpg', 'photo-0002.jpg']);
  expect(mockWholeReads).toEqual([]);
  expect(mockOpenHandles).toBe(0);
});

test('export keeps canonical JPEG filenames aligned with image bytes after reordering', async () => {
  const original = cloneCatalog(seedCatalog);
  original.photos = [
    { ...original.photos[0], sourceFilename: 'room.png', image: { kind: 'local', file: 'one.jpg', thumbnail: 'one-thumb.jpg' } },
    { ...original.photos[1], sourceFilename: 'room.jpg', image: { kind: 'local', file: 'two.jpg', thumbnail: 'two-thumb.jpg' } },
  ];
  const catalog = normalizePhotoFilenames(original);
  catalog.photos.reverse();
  mockPut('/images/one.jpg', new Uint8Array([1]));
  mockPut('/images/two.jpg', new Uint8Array([2]));
  const files = await createExport(catalog, jest.fn());
  const archive = unzipSync(mockData(files.photos!));
  const book = decodeWorkbook(mockData(files.workbook));
  expect(book.photos.map(row => row.value.filename)).toEqual(['room.jpg', 'room-2.jpg']);
  expect(archive['photos/room.jpg']).toEqual(new Uint8Array([2]));
  expect(archive['photos/room-2.jpg']).toEqual(new Uint8Array([1]));
  expect(mockOpenHandles).toBe(0);
});

test('an incomplete draft exports an importable workbook and its matching image', async () => {
  const catalog = cloneCatalog(seedCatalog);
  catalog.photos = [{ ...catalog.photos[0], styleId: '', paletteIds: [], materialIds: [], detailIds: [] }];
  mockPut('/bundled/sample.jpg', new Uint8Array([1, 2, 3]));
  const files = await createExport(catalog, jest.fn());
  const book = decodeWorkbook(mockData(files.workbook));
  expect(book.issues).toEqual([]);
  expect(book.photos[0].value).toMatchObject({ filename: 'photo-0001.jpg', style: { ru: '', tk: '' }, palette: [], material: [], detail: [] });
  expect(Object.keys(unzipSync(mockData(files.photos!)))).toEqual(['photos/photo-0001.jpg']);
  expect(mockOpenHandles).toBe(0);
});

test('ZIP import accepts compressed photos, checks their bytes, and removes extraction files', async () => {
  mockPut('/input/photos.zip', zipSync({ 'photos/room.jpg': new Uint8Array(20000).fill(42) }));
  mockPick.mockResolvedValue(selection('photos.zip', '/input/photos.zip'));
  mockPrepare.mockImplementation(async assets => {
    expect(mockData(assets[0].uri)).toEqual(new Uint8Array(20000).fill(42));
    return [{ ...seedCatalog.photos[0] }];
  });
  const images = await pickImportImages(jest.fn());
  expect(images!.has('room.jpg')).toBe(true);
  expect(cachedFiles()).toEqual([]);
  expect(mockOpenHandles).toBe(0);
  expect(mockWholeReads).toEqual([]);
});

test('invalid and ambiguous ZIP paths are rejected before image conversion', async () => {
  for (const zip of [zipSync({ '../escape.jpg': new Uint8Array([1]) }), zipSync({ 'one/room.jpg': new Uint8Array([1]), 'two/ROOM.JPG': new Uint8Array([2]) })]) {
    mockPut('/input/bad.zip', zip); mockPick.mockResolvedValue(selection('bad.zip', '/input/bad.zip'));
    await expect(pickImportImages(jest.fn())).rejects.toBeInstanceOf(AppError);
    expect(mockOpenHandles).toBe(0);
    expect(cachedFiles()).toEqual([]);
  }
  expect(mockPrepare).not.toHaveBeenCalled();
});

test('corrupt ZIP image data fails CRC validation and leaves no staged extraction files', async () => {
  const bytes = zipSync({ 'room.jpg': new Uint8Array([1, 2, 3]) }, { level: 0 });
  bytes[30 + 'room.jpg'.length] ^= 255;
  mockPut('/input/bad.zip', bytes); mockPick.mockResolvedValue(selection('bad.zip', '/input/bad.zip'));
  await expect(pickImportImages(jest.fn())).rejects.toThrow('INVALID_ARCHIVE');
  expect(cachedFiles()).toEqual([]);
  expect(mockOpenHandles).toBe(0);
});

test('a later image conversion failure releases already prepared images', async () => {
  mockPut('/input/a.jpg', new Uint8Array([1])); mockPut('/input/b.jpg', new Uint8Array([2]));
  mockPick.mockResolvedValue({ canceled: false, assets: [{ name: 'a.jpg', uri: '/input/a.jpg' }, { name: 'b.jpg', uri: '/input/b.jpg' }] });
  const staged = { ...seedCatalog.photos[0] };
  mockPrepare.mockResolvedValueOnce([staged]).mockRejectedValueOnce(new AppError('IMPORT_FAILED'));
  let discarded: Photo[] = [];
  mockDiscard.mockImplementation(photos => { discarded = [...photos]; });
  await expect(pickImportImages(jest.fn())).rejects.toMatchObject({ code: 'IMPORT_FAILED', detail: 'b.jpg' });
  expect(discarded).toEqual([staged]);
});

test('canceling an export removes both partial outputs and closes file handles', async () => {
  mockPut('/bundled/sample.jpg', new Uint8Array(70000));
  const abort = new AbortController();
  await expect(createExport(seedCatalog, () => abort.abort(), abort.signal)).rejects.toThrow('TRANSFER_CANCELED');
  expect(cachedFiles()).toEqual([]);
  expect(mockOpenHandles).toBe(0);
});

test('low storage fails before output creation and sharing availability is checked', async () => {
  mockPaths.availableDiskSpace = 1;
  await expect(createExport(seedCatalog, jest.fn())).rejects.toThrow('STORAGE_FULL');
  expect(cachedFiles()).toEqual([]);
  mockShareAvailable.mockResolvedValue(false);
  await expect(shareExport('/missing.xlsx')).rejects.toThrow('SHARING_UNAVAILABLE');
  expect(mockShare).not.toHaveBeenCalled();
});

test('canceling the native workbook picker is a no-op and a chosen workbook is parsed', async () => {
  mockWorkbookPick.mockResolvedValueOnce({ canceled: true, result: null });
  expect(await pickWorkbook()).toBeNull();
  mockPut('/input/catalog.xlsx', encodeWorkbook(seedCatalog));
  mockWorkbookPick.mockResolvedValue({ canceled: false, result: new File('/input/catalog.xlsx') });
  expect((await pickWorkbook())!.workbook.photos).toHaveLength(seedCatalog.photos.length);
});

test('an unreadable selected workbook reports a specific file-read error', async () => {
  mockWorkbookPick.mockResolvedValue({ canceled: false, result: new File('/input/unavailable.xlsx') });
  await expect(pickWorkbook()).rejects.toMatchObject({ code: 'WORKBOOK_READ_FAILED', detail: 'unavailable.xlsx' });
});

test('500-photo export uses bounded reads and reports progress through completion', async () => {
  const catalog = cloneCatalog(seedCatalog);
  catalog.photos = Array.from({ length: 500 }, (_, index) => ({ ...seedCatalog.photos[0], id: `photo-${index}` }));
  mockPut('/bundled/sample.jpg', new Uint8Array(2048));
  const progress = jest.fn();
  const files = await createExport(catalog, progress);
  expect(Object.keys(unzipSync(mockData(files.photos!)))).toHaveLength(500);
  expect(progress).toHaveBeenLastCalledWith(500, 500);
  expect(Math.max(...mockReadSizes)).toBeLessThanOrEqual(65536);
  expect(mockWholeReads).toEqual([]);
  expect(mockOpenHandles).toBe(0);
}, 15000);

test('Android ZIP import skips unscoped DocumentPicker caching and extracts streamed data-descriptor archives from content:// URIs', async () => {
  const previousOS = Platform.OS;
  Platform.OS = 'android';
  try {
    const archive = streamedZip({
      'mahri.png': new Uint8Array(25000).fill(11),
      'nazar.png': new Uint8Array(30000).fill(22),
      '1.png': new Uint8Array(40000).fill(33),
    });
    const contentUri = 'content://com.android.externalstorage.documents/document/primary%3ADownload%2Finput.zip';
    mockPut(contentUri, archive);
    mockPick.mockResolvedValue(selection('input.zip', contentUri, archive.length));
    const images = await pickImportImages(jest.fn());
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ copyToCacheDirectory: false, multiple: true }));
    expect([...images!.keys()]).toEqual(['mahri.png', 'nazar.png', '1.png']);
    expect(cachedFiles()).toEqual([]);
    expect(mockWholeReads).toEqual([]);
    expect(mockOpenHandles).toBe(0);
  } finally { Platform.OS = previousOS; }
});

test('Android photo import stages content:// images into scoped cache and falls back to bytes() if copy fails', async () => {
  const previousOS = Platform.OS;
  Platform.OS = 'android';
  try {
    const contentUri = 'content://com.android.providers.downloads.documents/document/msf%3A1001';
    mockPut(contentUri, new Uint8Array([10, 20, 30]));
    mockPick.mockResolvedValue(selection('1.png', contentUri, 3));
    mockCopyError = new Error('Source has no file name');
    mockPrepare.mockImplementation(async assets => {
      expect(assets[0].uri.startsWith('/cache/arwana-transfers/')).toBe(true);
      expect(mockData(assets[0].uri)).toEqual(new Uint8Array([10, 20, 30]));
      return [{ ...seedCatalog.photos[0] }];
    });
    const images = await pickImportImages(jest.fn());
    expect(images!.has('1.png')).toBe(true);
    expect(cachedFiles()).toEqual([]);
  } finally { Platform.OS = previousOS; }
});

test('iOS keeps copyToCacheDirectory enabled and corrupt ZIP streams report INVALID_ARCHIVE', async () => {
  const previousOS = Platform.OS;
  Platform.OS = 'ios';
  try {
    const base = streamedZip({ '1.png': new Uint8Array(10000).fill(7) });
    // Corrupt deflate payload inside the compressed stream before the data descriptor.
    base[45] ^= 0xff;
    mockPut('/input/corrupt.zip', base);
    mockPick.mockResolvedValue(selection('corrupt.zip', '/input/corrupt.zip'));
    await expect(pickImportImages(jest.fn())).rejects.toMatchObject({ code: 'INVALID_ARCHIVE' });
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ copyToCacheDirectory: true, multiple: true }));
    expect(cachedFiles()).toEqual([]);
    expect(mockOpenHandles).toBe(0);
  } finally { Platform.OS = previousOS; }
});
