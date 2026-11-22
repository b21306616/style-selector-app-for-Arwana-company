import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { bundledImages, bundledThumbnails } from '../data/bundled-images';
import { AppError, errorCode } from '../domain/errors';
import { Catalog, Photo, Room } from '../domain/types';

let importing = false;
const directory = () => new Directory(Paths.document, 'arwana-images');
const safeName = (name: string) => /^[a-zA-Z0-9_-]+\.jpg$/.test(name);

export function photoSource(photo: Photo, thumbnail = false): number | { uri: string } | undefined {
  if (photo.image.kind === 'bundled') {
    return (thumbnail ? bundledThumbnails : bundledImages)[photo.image.key];
  }
  const name = thumbnail ? photo.image.thumbnail : photo.image.file;
  return safeName(name) ? { uri: new File(directory(), name).uri } : undefined;
}

export interface ImageInput { uri: string; width?: number; height?: number; fileSize?: number }

/** Imports are all-or-nothing. The caller saves returned metadata into the draft. */
async function processPhotoSelection(select: () => Promise<readonly ImageInput[]>, room: Room, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<Photo[]> {
  if (importing) throw new Error('IMPORT_BUSY');
  importing = true;
  const created: File[] = [];
  const temporary: File[] = [];
  try {
    const assets = await select();
    if (!assets.length) return [];
    directory().create({ idempotent: true, intermediates: true });
    const photos: Photo[] = [];
    for (const asset of assets) {
      if (signal?.aborted) throw new AppError('TRANSFER_CANCELED');
      if ((asset.width !== undefined && (!Number.isFinite(asset.width) || asset.width <= 0)) ||
          (asset.height !== undefined && (!Number.isFinite(asset.height) || asset.height <= 0)) ||
          (asset.width ?? 1) * (asset.height ?? 1) > 80_000_000 || (asset.fileSize ?? 0) > 50 * 1024 * 1024) {
        throw new Error('IMAGE_TOO_LARGE');
      }
      if (Paths.availableDiskSpace < 30 * 1024 * 1024) throw new Error('STORAGE_FULL');
      const id = Crypto.randomUUID();
      const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 });
      let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
      try {
        rendered = await context.renderAsync();
        const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.84 });
        if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) throw new AppError('IMPORT_FAILED');
        const source = new File(image.uri);
        temporary.push(source);
        const target = new File(directory(), `${id}.jpg`);
        // Track destinations before copying: a failed copy may still leave a partial file.
        created.push(target);
        await source.copy(target);
        const thumbContext = ImageManipulator.manipulate(image.uri, { maxWidth: 320, maxHeight: 320 });
        let thumbImage: Awaited<ReturnType<typeof thumbContext.renderAsync>> | undefined;
        try {
          thumbImage = await thumbContext.renderAsync();
          const thumbnail = await thumbImage.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
          const thumbSource = new File(thumbnail.uri);
          temporary.push(thumbSource);
          const thumbTarget = new File(directory(), `${id}-thumb.jpg`);
          created.push(thumbTarget);
          await thumbSource.copy(thumbTarget);
          photos.push({
            id, room, styleId: '', paletteIds: [], materialIds: [], detailIds: [],
            image: { kind: 'local', file: `${id}.jpg`, thumbnail: `${id}-thumb.jpg` },
            width: image.width, height: image.height, sample: false,
          });
        } finally { thumbImage?.release(); thumbContext.release(); }
      } finally { rendered?.release(); context.release(); }
      onProgress?.(photos.length, assets.length);
      if (signal?.aborted) throw new AppError('TRANSFER_CANCELED');
    }
    return photos;
  } catch (error) {
    for (const file of created) { try { if (file.exists) file.delete(); } catch { /* A later sweep retries. */ } }
    const code = errorCode(error);
    throw new AppError(code === 'STORAGE_ERROR' ? 'IMPORT_FAILED' : code);
  } finally {
    for (const file of temporary) { try { if (file.exists) file.delete(); } catch { /* OS cache can be reclaimed. */ } }
    importing = false;
  }
}

export async function importPhotos(room: Room = 'bathroom', onProgress?: (done: number, total: number) => void): Promise<Photo[]> {
  return processPhotoSelection(async () => {
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 1, exif: false, base64: false });
    if (selection.canceled) return [];
    if (selection.assets.length > 20) throw new AppError('IMPORT_LIMIT');
    return selection.assets;
  }, room, onProgress);
}

export async function pickDraftPhoto(room: Room): Promise<Photo | null> {
  const photos = await processPhotoSelection(async () => {
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: false, base64: false });
    return selection.canceled ? [] : selection.assets.slice(0, 1);
  }, room);
  return photos[0] ?? null;
}

export function preparePhotoFiles(assets: ImageInput[], onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<Photo[]> {
  return processPhotoSelection(() => Promise.resolve(assets), 'bathroom', onProgress, signal);
}

/** Only call for newly prepared photos that have never been committed to a catalog. */
export function discardPreparedPhotos(photos: Iterable<Photo>) {
  for (const photo of photos) if (photo.image.kind === 'local') {
    for (const name of [photo.image.file, photo.image.thumbnail]) if (safeName(name)) {
      try { const file = new File(directory(), name); if (file.exists) file.delete(); } catch { /* Startup cleanup retries. */ }
    }
  }
}

export async function assertCatalogImages(catalog: Catalog): Promise<void> {
  for (const photo of catalog.photos) {
    if (photo.image.kind === 'bundled') {
      if (!bundledImages[photo.image.key] || !bundledThumbnails[photo.image.key]) throw new Error('IMAGE_MISSING');
    } else {
      if (![photo.image.file, photo.image.thumbnail].every(name => safeName(name) && new File(directory(), name).exists)) {
        throw new Error('IMAGE_MISSING');
      }
    }
  }
}

/** Only sweep the app-owned image directory, retaining every referenced revision. */
export async function cleanupImageFiles(catalogs: Catalog[]): Promise<void> {
  if (importing || !directory().exists) return;
  const retained = new Set<string>();
  for (const catalog of catalogs) {
    for (const photo of catalog.photos) {
      if (photo.image.kind === 'local') {
        retained.add(photo.image.file);
        retained.add(photo.image.thumbnail);
      }
    }
  }
  for (const file of directory().list()) {
    // Allow newly imported, not-yet-saved files a grace period, including a backgrounded picker.
    const modified = file instanceof File ? file.lastModified : null;
    if (file instanceof File && safeName(file.name) && !retained.has(file.name) &&
        modified !== null && modified > 0 && Date.now() - modified > 60 * 60 * 1000) {
      try { file.delete(); } catch { /* Reattempt at the next launch. */ }
    }
  }
}
