import { AppError } from './errors';
import type { Catalog, Photo } from './types';

export const filenameKey = (name: string) => name.normalize('NFC').toLocaleLowerCase('en-US');
export const validFilename = (name: string) => name.length <= 200 && !/[\\/:\x00-\x1f]/.test(name) && /\.(jpe?g|png|heic|heif|webp)$/i.test(name) && !name.startsWith('.');
export const exportFilename = (index: number) => `photo-${String(index + 1).padStart(4, '0')}.jpg`;

function cleanFilename(value: string | undefined, jpeg = false): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new AppError('INVALID_CATALOG');
  const name = value.trim().normalize('NFC');
  if (!validFilename(name) || (jpeg && !/\.jpg$/i.test(name))) throw new AppError('INVALID_CATALOG');
  return name;
}

/**
 * Filename identity belongs to the photo, not its position in a list. This is pure
 * so workbook and ZIP generation can share one normalized snapshot without saving.
 */
export function normalizePhotoFilenames(catalog: Catalog, previous?: Catalog, reserved: readonly string[] = []): Catalog {
  const old = previous ? normalizePhotoFilenames(previous) : undefined;
  const oldPhotos = new Map(old?.photos.map(photo => [photo.id, photo]));
  const photos: Photo[] = catalog.photos.map(photo => {
    const existing = oldPhotos.get(photo.id);
    return {
      ...photo,
      exportFilename: cleanFilename(existing?.exportFilename ?? photo.exportFilename, true),
      sourceFilename: cleanFilename(existing?.sourceFilename ?? photo.sourceFilename),
    };
  });
  const validCounter = (value: number | undefined) => Number.isSafeInteger(value) && value! > 0 ? value! : 1;
  let nextPhotoNumber = Math.max(validCounter(catalog.nextPhotoNumber), validCounter(old?.nextPhotoNumber));
  const owners = new Map<string, string>();
  const reservedNames = new Set(reserved.map(filenameKey));
  const ids = new Set<string>();
  function reserve(name: string, id: string) {
    const key = filenameKey(name);
    const owner = owners.get(key);
    if (owner !== undefined && owner !== id) throw new AppError('DUPLICATE_FILENAME');
    owners.set(key, id);
    const number = /^photo-(\d+)\.jpg$/i.exec(name);
    if (number && Number.isSafeInteger(Number(number[1])) && Number(number[1]) < Number.MAX_SAFE_INTEGER) {
      nextPhotoNumber = Math.max(nextPhotoNumber, Number(number[1]) + 1);
    }
  }
  // Reserve every original name before selecting JPEG names. For example, both
  // living.png and living.jpg may be separate photos in the same import.
  for (const photo of photos) {
    if (ids.has(photo.id)) throw new AppError('INVALID_CATALOG');
    ids.add(photo.id);
    if (photo.exportFilename) reserve(photo.exportFilename, photo.id);
    if (photo.sourceFilename) reserve(photo.sourceFilename, photo.id);
  }
  const available = (name: string, photo: Photo) => {
    const key = filenameKey(name);
    const owner = owners.get(key);
    return owner === photo.id || (owner === undefined && !reservedNames.has(key));
  };
  for (const photo of photos) {
    if (!photo.exportFilename) {
      let filename: string;
      if (photo.sourceFilename) {
        const stem = photo.sourceFilename.replace(/\.[^.]+$/, '');
        filename = `${stem.slice(0, 196)}.jpg`;
        for (let suffix = 2; !available(filename, photo); suffix++) {
          const ending = `-${suffix}.jpg`;
          filename = `${stem.slice(0, 200 - ending.length)}${ending}`;
        }
      } else {
        do {
          if (nextPhotoNumber >= Number.MAX_SAFE_INTEGER) throw new AppError('INVALID_CATALOG');
          filename = exportFilename(nextPhotoNumber++ - 1);
        } while (!available(filename, photo));
      }
      reserve(filename, photo.id);
      photo.exportFilename = filename;
    }
    if (!photo.sourceFilename || filenameKey(photo.sourceFilename) === filenameKey(photo.exportFilename)) delete photo.sourceFilename;
  }
  return { ...catalog, photos, nextPhotoNumber };
}
