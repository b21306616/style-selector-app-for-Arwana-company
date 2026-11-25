import { cloneCatalog, validateCatalog } from './catalog';
import { type Catalog, type Labels, type Language, type Photo, type RoomDefinition, type Space, type Term, type TermKind } from './types';
import { catalogSpaces, cleanLabels, hasRoom, nameKey, sameName, validLabels } from './rooms';
import { filenameKey, normalizePhotoFilenames, validFilename } from './photo-filenames';
import { AppError } from './errors';

export { filenameKey, validFilename } from './photo-filenames';
export const TRANSFER_LIMITS = { photos: 500, terms: 5000, workbookBytes: 10 * 1024 * 1024, xmlBytes: 50 * 1024 * 1024, imageBytes: 50 * 1024 * 1024, totalImageBytes: 1024 * 1024 * 1024 } as const;
export type ImportMode = 'merge' | 'replace';
export interface WorkbookPhoto {
  filename: string;
  room: Labels;
  style: Labels;
  palette: Labels[];
  material: Labels[];
  detail: Labels[];
}
export interface WorkbookRow<T> { row: number; rows: Record<Language, number>; value: T }
export interface TransferIssue { sheet: string; row: number; column?: string; labels: Labels }
export interface CatalogWorkbook { photos: WorkbookRow<WorkbookPhoto>[]; issues: TransferIssue[] }
export interface ImportPreview {
  base: string;
  catalog: Catalog;
  issues: TransferIssue[];
  warnings: number;
  added: number;
  updated: number;
  removed: number;
}

export const draftFingerprint = (catalog: Catalog) => JSON.stringify(catalog);
const samePhoto = (a: Photo, b: Photo) => a.id === b.id && a.room === b.room && a.styleId === b.styleId && a.width === b.width && a.height === b.height && a.sample === b.sample &&
  JSON.stringify(a.image) === JSON.stringify(b.image) && (['paletteIds', 'materialIds', 'detailIds'] as const).every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));
export function transferIssue(sheet: string, row: number, ru: string, tk: string, column?: string): TransferIssue {
  return { sheet, row, column, labels: { ru, tk } };
}

