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
  const add = (code: string, subject: string, tk: string, ru: string) => issues.push({ code, subject, labels: { tk, ru } });
  if (!input || typeof input !== 'object') {
    add('STRUCTURE', 'catalog', 'Katalog okalyp bilinmeýär.', 'Каталог не читается.');
    return issues;
  }
  const catalog = input as Catalog;
  if (!Array.isArray(catalog.terms) || !Array.isArray(catalog.photos) || !catalog.galleries || typeof catalog.galleries !== 'object') {
    add('STRUCTURE', 'catalog', 'Katalogyň hökmany bölümleri ýok.', 'В каталоге отсутствуют обязательные разделы.');
    return issues;
  }
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
  const selectedIds = new Set(SPACES.flatMap((space) => Array.isArray(catalog.galleries[space]) ? catalog.galleries[space] : []));
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
    if (!ROOMS.includes(photo.room)) add('ROOM', photo.id, 'Otagy saýlaň.', 'Выберите комнату.');
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
  for (const space of SPACES) {
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
