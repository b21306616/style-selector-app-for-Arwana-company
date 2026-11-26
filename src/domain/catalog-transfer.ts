import { validateCatalog } from './catalog';
import type { Catalog, Labels, Language, Photo, PhotoField, RoomDefinition, Term } from './types';
import { cleanLabels, hasRoom, nameKey, sameName, validLabels } from './rooms';
import { filenameKey, normalizePhotoFilenames, validFilename } from './photo-filenames';
import { AppError } from './errors';

export { filenameKey, validFilename } from './photo-filenames';
export const TRANSFER_LIMITS = { photos: 500, terms: 5000, workbookBytes: 10 * 1024 * 1024, xmlBytes: 50 * 1024 * 1024, imageBytes: 50 * 1024 * 1024, totalImageBytes: 1024 * 1024 * 1024 } as const;
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
const columns = { room: 'Room', style: 'Style', palette: 'Palette', material: 'Material', detail: 'Detail' } as const;
export interface ImportPreview {
  base: string;
  catalog: Catalog;
  issues: TransferIssue[];
  warnings: number;
}

export const draftFingerprint = (catalog: Catalog) => JSON.stringify(catalog);
export function transferIssue(sheet: string, row: number, ru: string, tk: string, column?: string): TransferIssue {
  return { sheet, row, column, labels: { ru, tk } };
}

