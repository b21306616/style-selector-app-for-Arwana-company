import { ROOMS, SPACES, type Catalog, type Language, type TermKind } from './types';

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
  const add = (code: string, subject: string, en: string, ru: string) => issues.push({ code, subject, labels: { en, ru } });
  if (!input || typeof input !== 'object') {
    add('STRUCTURE', 'catalog', 'The catalog is unreadable.', 'Каталог не читается.');
    return issues;
  }
  const catalog = input as Catalog;
  if (!Array.isArray(catalog.terms) || !Array.isArray(catalog.photos) || !catalog.galleries || typeof catalog.galleries !== 'object') {
    add('STRUCTURE', 'catalog', 'Catalog sections are missing.', 'В каталоге отсутствуют обязательные разделы.');
    return issues;
  }
  const terms = new Map<string, TermKind>();
  for (const term of catalog.terms) {
    if (!term || !nonempty(term.id) || !kinds.includes(term.kind)) {
      add('TERM', 'term', 'A vocabulary entry is invalid.', 'Некорректная запись словаря.');
      continue;
    }
    if (terms.has(term.id)) add('DUPLICATE_TERM', term.id, 'Vocabulary IDs must be unique.', 'Идентификаторы терминов должны быть уникальны.');
    terms.set(term.id, term.kind);
    if (!nonempty(term.labels?.en) || !nonempty(term.labels?.ru)) add('TERM_LABEL', term.id, 'Add both English and Russian labels.', 'Добавьте название на русском и английском.');
  }
  const selectedIds = new Set(SPACES.flatMap((space) => Array.isArray(catalog.galleries[space]) ? catalog.galleries[space] : []));
  const photoIds = new Set<string>();
  const photoRooms = new Map<string, string>();
  for (const photo of catalog.photos) {
    if (!photo || !nonempty(photo.id)) {
      add('PHOTO', 'photo', 'A photo entry is invalid.', 'Некорректная запись фотографии.');
      continue;
    }
    if (photoIds.has(photo.id)) add('DUPLICATE_PHOTO', photo.id, 'Photo IDs must be unique.', 'Идентификаторы фотографий должны быть уникальны.');
    photoIds.add(photo.id);
    photoRooms.set(photo.id, photo.room);
    if (!ROOMS.includes(photo.room)) add('ROOM', photo.id, 'Choose a room.', 'Выберите комнату.');
    if (selectedIds.has(photo.id) && terms.get(photo.styleId) !== 'style') add('STYLE', photo.id, 'Choose a valid style.', 'Выберите существующий стиль.');
    for (const [field, kind] of [['paletteIds', 'palette'], ['materialIds', 'material'], ['detailIds', 'detail']] as const) {
      const tags = photo[field];
      if (!Array.isArray(tags) || (selectedIds.has(photo.id) && !tags.length) || tags.some((id) => terms.get(id) !== kind) || new Set(tags).size !== tags.length) {
        add('TAGS', photo.id, `Choose at least one valid ${kind} tag without duplicates.`, `Укажите существующие теги (${kind === 'palette' ? 'палитра' : kind === 'material' ? 'материалы' : 'детали'}) без повторов.`);
      }
    }
    if (!photo.image || !(['bundled', 'local'] as const).includes(photo.image.kind) ||
      (photo.image.kind === 'bundled' && !nonempty(photo.image.key)) ||
      (photo.image.kind === 'local' && (!nonempty(photo.image.file) || !nonempty(photo.image.thumbnail)))) {
      add('IMAGE', photo.id, 'Add a valid image.', 'Добавьте изображение.');
    }
    if (!Number.isFinite(photo.width) || !Number.isFinite(photo.height) || photo.width <= 0 || photo.height <= 0) add('DIMENSIONS', photo.id, 'Image dimensions are invalid.', 'Некорректные размеры изображения.');
  }
  for (const space of SPACES) {
    const deck = catalog.galleries[space];
    if (!Array.isArray(deck)) {
      add('GALLERY', space, 'A gallery is missing.', 'Галерея отсутствует.');
      continue;
    }
    if (new Set(deck).size !== deck.length) add('DUPLICATE_GALLERY_PHOTO', space, 'A gallery contains repeated photos.', 'В галерее есть повторяющиеся фотографии.');
    for (const id of deck) {
      if (!photoIds.has(id)) add('GALLERY_PHOTO', space, 'A selected photo no longer exists.', 'Выбранная фотография не существует.');
    }
    if (space !== 'whole_house' && deck.some((id) => photoRooms.get(id) !== space)) add('GALLERY_ROOM', space, 'A room gallery contains a photo from another room.', 'В галерее есть фото другой комнаты.');
  }
  return issues;
}

export function cloneCatalog(catalog: Catalog): Catalog {
  return JSON.parse(JSON.stringify(catalog)) as Catalog;
}

export function termIsReferenced(catalog: Catalog, termId: string): boolean {
  return catalog.photos.some((photo) => photo.styleId === termId || photo.paletteIds.includes(termId) || photo.materialIds.includes(termId) || photo.detailIds.includes(termId));
}
