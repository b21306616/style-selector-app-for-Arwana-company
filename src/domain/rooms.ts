import type { Catalog, Labels, RoomDefinition } from './types';

export const defaultRooms: RoomDefinition[] = [
  { id: 'bathroom', labels: { tk: 'Wanna otagy', ru: 'Ванная' } },
  { id: 'bedroom', labels: { tk: 'Ýatylýan otag', ru: 'Спальня' } },
  { id: 'living_room', labels: { tk: 'Myhman otagy', ru: 'Гостиная' } },
  { id: 'kitchen', labels: { tk: 'Aşhana', ru: 'Кухня' } },
];

export const nameKey = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase();
export const cleanLabels = (labels: Labels): Labels => ({ ru: labels.ru.trim().normalize('NFC'), tk: labels.tk.trim().normalize('NFC') });
export const validLabels = (labels: Labels) => (['ru', 'tk'] as const).every(language => typeof labels?.[language] === 'string' && !!labels[language].trim() && labels[language].trim().length <= 100);
export const sameName = (a: Labels, b: Labels) => (['ru', 'tk'] as const).some(language => nameKey(a[language]) === nameKey(b[language]));
export const validRoomId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id) && !['whole_house', 'all', '__proto__', 'constructor', 'prototype'].includes(id);
export const catalogSpaces = (catalog: Pick<Catalog, 'rooms'>) => ['whole_house', ...catalog.rooms.map(room => room.id)];
export const hasRoom = (catalog: Pick<Catalog, 'rooms'>, id: string) => catalog.rooms.some(room => room.id === id);

/** Only the absent property denotes a legacy payload. An explicit empty list stays empty. */
export function normalizeCatalog(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Object.hasOwn(input, 'rooms')) return input;
  return { ...input, rooms: defaultRooms.map(room => ({ ...room, labels: { ...room.labels } })) };
}
