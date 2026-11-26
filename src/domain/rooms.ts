import type { Catalog, Labels, RoomDefinition } from './types';
import { normalizePhotoFilenames } from './photo-filenames';
import { AppError } from './errors';

export const LEGACY_HOUSE_ID = 'whole_house';

export const defaultRooms: RoomDefinition[] = [
  { id: 'bathroom', labels: { tk: 'Wanna otagy', ru: 'Ванная' } },
  { id: 'bedroom', labels: { tk: 'Ýatylýan otag', ru: 'Спальня' } },
  { id: 'living_room', labels: { tk: 'Myhman otagy', ru: 'Гостиная' } },
  { id: 'kitchen', labels: { tk: 'Aşhana', ru: 'Кухня' } },
];

export const nameKey = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase('en-US');
export const cleanLabels = (labels: Labels): Labels => ({ ru: labels.ru.trim().normalize('NFC'), tk: labels.tk.trim().normalize('NFC') });
export function validDraftLabels(labels: Labels): boolean {
  if (typeof labels?.ru !== 'string' || typeof labels?.tk !== 'string') return false;
  const ru = labels.ru.trim();
  const tk = labels.tk.trim();
  return !!(ru || tk) && ru.length <= 100 && tk.length <= 100;
}
export const validLabels = (labels: Labels) => validDraftLabels(labels) && !!labels.ru.trim() && !!labels.tk.trim();
export const sameName = (a: Labels, b: Labels) => (['ru', 'tk'] as const).some(language => nameKey(a[language]) === nameKey(b[language]));
export const validRoomId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id) && ![LEGACY_HOUSE_ID, 'all', '__proto__', 'constructor', 'prototype'].includes(id);
export const catalogSpaces = (catalog: Pick<Catalog, 'rooms'>) => catalog.rooms.map(room => room.id);
export const hasRoom = (catalog: Pick<Catalog, 'rooms'>, id: string) => catalog.rooms.some(room => room.id === id);

/** Only the absent property denotes a legacy payload. An explicit empty list stays empty. */
export function normalizeCatalog(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const catalog = (Object.hasOwn(input, 'rooms') ? input : { ...input, rooms: defaultRooms.map(room => ({ ...room, labels: { ...room.labels } })) }) as Catalog;
  if (!Array.isArray(catalog.photos) || catalog.photos.some(photo => !photo || typeof photo.id !== 'string')) return catalog;
  return normalizePhotoFilenames(catalog);
}

/** Move old mixed-gallery selections into their rooms, preserving both existing orders. */
export function migrateLegacyGallery(catalog: Catalog): Catalog {
  if (!catalog?.galleries || !Object.hasOwn(catalog.galleries, LEGACY_HOUSE_ID)) return catalog;
  const { [LEGACY_HOUSE_ID]: mixed, ...galleries } = catalog.galleries;
  if (!Array.isArray(mixed)) throw new AppError('INVALID_CATALOG');
  const roomForPhoto = new Map(catalog.photos.map(photo => [photo.id, photo.room]));
  const selected = new Set<string>();
  const roomIds = new Set(catalogSpaces(catalog));
  for (const room of roomIds) {
    if (!Array.isArray(galleries[room])) throw new AppError('INVALID_CATALOG');
    galleries[room] = [...galleries[room]];
    for (const id of galleries[room]) selected.add(id);
  }
  for (const id of mixed) {
    const room = roomForPhoto.get(id);
    if (room && roomIds.has(room) && !selected.has(id)) {
      galleries[room].push(id);
      selected.add(id);
    }
  }
  return { ...catalog, galleries };
}
