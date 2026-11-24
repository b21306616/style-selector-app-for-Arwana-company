import { type Catalog, type Language, type RoomDefinition, type TermKind } from './types';
import { catalogSpaces, cleanLabels, nameKey, sameName, validLabels, validRoomId } from './rooms';
import { AppError } from './errors';

export interface ValidationIssue {
  code: string;
  subject: string;
  labels: Record<Language, string>;
}

const kinds: TermKind[] = ['style', 'palette', 'material', 'detail'];
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Structural and editorial checks; local image existence is checked by the storage boundary. */
export function validateCatalog(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, subject: string, tk: string, ru: string) => issues.push({ code, subject, labels: { tk, ru } });
  if (!input || typeof input !== 'object') {
    add('STRUCTURE', 'catalog', 'Katalog okalyp bilinmeýär.', 'Каталог не читается.');
    return issues;
  }
  const catalog = input as Catalog;
  if (!Array.isArray(catalog.rooms) || !Array.isArray(catalog.terms) || !Array.isArray(catalog.photos) || !catalog.galleries || typeof catalog.galleries !== 'object') {
    add('STRUCTURE', 'catalog', 'Katalogyň hökmany bölümleri ýok.', 'В каталоге отсутствуют обязательные разделы.');
    return issues;
  }
  const roomIds = new Set<string>();
  const roomNames = new Set<string>();
  let duplicateRoomName = false;
  for (const room of catalog.rooms) {
    if (!room || typeof room.id !== 'string' || !validRoomId(room.id) || !validLabels(room.labels) || roomIds.has(room.id)) {
      add('ROOM_DEFINITION', 'rooms', 'Otaglaryň ID-lerini we iki dilde atlaryny barlaň.', 'Проверьте идентификаторы и названия комнат на двух языках.');
      return issues;
    }
    roomIds.add(room.id);
    for (const language of ['ru', 'tk'] as const) {
      const key = `${language}:${nameKey(room.labels[language])}`;
      if (roomNames.has(key)) duplicateRoomName = true;
      roomNames.add(key);
    }
  }
  if (duplicateRoomName) {
    add('ROOM_NAME', 'rooms', 'Otaglaryň atlary gaýtalanmaly däl.', 'Названия комнат не должны повторяться.');
  }
  const spaces = catalogSpaces(catalog);
  const spaceIds = new Set(spaces);
  if (Object.keys(catalog.galleries).some(id => !spaceIds.has(id))) add('GALLERY', 'rooms', 'Näbelli otagyň toplumy bar.', 'Есть подборка неизвестной комнаты.');
  const terms = new Map<string, TermKind>();
  for (const term of catalog.terms) {
    if (!term || !nonempty(term.id) || !kinds.includes(term.kind)) {
      add('TERM', 'term', 'Sözlügiň ýazgysy nädogry.', 'Некорректная запись словаря.');
      continue;
    }
    if (terms.has(term.id)) add('DUPLICATE_TERM', term.id, 'Terminleriň ID-leri gaýtalanmaly däl.', 'Идентификаторы терминов должны быть уникальны.');
    terms.set(term.id, term.kind);
    if (!nonempty(term.labels?.tk) || !nonempty(term.labels?.ru)) add('TERM_LABEL', term.id, 'Türkmençe we rusça atlary goşuň.', 'Добавьте название на русском и туркменском.');
  }
  const selectedIds = new Set(spaces.flatMap((space) => Array.isArray(catalog.galleries[space]) ? catalog.galleries[space] : []));
  const photoIds = new Set<string>();
  const photoRooms = new Map<string, string>();
  for (const photo of catalog.photos) {
    if (!photo || !nonempty(photo.id)) {
      add('PHOTO', 'photo', 'Surat ýazgysy nädogry.', 'Некорректная запись фотографии.');
      continue;
    }
    if (photoIds.has(photo.id)) add('DUPLICATE_PHOTO', photo.id, 'Suratlaryň ID-leri gaýtalanmaly däl.', 'Идентификаторы фотографий должны быть уникальны.');
    photoIds.add(photo.id);
    photoRooms.set(photo.id, photo.room);
    if (!roomIds.has(photo.room)) add('ROOM', photo.id, 'Otagy saýlaň.', 'Выберите комнату.');
    if (selectedIds.has(photo.id) && terms.get(photo.styleId) !== 'style') add('STYLE', photo.id, 'Bar bolan stili saýlaň.', 'Выберите существующий стиль.');
    for (const [field, kind] of [['paletteIds', 'palette'], ['materialIds', 'material'], ['detailIds', 'detail']] as const) {
      const tags = photo[field];
      if (!Array.isArray(tags) || (selectedIds.has(photo.id) && !tags.length) || tags.some((id) => terms.get(id) !== kind) || new Set(tags).size !== tags.length) {
        add('TAGS', photo.id, `Gaýtalanmaýan degişli tegi (${kind === 'palette' ? 'palitra' : kind === 'material' ? 'materiallar' : 'aýratynlyklar'}) saýlaň.`, `Укажите существующие теги (${kind === 'palette' ? 'палитра' : kind === 'material' ? 'материалы' : 'детали'}) без повторов.`);
      }
    }
    if (!photo.image || !(['bundled', 'local'] as const).includes(photo.image.kind) ||
      (photo.image.kind === 'bundled' && !nonempty(photo.image.key)) ||
      (photo.image.kind === 'local' && (!nonempty(photo.image.file) || !nonempty(photo.image.thumbnail)))) {
      add('IMAGE', photo.id, 'Dogry surat goşuň.', 'Добавьте изображение.');
    }
    if (!Number.isFinite(photo.width) || !Number.isFinite(photo.height) || photo.width <= 0 || photo.height <= 0) add('DIMENSIONS', photo.id, 'Suratyň ölçegleri nädogry.', 'Некорректные размеры изображения.');
  }
  for (const space of spaces) {
    const deck = catalog.galleries[space];
    if (!Array.isArray(deck)) {
      add('GALLERY', space, 'Surat toplumy ýok.', 'Галерея отсутствует.');
      continue;
    }
    if (new Set(deck).size !== deck.length) add('DUPLICATE_GALLERY_PHOTO', space, 'Surat toplumynda gaýtalanýan suratlar bar.', 'В галерее есть повторяющиеся фотографии.');
    for (const id of deck) {
      if (!photoIds.has(id)) add('GALLERY_PHOTO', space, 'Saýlanan surat ýok.', 'Выбранная фотография не существует.');
    }
    if (space !== 'whole_house' && deck.some((id) => photoRooms.get(id) !== space)) add('GALLERY_ROOM', space, 'Otagyň surat toplumynda başga otagyň suraty bar.', 'В галерее есть фото другой комнаты.');
  }
  return issues;
}