/** Pure review: every generated identifier and filename is stable for the same inputs. */
export function previewImport(input: Catalog, workbook: CatalogWorkbook, images: ReadonlyMap<string, Photo>, mode: ImportMode): ImportPreview {
  const current = normalizePhotoFilenames(input);
  const issues = [...workbook.issues];
  const recorded = new Set(workbook.issues.map(issue => `${issue.sheet}:${issue.row}:${issue.column ?? ''}`));
  const hasRecorded = (sheet: string, row: number, column: string) => recorded.has(`${sheet}:${row}:${column}`);
  const problem = (entry: WorkbookRow<WorkbookPhoto>, column: string, ru: string, tk: string, language: Language = 'ru') => {
    issues.push(transferIssue(language === 'ru' ? 'Russian' : 'Turkmen', entry.rows[language], ru, tk, column));
  };
  const next = cloneCatalog(current);
  if (mode === 'replace') {
    next.rooms = []; next.terms = []; next.photos = []; next.galleries = { whole_house: [] };
  }
  const rooms = new Map(next.rooms.map(room => [room.id, room]));
  const terms = new Map(next.terms.map(term => [term.id, term]));
  const photos = new Map(next.photos.map(photo => [photo.id, photo]));
  const occupied = new Set([...current.rooms, ...current.terms, ...current.photos].map(item => item.id));
  const nextIds = new Map<string, number>();
  function allocate(prefix: string) {
    let index = nextIds.get(prefix) ?? 1;
    while (occupied.has(`${prefix}-${index}`)) index++;
    nextIds.set(prefix, index + 1);
    const id = `${prefix}-${index}`; occupied.add(id); return id;
  }

  // A shared vocabulary record must have one consistent translation pair in a book.
  const names = new Map<string, Set<string>>();
  const incoming = new Map<string, Labels>();
  let vocabularyLimitReported = false;
  const key = (kind: string, language: Language, value: string) => `${kind}:${language}:${nameKey(value)}`;
  function indexNames(kind: string, id: string, labels: Labels) {
    for (const language of ['ru', 'tk'] as const) {
      const labelKey = key(kind, language, labels[language]);
      const ids = names.get(labelKey) ?? new Set<string>(); ids.add(id); names.set(labelKey, ids);
    }
  }
  current.rooms.forEach(room => indexNames('room', room.id, room.labels));
  current.terms.forEach(term => indexNames(term.kind, term.id, term.labels));
  function resolve(kind: 'room' | TermKind, labels: Labels, entry: WorkbookRow<WorkbookPhoto>, column: string): string {
    const cleaned = cleanLabels(labels);
    if (!validLabels(cleaned)) {
      for (const language of ['ru', 'tk'] as const) if (!cleaned[language] || cleaned[language].length > 100) {
        if (!hasRecorded(language === 'ru' ? 'Russian' : 'Turkmen', entry.rows[language], column)) {
          problem(entry, column, 'Заполните название (1–100 символов) на обоих языках.', 'Ady iki dilde hem dolduryň (1–100 nyşan).', language);
        }
      }
      return '';
    }
    const matched = new Set<string>();
    for (const language of ['ru', 'tk'] as const) for (const id of names.get(key(kind, language, cleaned[language])) ?? []) matched.add(id);
    if (matched.size > 1) {
      problem(entry, column, 'Названия на двух языках относятся к разным записям. Проверьте перевод.', 'Iki dildäki atlar dürli ýazgylara degişli. Terjimäni barlaň.');
      return '';
    }
    let id = matched.values().next().value as string | undefined;
    if (!id) {
      if (kind !== 'room' && terms.size >= TRANSFER_LIMITS.terms) {
        if (!vocabularyLimitReported) {
          problem(entry, column, 'Превышен лимит: не более 5 000 названий.', 'Çäkden geçildi: 5 000-den köp at bolmaly däl.');
          vocabularyLimitReported = true;
        }
        return '';
      }
      id = allocate(`excel-${kind}`);
    }
    const previous = incoming.get(`${kind}:${id}`);
    if (previous && (nameKey(previous.ru) !== nameKey(cleaned.ru) || nameKey(previous.tk) !== nameKey(cleaned.tk))) {
      problem(entry, column, 'Используйте одинаковый перевод этого названия во всех строках.', 'Bu adyň terjimesini ähli setirlerde birmeňzeş ulanyň.');
      return '';
    }
    incoming.set(`${kind}:${id}`, cleaned);
    indexNames(kind, id, cleaned);
    if (kind === 'room') {
      rooms.set(id, { id, labels: cleaned }); next.galleries[id] ??= [];
    } else terms.set(id, { id, kind, labels: cleaned });
    return id;
  }

  const aliases = new Map<string, Photo>();
  current.photos.forEach(photo => {
    for (const name of [photo.exportFilename, photo.sourceFilename]) if (name) aliases.set(filenameKey(name), photo);
  });
  const seenNames = new Set<string>();
  const seenPhotos = new Set<string>();
  const incomingPhotos: { photo: Photo; old?: Photo }[] = [];
  for (const entry of workbook.photos) {
    const row = entry.value;
    if (!validFilename(row.filename)) {
      problem(entry, 'Image filename', 'Укажите имя файла изображения без папок.', 'Suratyň faýl adyny bukjasyz görkeziň.');
      continue;
    }
    const name = filenameKey(row.filename);
    const old = aliases.get(name);
    if (seenNames.has(name) || (old && seenPhotos.has(old.id))) {
      problem(entry, 'Image filename', 'Фотография повторяется. Оставьте одну строку на каждом листе.', 'Surat gaýtalanýar. Her sahypada bir setir galdyryň.');
      continue;
    }
    seenNames.add(name);
    if (old) seenPhotos.add(old.id);
    const room = resolve('room', row.room, entry, 'Room');
    const styleId = resolve('style', row.style, entry, 'Style');
    function tags(kind: 'palette' | 'material' | 'detail', column: string) {
      const list = row[kind];
      if (!list.length && !hasRecorded('Russian', entry.rows.ru, column) && !hasRecorded('Turkmen', entry.rows.tk, column)) {
        problem(entry, column, 'Заполните обязательное поле на обоих языках.', 'Hökmany meýdany iki dilde hem dolduryň.');
      }
      const ids = list.map(labels => resolve(kind, labels, entry, column)).filter(Boolean);
      if (new Set(ids).size !== ids.length) problem(entry, column, 'Название повторяется в этой ячейке.', 'Bu öýjükde at gaýtalanýar.');
      return ids;
    }
    const paletteIds = tags('palette', 'Palette');
    const materialIds = tags('material', 'Material');
    const detailIds = tags('detail', 'Detail');
    const source = images.get(name) ?? old;
    if (!source) {
      problem(entry, 'Image filename', `Выберите файл: ${row.filename}`, `Faýly saýlaň: ${row.filename}`);
      continue;
    }
    const id = old?.id ?? (occupied.has(source.id) ? allocate('excel-photo') : source.id);
    occupied.add(id);
    const photo: Photo = {
      id, room, styleId, paletteIds, materialIds, detailIds,
      image: source.image, width: source.width, height: source.height, sample: old?.sample ?? false,
      ...(old ? { exportFilename: old.exportFilename, sourceFilename: old.sourceFilename } : { sourceFilename: row.filename }),
    };
    photos.set(id, photo); incomingPhotos.push({ photo, old });
  }
  if (!workbook.photos.length && !issues.length) issues.push(transferIssue('Russian', 2, 'В книге нет фотографий для импорта.', 'Kitapda import etmek üçin surat ýok.'));
  next.rooms = [...rooms.values()]; next.terms = [...terms.values()]; next.photos = [...photos.values()];
  if (next.rooms.length > TRANSFER_LIMITS.terms || next.terms.length > TRANSFER_LIMITS.terms || next.photos.length > TRANSFER_LIMITS.photos) {
    issues.push(transferIssue('Russian', 0, 'Превышен лимит: 500 фотографий или 5 000 названий.', 'Çäkden geçildi: 500 surat ýa-da 5 000 at.'));
  }

  // Merge retains selections; replacement derives room galleries from Russian order.
  const spaces = catalogSpaces(next);
  for (const space of spaces) next.galleries[space] = (next.galleries[space] ?? []).filter(id => photos.has(id) && (space === 'whole_house' || photos.get(id)!.room === space));
  for (const { photo, old } of incomingPhotos) {
    const selectedBefore = old && current.galleries[old.room]?.includes(old.id);
    if (photo.room && (mode === 'replace' || !old || (old.room !== photo.room && selectedBefore))) {
      const gallery = next.galleries[photo.room];
      if (gallery && !gallery.includes(photo.id)) gallery.push(photo.id);
    }
  }
  next.sample = next.photos.some(photo => photo.sample && spaces.some(space => next.galleries[space].includes(photo.id)));
  let added = 0; let updated = 0; let removed = 0;
  function count<T extends { id: string }>(before: T[], after: T[], same: (a: T, b: T) => boolean) {
    const previous = new Map(before.map(item => [item.id, item]));
    for (const item of after) {
      const old = previous.get(item.id);
      if (!old) added++; else if (!same(old, item)) updated++;
      previous.delete(item.id);
    }
    removed += previous.size;
  }
  const sameLabels = (a: RoomDefinition, b: RoomDefinition) => a.labels.ru === b.labels.ru && a.labels.tk === b.labels.tk;
  count(current.rooms, next.rooms, sameLabels); count(current.terms, next.terms, sameLabels); count(current.photos, next.photos, samePhoto);
  const catalog = normalizePhotoFilenames(next, current, workbook.photos.map(entry => entry.value.filename));
  return { base: draftFingerprint(input), catalog, issues, warnings: validateCatalog(catalog).length, added, updated, removed };
}

