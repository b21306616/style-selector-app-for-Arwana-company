import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { seedCatalog } from '../src/data/catalog';
import type { Catalog, Photo } from '../src/domain/types';

type StoredFile = { lastModified: number; size: number };
type PickerAsset = { uri: string; width: number; height: number; fileSize?: number };
type PickerResult = { canceled: true; assets: null } | { canceled: false; assets: PickerAsset[] };
const mockFiles = new Map<string, StoredFile>();
const mockDirectories = new Set<string>();
const mockDimensions = new Map<string, { width: number; height: number }>();
const mockManipulations: { source: string; maxWidth: number; maxHeight: number; contextReleased: boolean; imageReleased: boolean }[] = [];
const mockPaths = { document: '/document', availableDiskSpace: 1_000_000_000 };
const mockPick = jest.fn<(options?: unknown) => Promise<PickerResult>>();
let mockNow = 1_800_000_000_000;
let mockUuid = 0;
let mockCopies = 0;
let mockFailCopyAt = 0;
let mockFailRenderAt = 0;
let mockSaved = 0;
const mockJoin = (parts: (string | { uri: string })[]) => parts.map((part) => typeof part === 'string' ? part.replace(/\/$/, '') : part.uri.replace(/\/$/, '')).join('/');

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = mockJoin(parts); }
    get name() { return this.uri.split('/').at(-1)!; }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri)?.size ?? 0; }
    get lastModified() { return mockFiles.get(this.uri)?.lastModified ?? 0; }
    copy(target: File) {
      const source = mockFiles.get(this.uri);
      if (!source) throw new Error('Source missing');
      mockFiles.set(target.uri, { ...source, lastModified: mockNow });
      mockCopies += 1;
      if (mockCopies === mockFailCopyAt) throw new Error('Native copy failed after creating a partial file');
    }
    delete() { mockFiles.delete(this.uri); }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = mockJoin(parts); }
    get exists() { return mockDirectories.has(this.uri); }
    create() { mockDirectories.add(this.uri); }
    list() { return [...mockFiles.keys()].filter((uri) => uri.startsWith(`${this.uri}/`)).map((uri) => new File(uri)); }
  }
  return { File, Directory, Paths: mockPaths };
});
jest.mock('expo-crypto', () => ({ randomUUID: () => `photo-${++mockUuid}` }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: mockPick, UIImagePickerPreferredAssetRepresentationMode: { Current: 'current' } }));
jest.mock('../src/data/bundled-images', () => ({ bundledImages: { sample: 1 }, bundledThumbnails: { sample: 2 } }), { virtual: true });
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (source: string, options: { maxWidth: number; maxHeight: number }) => {
      const record = { source, ...options, contextReleased: false, imageReleased: false };
      mockManipulations.push(record);
      return {
        renderAsync: async () => {
          if (mockManipulations.length === mockFailRenderAt) throw new Error('Native decode failed');
          return {
            saveAsync: async () => {
              const original = mockDimensions.get(source)!;
              const factor = Math.min(1, options.maxWidth / original.width, options.maxHeight / original.height);
              const size = { width: Math.round(original.width * factor), height: Math.round(original.height * factor) };
              const uri = `/cache/rendered-${++mockSaved}.jpg`;
              mockFiles.set(uri, { lastModified: mockNow, size: 50_000 });
              mockDimensions.set(uri, size);
              return { uri, ...size };
            },
            release: () => { record.imageReleased = true; },
          };
        },
        release: () => { record.contextReleased = true; },
      };
    },
  },
}));

type Images = typeof import('../src/storage/images');
let images: Images;

function asset(id: string, width = 6000, height = 4000): PickerAsset {
  const uri = `/original/${id}.jpg`;
  mockFiles.set(uri, { lastModified: mockNow, size: 8_000_000 });
  mockDimensions.set(uri, { width, height });
  return { uri, width, height, fileSize: 8_000_000 };
}
const catalogWith = (photos: Photo[]): Catalog => ({ ...seedCatalog, photos });
const appFiles = () => [...mockFiles.keys()].filter((uri) => uri.startsWith('/document/') || uri.startsWith('/cache/'));

