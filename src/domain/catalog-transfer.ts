import { cloneCatalog, validateCatalog } from './catalog';
import { ROOMS, SPACES, type Catalog, type Labels, type Photo, type Space, type Term } from './types';

export const TRANSFER_LIMITS = { photos: 500, terms: 5000, workbookBytes: 10 * 1024 * 1024, xmlBytes: 50 * 1024 * 1024, imageBytes: 50 * 1024 * 1024, totalImageBytes: 1024 * 1024 * 1024 } as const;
export type ImportMode = 'merge' | 'replace';
export type WorkbookPhoto = Omit<Photo, 'image' | 'width' | 'height'> & { filename: string };
export interface WorkbookRow<T> { row: number; value: T }
export interface TransferIssue { sheet: string; row: number; column?: string; labels: Labels }
export interface CatalogWorkbook {
  terms: WorkbookRow<Term>[];
  photos: WorkbookRow<WorkbookPhoto>[];
  galleries: WorkbookRow<{ space: Space; photoId: string; position: number }>[];
  issues: TransferIssue[];
}
export interface ImportPreview {
  base: string;
  catalog: Catalog;
  issues: TransferIssue[];
  warnings: number;
  added: number;
  updated: number;
  removed: number;
}

export const filenameKey = (name: string) => name.normalize('NFC').toLocaleLowerCase('en-US');
export const validFilename = (name: string) => name.length <= 200 && !/[\\/:\x00-\x1f]/.test(name) && /\.(jpe?g|png|heic|heif|webp)$/i.test(name) && !name.startsWith('.');
export const draftFingerprint = (catalog: Catalog) => JSON.stringify(catalog);
const samePhoto = (a: Photo, b: Photo) => a.id === b.id && a.room === b.room && a.styleId === b.styleId && a.width === b.width && a.height === b.height && a.sample === b.sample &&
  JSON.stringify(a.image) === JSON.stringify(b.image) && (['paletteIds', 'materialIds', 'detailIds'] as const).every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));
export function transferIssue(sheet: string, row: number, ru: string, tk: string, column?: string): TransferIssue {
  return { sheet, row, column, labels: { ru, tk } };
}