export function addDraftPhoto(current: Catalog, photo: Photo, spaces: Space[]): Catalog {
  if (!hasRoom(current, photo.room)) throw new AppError('ROOM_REQUIRED');
  if (current.photos.some(item => item.id === photo.id)) throw new AppError('INVALID_CATALOG');
  const terms = new Map(current.terms.map(term => [term.id, term.kind]));
  if ((photo.styleId && terms.get(photo.styleId) !== 'style') ||
      photo.paletteIds.some(id => terms.get(id) !== 'palette') || photo.materialIds.some(id => terms.get(id) !== 'material') || photo.detailIds.some(id => terms.get(id) !== 'detail')) throw new AppError('INVALID_CATALOG');
  const next = cloneCatalog(current);
  next.photos.push(photo);
  for (const space of new Set(spaces)) if (space === 'whole_house' || space === photo.room) next.galleries[space].push(photo.id);
  return next;
}

export function addDraftTerm(current: Catalog, term: Term): Catalog {
  const labels = cleanLabels(term.labels);
  if (!validLabels(labels)) throw new AppError('INVALID_CATALOG');
  if (current.terms.some(item => item.id === term.id || (item.kind === term.kind && sameName(item.labels, labels)))) throw new AppError('DUPLICATE_TERM');
  return { ...current, terms: [...current.terms, { ...term, labels }] };
}