export function cloneCatalog(catalog: Catalog): Catalog {
  return JSON.parse(JSON.stringify(catalog)) as Catalog;
}

export function termIsReferenced(catalog: Catalog, termId: string): boolean {
  return catalog.photos.some((photo) => photo.styleId === termId || photo.paletteIds.includes(termId) || photo.materialIds.includes(termId) || photo.detailIds.includes(termId));
}

export function addDraftRoom(current: Catalog, room: RoomDefinition): Catalog {
  const labels = cleanLabels(room.labels);
  if (!validRoomId(room.id) || !validLabels(labels)) throw new AppError('INVALID_CATALOG');
  if (current.rooms.some(item => item.id === room.id || sameName(item.labels, labels))) throw new AppError('DUPLICATE_ROOM');
  return { ...current, rooms: [...current.rooms, { ...room, labels }], galleries: { ...current.galleries, [room.id]: [] } };
}

/** Recheck the entire batch on the latest draft before changing any records. */
export function removeDraftOptions(current: Catalog, kind: 'room' | 'style', ids: string[]): Catalog {
  const selected = new Set(ids);
  const available = kind === 'room' ? current.rooms : current.terms.filter(term => term.kind === 'style');
  if (ids.some(id => !available.some(option => option.id === id))) throw new AppError('STALE_DRAFT');
  if (current.photos.some(photo => selected.has(kind === 'room' ? photo.room : photo.styleId))) throw new AppError(kind === 'room' ? 'REFERENCED_ROOM' : 'REFERENCED_TERM');
  if (kind === 'style') return { ...current, terms: current.terms.filter(term => !selected.has(term.id)) };
  const galleries = { ...current.galleries };
  for (const id of selected) delete galleries[id];
  return { ...current, rooms: current.rooms.filter(room => !selected.has(room.id)), galleries };
}