/** No persistence or file operations: the exact candidate shown in review is committed later. */
export function previewImport(current: Catalog, workbook: CatalogWorkbook, images: ReadonlyMap<string, Photo>, mode: ImportMode): ImportPreview {
  const issues = [...workbook.issues];
  const next = cloneCatalog(current);
  if (mode === 'replace') {
    next.terms = [];
    next.photos = [];
    next.galleries = { whole_house: [], bathroom: [], bedroom: [], living_room: [], kitchen: [] };
  }
  const terms = new Map(next.terms.map(term => [term.id, term]));
  const oldTerms = new Map(current.terms.map(term => [term.id, term]));
  const oldPhotos = new Map(current.photos.map(photo => [photo.id, photo]));
  const photos = new Map(next.photos.map(photo => [photo.id, photo]));
  let added = 0;
  let updated = 0;
  for (const { value: term, row } of workbook.terms) {
    if (mode === 'merge' && oldTerms.has(term.id) && oldTerms.get(term.id)!.kind !== term.kind) {
      issues.push(transferIssue('Terms', row, 'Нельзя менять категорию существующего ID.', 'Bar bolan ID-niň kategoriýasyny üýtgedip bolmaýar.', 'kind'));
    }
    if (!oldTerms.has(term.id)) added++;
    else {
      const old = oldTerms.get(term.id)!;
      if (old.kind !== term.kind || old.labels.ru !== term.labels.ru || old.labels.tk !== term.labels.tk) updated++;
    }
    terms.set(term.id, term);
  }
  const names = new Map<string, string>();
  for (const term of terms.values()) {
    for (const language of ['ru', 'tk'] as const) {
      const key = `${term.kind}:${language}:${term.labels[language].trim().toLocaleLowerCase()}`;
      if (names.has(key) && names.get(key) !== term.id) {
        const row = workbook.terms.find(item => item.value.id === term.id)?.row ?? 0;
        issues.push(transferIssue('Terms', row, `Повтор названия: ${term.labels[language]}`, `At gaýtalanýar: ${term.labels[language]}`, language));
      }
      names.set(key, term.id);
    }
  }
  for (const { value: record, row } of workbook.photos) {
    const { filename, ...metadata } = record;
    const supplied = images.get(filenameKey(filename));
    const source = supplied ?? oldPhotos.get(record.id);
    if (!source) {
      issues.push(transferIssue('Photos', row, `Выберите файл: ${filename || record.id}`, `Faýly saýlaň: ${filename || record.id}`, 'image_filename'));
      continue;
    }
    const photo: Photo = { ...metadata, image: source.image, width: source.width, height: source.height };
    if (!oldPhotos.has(photo.id)) added++;
    else if (!samePhoto(oldPhotos.get(photo.id)!, photo)) updated++;
    photos.set(photo.id, photo);
  }
  next.terms = [...terms.values()];
  next.photos = [...photos.values()];
  if (next.terms.length > TRANSFER_LIMITS.terms) issues.push(transferIssue('Terms', 0, 'Не более 5 000 терминов в результате импорта.', 'Importdan soň 5 000-den köp termin bolmaly däl.'));
  if (next.photos.length > TRANSFER_LIMITS.photos) issues.push(transferIssue('Photos', 0, 'Не более 500 фотографий в результате импорта.', 'Importdan soň 500-den köp surat bolmaly däl.'));

  // Every nonempty reference must resolve, including references affected by replacing a term.
  for (const photo of next.photos) {
    const row = workbook.photos.find(item => item.value.id === photo.id)?.row ?? 0;
    for (const [column, kind, ids] of [
      ['style_id', 'style', photo.styleId ? [photo.styleId] : []],
      ['palette_ids', 'palette', photo.paletteIds], ['material_ids', 'material', photo.materialIds], ['detail_ids', 'detail', photo.detailIds],
    ] as const) {
      for (const id of ids) if (terms.get(id)?.kind !== kind) issues.push(transferIssue('Photos', row, `Неизвестный или неподходящий тег: ${id} (${photo.id})`, `Näbelli ýa-da nädogry teg: ${id} (${photo.id})`, column));
    }
  }
  for (const space of SPACES) {
    const rows = workbook.galleries.filter(item => item.value.space === space).sort((a, b) => a.value.position - b.value.position);
    const incoming = rows.map(item => item.value.photoId);
    for (const { row, value } of rows) {
      const photo = photos.get(value.photoId);
      if (!photo || (space !== 'whole_house' && photo.room !== space)) issues.push(transferIssue('Galleries', row, 'Фото отсутствует или относится к другой комнате.', 'Surat ýok ýa-da başga otaga degişli.', 'photo_id'));
    }
    const retained = next.galleries[space].filter(id => photos.has(id) && (space === 'whole_house' || photos.get(id)!.room === space));
    next.galleries[space] = rows.length ? [...incoming, ...retained.filter(id => !incoming.includes(id))] : retained;
  }
  next.sample = next.photos.some(photo => photo.sample && SPACES.some(space => next.galleries[space].includes(photo.id)));
  const removed = mode === 'replace' ? current.photos.filter(photo => !photos.has(photo.id)).length + current.terms.filter(term => !terms.has(term.id)).length : 0;
  return { base: draftFingerprint(current), catalog: next, issues, warnings: validateCatalog(next).length, added, updated, removed };
}

export function addDraftPhoto(current: Catalog, photo: Photo, spaces: Space[]): Catalog {
  if (!ROOMS.includes(photo.room) || current.photos.some(item => item.id === photo.id)) throw new Error('INVALID_CATALOG');
  const terms = new Map(current.terms.map(term => [term.id, term.kind]));
  if ((photo.styleId && terms.get(photo.styleId) !== 'style') ||
      photo.paletteIds.some(id => terms.get(id) !== 'palette') || photo.materialIds.some(id => terms.get(id) !== 'material') || photo.detailIds.some(id => terms.get(id) !== 'detail')) throw new Error('INVALID_CATALOG');
  const next = cloneCatalog(current);
  next.photos.push(photo);
  for (const space of spaces) if (space === 'whole_house' || space === photo.room) next.galleries[space].push(photo.id);
  return next;
}

export function addDraftTerm(current: Catalog, term: Term): Catalog {
  const labels = { ru: term.labels.ru.trim(), tk: term.labels.tk.trim() };
  if (!labels.ru || !labels.tk) throw new Error('INVALID_CATALOG');
  if (current.terms.some(item => item.id === term.id || (item.kind === term.kind && (['ru', 'tk'] as const).some(language => item.labels[language].toLocaleLowerCase() === labels[language].toLocaleLowerCase())))) throw new Error('DUPLICATE_TERM');
  return { ...current, terms: [...current.terms, { ...term, labels }] };
}