/** Pure review: every generated identifier and filename is stable for the same inputs. */
export function previewImport(input: Catalog, workbook: CatalogWorkbook, images: ReadonlyMap<string, Photo>): ImportPreview {
  const current = normalizePhotoFilenames(input);
  const issues = [...workbook.issues];
  const recorded = new Set(workbook.issues.map(issue => `${issue.sheet}:${issue.row}:${issue.column ?? ''}`));
  const problem = (entry: WorkbookRow<WorkbookPhoto>, column: string, ru: string, tk: string, language: Language = 'ru') => {
    issues.push(transferIssue(language === 'ru' ? 'Russian' : 'Turkmen', entry.rows[language], ru, tk, column));
  };
  // Import is a complete draft replacement. The current draft is only used below
  // to find an image file for a workbook filename that staff have not reselected.
  const next: Catalog = {
    id: current.id, version: current.version, createdAt: current.createdAt,
    nextPhotoNumber: 1,
    rooms: [],
    terms: [],
    photos: [],
    galleries: {},
    sample: false,
  };
  const rooms = new Map<string, RoomDefinition>();
  const terms = new Map<string, Term>();
  const occupied = new Set([...current.rooms, ...current.terms, ...current.photos].map(item => item.id));
  const nextIds = new Map<string, number>();
  function allocate(prefix: string) {
    let index = nextIds.get(prefix) ?? 1;
    while (occupied.has(`${prefix}-${index}`)) index++;
    nextIds.set(prefix, index + 1);
    const id = `${prefix}-${index}`; occupied.add(id); return id;
  }

  const names = new Map<string, { id: string; labels: Labels }>();
  let termCount = 0;
  let vocabularyLimitReported = false;
  const key = (kind: PhotoField, language: Language, value: string) => `${kind}:${language}:${nameKey(value)}`;
  function register(kind: PhotoField, labels: Labels, entry: WorkbookRow<WorkbookPhoto>) {
    const column = columns[kind];
    const cleaned = cleanLabels(labels);
    if (!cleaned.ru && !cleaned.tk) return;
    if (cleaned.ru.length > 100 || cleaned.tk.length > 100) {
      for (const language of ['ru', 'tk'] as const) {
        const cell = `${language === 'ru' ? 'Russian' : 'Turkmen'}:${entry.rows[language]}:${column}`;
        if (cleaned[language].length > 100 && !recorded.has(cell)) {
          problem(entry, column, 'Название должно содержать не более 100 символов.', 'At 100 nyşandan uzyn bolmaly däl.', language);
          recorded.add(cell);
        }
      }
      return;
    }
    const existing = names.get(key(kind, 'ru', cleaned.ru)) ?? names.get(key(kind, 'tk', cleaned.tk));
    if (existing) {
      if ((cleaned.ru && nameKey(existing.labels.ru) !== nameKey(cleaned.ru)) ||
          (cleaned.tk && nameKey(existing.labels.tk) !== nameKey(cleaned.tk))) {
        problem(entry, column, 'Используйте одинаковый перевод этого названия во всех строках.', 'Bu adyň terjimesini ähli setirlerde birmeňzeş ulanyň.');
      }
      return;
    }
    if (kind !== 'room' && termCount >= TRANSFER_LIMITS.terms) {
      if (!vocabularyLimitReported) {
        problem(entry, column, 'Превышен лимит: не более 5 000 названий.', 'Çäkden geçildi: 5 000-den köp at bolmaly däl.');
        vocabularyLimitReported = true;
      }
      return;
    }
    const record = { id: allocate(`excel-${kind}`), labels: cleaned };
    if (kind !== 'room') termCount++;
    if (cleaned.ru) names.set(key(kind, 'ru', cleaned.ru), record);
    if (cleaned.tk) names.set(key(kind, 'tk', cleaned.tk), record);
  }

  // A later bilingual row can establish that two earlier, one-language names
  // refer to one room or term. Only names explicitly paired in this book do so.
  for (const bilingual of [true, false]) {
    for (const entry of workbook.photos) {
      for (const kind of ['room', 'style', 'palette', 'material', 'detail'] as const) {
        const value = entry.value[kind];
        for (const labels of Array.isArray(value) ? value : [value]) {
          if (Boolean(labels.ru.trim() && labels.tk.trim()) === bilingual) register(kind, labels, entry);
        }
      }
    }
  }

  const aliases = new Map<string, Photo>();
  current.photos.forEach(photo => {
    for (const name of [photo.exportFilename, photo.sourceFilename]) if (name) aliases.set(filenameKey(name), photo);
  });
  const seenNames = new Set<string>();
  const seenPhotos = new Set<string>();
  for (const entry of workbook.photos) {
    const row = entry.value;
    if (!validFilename(row.filename)) {
      problem(entry, 'Image filename', 'Укажите имя файла изображения без папок.', 'Suratyň faýl adyny bukjasyz görkeziň.');
      continue;
    }
    const name = filenameKey(row.filename);
    const selectedImage = images.get(name);
    const old = selectedImage ? undefined : aliases.get(name);
    if (seenNames.has(name) || (old && seenPhotos.has(old.id))) {
      problem(entry, 'Image filename', 'Фотография повторяется. Оставьте одну строку на каждом листе.', 'Surat gaýtalanýar. Her sahypada bir setir galdyryň.');
      continue;
    }
    seenNames.add(name);
    if (old) seenPhotos.add(old.id);
    const blankTranslations: NonNullable<Photo['blankTranslations']> = {};
    function assignment(kind: PhotoField, labels: Labels): string {
      const record = names.get(key(kind, 'ru', labels.ru)) ?? names.get(key(kind, 'tk', labels.tk));
      if (!record) return '';
      if (!labels.ru.trim()) blankTranslations[kind] = 'ru';
      if (!labels.tk.trim()) blankTranslations[kind] = 'tk';
      if (kind === 'room') {
        rooms.set(record.id, record);
        next.galleries[record.id] ??= [];
      } else if (!terms.has(record.id)) terms.set(record.id, { ...record, kind });
      return record.id;
    }
    const room = assignment('room', row.room);
    const styleId = assignment('style', row.style);
    function tags(kind: 'palette' | 'material' | 'detail') {
      const ids = row[kind].map(labels => assignment(kind, labels)).filter(Boolean);
      if (new Set(ids).size !== ids.length) problem(entry, columns[kind], 'Название повторяется в этой ячейке.', 'Bu öýjükde at gaýtalanýar.');
      return ids;
    }
    const paletteIds = tags('palette');
    const materialIds = tags('material');
    const detailIds = tags('detail');
    const source = selectedImage ?? old;
    if (!source) {
      problem(entry, 'Image filename', `Выберите файл: ${row.filename}`, `Faýly saýlaň: ${row.filename}`);
      continue;
    }
    const id = allocate('excel-photo');
    const photo: Photo = {
      id, room, styleId, paletteIds, materialIds, detailIds,
      image: source.image, width: source.width, height: source.height, sample: false,
      sourceFilename: row.filename,
      ...(Object.keys(blankTranslations).length ? { blankTranslations } : {}),
    };
    next.photos.push(photo);
    if (room) next.galleries[room].push(id);
  }
  next.rooms = [...rooms.values()]; next.terms = [...terms.values()];
  if (next.rooms.length > TRANSFER_LIMITS.terms || next.terms.length > TRANSFER_LIMITS.terms || next.photos.length > TRANSFER_LIMITS.photos) {
    issues.push(transferIssue('Russian', 0, 'Превышен лимит: 500 фотографий или 5 000 названий.', 'Çäkden geçildi: 500 surat ýa-da 5 000 at.'));
  }

  const catalog = normalizePhotoFilenames(next, undefined, workbook.photos.map(entry => entry.value.filename));
  return { base: draftFingerprint(input), catalog, issues, warnings: validateCatalog(catalog).length };
}

export function addDraftPhoto(current: Catalog, photo: Photo): Catalog {
  if (!hasRoom(current, photo.room)) throw new AppError('ROOM_REQUIRED');
  if (current.photos.some(item => item.id === photo.id)) throw new AppError('INVALID_CATALOG');
  const terms = new Map(current.terms.map(term => [term.id, term.kind]));
  if ((photo.styleId && terms.get(photo.styleId) !== 'style') ||
      photo.paletteIds.some(id => terms.get(id) !== 'palette') || photo.materialIds.some(id => terms.get(id) !== 'material') || photo.detailIds.some(id => terms.get(id) !== 'detail')) throw new AppError('INVALID_CATALOG');
  return { ...current, photos: [...current.photos, photo] };
}

export function addDraftTerm(current: Catalog, term: Term): Catalog {
  const labels = cleanLabels(term.labels);
  if (!validLabels(labels)) throw new AppError('INVALID_CATALOG');
  if (current.terms.some(item => item.id === term.id || (item.kind === term.kind && sameName(item.labels, labels)))) throw new AppError('DUPLICATE_TERM');
  return { ...current, terms: [...current.terms, { ...term, labels }] };
}