beforeEach(() => {
  mockFiles.clear(); mockDirectories.clear(); mockDimensions.clear(); mockManipulations.length = 0;
  mockUuid = 0; mockCopies = 0; mockFailCopyAt = 0; mockFailRenderAt = 0; mockSaved = 0;
  mockNow = 1_800_000_000_000; mockPaths.availableDiskSpace = 1_000_000_000;
  mockPick.mockReset();
  jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
  jest.isolateModules(() => { images = jest.requireActual<Images>('../src/storage/images'); });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('offline photo importing', () => {
  test.each([10 * 1024 * 1024 - 1, 10 * 1024 * 1024])('the draft picker accepts %i bytes and requests one original image', async bytes => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ ...asset('draft'), fileSize: bytes }] });
    const photo = await images.pickDraftPhoto('');
    expect(photo?.image.kind).toBe('local');
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: false, allowsEditing: false, mediaTypes: ['images'], quality: 1 }));
  });

  test('an oversized draft photo is rejected before any decoding or app-owned copies', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ ...asset('large'), fileSize: images.DRAFT_PHOTO_MAX_BYTES + 1 }] });
    await expect(images.pickDraftPhoto('kitchen')).rejects.toThrow('DRAFT_PHOTO_TOO_LARGE');
    expect(mockManipulations).toHaveLength(0);
    expect(appFiles()).toEqual([]);
    // The separate library importer keeps its existing larger limit.
    await expect(images.importPhotos('kitchen')).resolves.toHaveLength(1);
  });

  test('missing size metadata falls back to the file size and never accepts an unreadable size', async () => {
    const original = asset('size');
    delete original.fileSize;
    mockFiles.set(original.uri, { lastModified: mockNow, size: images.DRAFT_PHOTO_MAX_BYTES + 1 });
    mockPick.mockResolvedValue({ canceled: false, assets: [original] });
    await expect(images.pickDraftPhoto('kitchen')).rejects.toThrow('DRAFT_PHOTO_TOO_LARGE');
    mockFiles.delete(original.uri);
    await expect(images.pickDraftPhoto('kitchen')).rejects.toThrow('IMAGE_SIZE_UNAVAILABLE');
    expect(mockManipulations).toHaveLength(0);
    mockFiles.set(original.uri, { lastModified: mockNow, size: images.DRAFT_PHOTO_MAX_BYTES });
    await expect(images.pickDraftPhoto('kitchen')).resolves.toMatchObject({ room: 'kitchen' });
  });

  test('canceling the draft picker does not create files', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    await expect(images.pickDraftPhoto('')).resolves.toBeNull();
    expect(appFiles()).toEqual([]);
  });

  test('cancellation leaves storage untouched and releases the import guard', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    await expect(images.importPhotos()).resolves.toEqual([]);
    await expect(images.importPhotos()).resolves.toEqual([]);
    expect(mockDirectories.size).toBe(0);
    expect(mockManipulations).toHaveLength(0);
  });

  test('large sources are decoded with bounded dimensions, copied durably, and native images are released', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset('landscape'), asset('portrait', 3000, 5000)] });
    const photos = await images.importPhotos('bedroom');
    expect(photos).toHaveLength(2);
    expect(photos.every((photo) => photo.room === 'bedroom' && photo.image.kind === 'local' && Math.max(photo.width, photo.height) <= 1600)).toBe(true);
    expect(mockManipulations.map(({ maxWidth, maxHeight }) => [maxWidth, maxHeight])).toEqual([[1600, 1600], [320, 320], [1600, 1600], [320, 320]]);
    expect(mockManipulations.every((record) => record.contextReleased && record.imageReleased)).toBe(true);
    expect(appFiles()).toEqual(expect.arrayContaining(['/document/arwana-images/photo-1.jpg', '/document/arwana-images/photo-1-thumb.jpg']));
    expect([...mockFiles.keys()].some((uri) => uri.startsWith('/cache/'))).toBe(false);
    await expect(images.assertCatalogImages(catalogWith(photos))).resolves.toBeUndefined();
  });

  test('failure on a later partial copy rolls back the whole import, including the partially written target', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset('first'), asset('second')] });
    mockFailCopyAt = 4;
    await expect(images.importPhotos()).rejects.toThrow('IMPORT_FAILED');
    expect(appFiles()).toEqual([]);
    expect(mockManipulations.every((record) => record.contextReleased && record.imageReleased)).toBe(true);
    expect(mockFiles.has('/original/first.jpg')).toBe(true);
    expect(mockFiles.has('/original/second.jpg')).toBe(true);
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    await expect(images.importPhotos()).resolves.toEqual([]);
  });

  test('decode failures release contexts and do not leave temporary files', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset('bad')] });
    mockFailRenderAt = 1;
    await expect(images.importPhotos()).rejects.toThrow('IMPORT_FAILED');
    expect(mockManipulations[0].contextReleased).toBe(true);
    expect(appFiles()).toEqual([]);
  });

  test('invalid dimensions and low storage are rejected before decoding', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset('invalid', Number.NaN, 4000)] });
    await expect(images.importPhotos()).rejects.toThrow('IMAGE_TOO_LARGE');
    expect(mockManipulations).toHaveLength(0);
    mockPick.mockResolvedValue({ canceled: false, assets: [asset('normal')] });
    mockPaths.availableDiskSpace = 1000;
    await expect(images.importPhotos()).rejects.toThrow('STORAGE_FULL');
    expect(mockManipulations).toHaveLength(0);
  });

  test('an in-flight picker blocks a second import', async () => {
    let finish!: (result: PickerResult) => void;
    mockPick.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = images.importPhotos();
    await expect(images.importPhotos()).rejects.toThrow('IMPORT_BUSY');
    finish({ canceled: true, assets: null });
    await expect(first).resolves.toEqual([]);
  });

  test('cleanup retains referenced images and fresh imports but removes old orphans only inside the image directory', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset('retained')] });
    const photos = await images.importPhotos();
    mockNow += 2 * 60 * 60 * 1000;
    mockFiles.set('/document/arwana-images/orphan.jpg', { lastModified: mockNow - 2 * 60 * 60 * 1000, size: 100 });
    mockFiles.set('/document/arwana-images/fresh.jpg', { lastModified: mockNow, size: 100 });
    mockFiles.set('/document/outside.jpg', { lastModified: mockNow - 2 * 60 * 60 * 1000, size: 100 });
    await images.cleanupImageFiles([catalogWith(photos)]);
    expect(mockFiles.has('/document/arwana-images/photo-1.jpg')).toBe(true);
    expect(mockFiles.has('/document/arwana-images/photo-1-thumb.jpg')).toBe(true);
    expect(mockFiles.has('/document/arwana-images/fresh.jpg')).toBe(true);
    expect(mockFiles.has('/document/arwana-images/orphan.jpg')).toBe(false);
    expect(mockFiles.has('/document/outside.jpg')).toBe(true);
  });

  test('unsafe relative paths and missing assets cannot be used as image sources', async () => {
    const invalid: Photo = { ...seedCatalog.photos[0], image: { kind: 'local', file: '../outside.jpg', thumbnail: 'missing.jpg' } };
    expect(images.photoSource(invalid)).toBeUndefined();
    await expect(images.assertCatalogImages(catalogWith([invalid]))).rejects.toThrow('IMAGE_MISSING');
    const sample = { ...seedCatalog.photos[0], image: { kind: 'bundled' as const, key: 'sample' } };
    expect(images.photoSource(sample)).toBe(1);
    expect(images.photoSource(sample, true)).toBe(2);
  });
});
