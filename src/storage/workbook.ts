import * as XLSX from 'xlsx';
import { Unzip, UnzipInflate } from 'fflate';
import { AppError } from '../domain/errors';
import { filenameKey, TRANSFER_LIMITS, transferIssue, validFilename, type CatalogWorkbook, type TransferIssue } from '../domain/catalog-transfer';
import { normalizePhotoFilenames } from '../domain/photo-filenames';
import { photoFieldsForLanguage } from '../domain/photo-metadata';
import { readZipIndex, updateCrc } from '../domain/zip';
import type { Catalog, Labels, Language, TermKind } from '../domain/types';

export { exportFilename } from '../domain/photo-filenames';
export const WORKBOOK_HEADERS = ['Image filename', 'Room', 'Style', 'Palette', 'Material', 'Detail'] as const;
const sheets = { ru: 'Russian', tk: 'Turkmen' } as const;
type Column = typeof WORKBOOK_HEADERS[number];
type ReadRow = { row: number; values: Record<Column, string>; lists: Record<'Palette' | 'Material' | 'Detail', string[]> };

function validateArchive(bytes: Uint8Array) {
  if (bytes.length > TRANSFER_LIMITS.workbookBytes) throw new AppError('TRANSFER_LIMIT');
  let index: ReturnType<typeof readZipIndex>;
  try {
    index = readZipIndex(bytes.length, (offset, length) => bytes.subarray(offset, offset + length), TRANSFER_LIMITS.xmlBytes);
  } catch (error) {
    if (error instanceof AppError && error.code === 'TRANSFER_LIMIT') throw error;
    throw new AppError('INVALID_WORKBOOK');
  }
  const expected = new Map(index.map(entry => [entry.name, entry]));
  let completed = 0;
  const seen = new Set<string>();
  const unzip = new Unzip(file => {
    const entry = expected.get(file.name);
    if (!entry || seen.has(file.name)) throw new AppError('INVALID_WORKBOOK');
    seen.add(file.name);
    let count = 0;
    let crc = -1;
    file.ondata = (error, chunk, final) => {
      if (error) throw new AppError('INVALID_WORKBOOK');
      count += chunk.length;
      if (count > entry.size) throw new AppError('TRANSFER_LIMIT');
      crc = updateCrc(crc, chunk);
      if (final) {
        if (count !== entry.size || ((crc ^ -1) >>> 0) !== entry.crc) throw new AppError('INVALID_WORKBOOK');
        completed++;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 16384) unzip.push(bytes.subarray(offset, offset + 16384), offset + 16384 >= bytes.length);
  if (completed !== index.length || !expected.has('xl/workbook.xml') || index.some(entry => /vbaProject|^xl\/media\//i.test(entry.name))) throw new AppError('INVALID_WORKBOOK');
}

/** Semicolon-separated labels; quotes protect semicolons and doubled quotes. */
function readList(value: string): string[] | null {
  if (!value) return [];
  const result: string[] = [];
  let offset = 0;
  while (offset <= value.length) {
    while (/\s/.test(value[offset] ?? '') && offset < value.length) offset++;
    let label = '';
    if (value[offset] === '"') {
      offset++;
      let closed = false;
      while (offset < value.length) {
        if (value[offset] !== '"') { label += value[offset++]; continue; }
        if (value[offset + 1] === '"') { label += '"'; offset += 2; continue; }
        offset++; closed = true; break;
      }
      if (!closed) return null;
      while (/\s/.test(value[offset] ?? '') && offset < value.length) offset++;
      if (offset < value.length && value[offset] !== ';') return null;
    } else {
      while (offset < value.length && value[offset] !== ';') {
        if (value[offset] === '"') return null;
        label += value[offset++];
      }
    }
    label = label.trim().normalize('NFC');
    if (!label) return null;
    result.push(label);
    if (offset === value.length) break;
    offset++;
  }
  return result;
}

const writeList = (values: string[]) => values.map(value => /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join('; ');

export function decodeWorkbook(bytes: Uint8Array): CatalogWorkbook {
  validateArchive(bytes);
  let book: XLSX.WorkBook;
  // Keep formula cells that Excel saved without a cached result.
  try { book = XLSX.read(bytes, { type: 'array', cellFormula: true, sheetStubs: true }); }
  catch { throw new AppError('INVALID_WORKBOOK'); }
  if (
    book.SheetNames.length !== 2 ||
    book.SheetNames[0] !== sheets.ru ||
    book.SheetNames[1] !== sheets.tk ||
    book.Workbook?.Sheets?.some(sheet => !!sheet.Hidden)
  ) {
    throw new AppError('INVALID_WORKBOOK');
  }
  const issues: TransferIssue[] = [];
  const problem = (sheet: string, row: number, column: string, ru: string, tk: string) => issues.push(transferIssue(sheet, row, ru, tk, column));
  function readSheet(language: Language): ReadRow[] {
    const sheet = sheets[language];
    const source = book.Sheets[sheet];
    if (!source) throw new AppError('INVALID_WORKBOOK');
    const dataRows = new Set<number>();
    for (const [address, cell] of Object.entries(source)) {
      if (!/^[A-Z]+[1-9]\d*$/.test(address)) continue;
      const position = XLSX.utils.decode_cell(address);
      const meaningful = !!(cell.f || cell.F || cell.t === 'e' || (cell.t !== 'z' && cell.v != null && String(cell.v).trim() !== ''));
      if (position.r > 0 && position.c < WORKBOOK_HEADERS.length && meaningful) dataRows.add(position.r);
      if (position.c >= WORKBOOK_HEADERS.length && meaningful) {
        problem(sheet, position.r + 1, XLSX.utils.encode_col(position.c), 'В шаблоне только шесть столбцов. Удалите лишний столбец.', 'Şablonda diňe alty sütün bar. Artykmaç sütüni aýryň.');
      }
    }
    let correctHeaders = true;
    for (const [column, name] of WORKBOOK_HEADERS.entries()) {
      const cell = source[XLSX.utils.encode_cell({ r: 0, c: column })];
      if (cell?.v !== name || cell?.f || cell?.F || cell?.t === 'e') {
        problem(sheet, 1, name, `Заголовок столбца должен быть «${name}».`, `Sütüniň ady «${name}» bolmaly.`);
        correctHeaders = false;
      }
    }
    if (!correctHeaders) return [];
    if (dataRows.size > TRANSFER_LIMITS.photos) throw new AppError('TRANSFER_LIMIT');
    const rows: ReadRow[] = [];
    for (const rowIndex of [...dataRows].sort((a, b) => a - b)) {
      const row = rowIndex + 1;
      const cells = WORKBOOK_HEADERS.map((_, column) => source[XLSX.utils.encode_cell({ r: row - 1, c: column })]);
      const values = {} as Record<Column, string>;
      for (const [column, name] of WORKBOOK_HEADERS.entries()) {
        const cell = cells[column];
        if (cell?.f || cell?.F || cell?.t === 'e') problem(sheet, row, name, 'Используйте значения, без формул и ошибок Excel.', 'Excel formulalarynyň we ýalňyşlyklarynyň ýerine bahalary ulanyň.');
        values[name] = cell?.t === 'z' ? '' : String(cell?.v ?? '').trim().normalize('NFC');
        if (values[name].length > 4000) problem(sheet, row, name, 'Значение слишком длинное.', 'Baha gaty uzyn.');
      }
      if (!validFilename(values['Image filename'])) problem(sheet, row, 'Image filename', 'Укажите имя изображения с расширением, без папок.', 'Papkalarsyz, giňeltmesi bilen surat faýlynyň adyny görkeziň.');
      for (const column of ['Room', 'Style'] as const) {
        if (values[column].length > 100) problem(sheet, row, column, 'Название должно содержать не более 100 символов.', 'At 100 nyşandan uzyn bolmaly däl.');
      }
      const lists = {} as ReadRow['lists'];
      for (const column of ['Palette', 'Material', 'Detail'] as const) {
        const parsed = readList(values[column]);
        if (!parsed) problem(sheet, row, column, 'Разделяйте названия точкой с запятой. Название с точкой с запятой заключите в двойные кавычки.', 'Atlary nokatly otur bilen aýryň. Nokatly oturly ady goşa dyrnak içine alyň.');
        lists[column] = parsed ?? [];
        if (lists[column].some(label => label.length > 100)) problem(sheet, row, column, 'Каждое название должно содержать не более 100 символов.', 'Her at 100 nyşandan uzyn bolmaly däl.');
        const keys = lists[column].map(label => label.toLocaleLowerCase('en-US'));
        if (new Set(keys).size !== keys.length) problem(sheet, row, column, 'Название повторяется в этой ячейке.', 'Bu öýjükde at gaýtalanýar.');
      }
      rows.push({ row, values, lists });
    }
    return rows;
  }
  const russian = readSheet('ru');
  const turkmen = readSheet('tk');
  function byFilename(rows: ReadRow[], language: Language) {
    const result = new Map<string, ReadRow>();
    for (const row of rows) {
      const filename = row.values['Image filename'];
      if (!validFilename(filename)) continue;
      const key = filenameKey(filename);
      if (result.has(key)) problem(sheets[language], row.row, 'Image filename', 'Это имя файла уже используется на этом листе.', 'Bu faýl ady şu sahypada eýýäm ulanylýar.');
      else result.set(key, row);
    }
    return result;
  }
  const ruRows = byFilename(russian, 'ru');
  const tkRows = byFilename(turkmen, 'tk');
  const photos: CatalogWorkbook['photos'] = [];
  for (const [key, ru] of ruRows) {
    const tk = tkRows.get(key);
    if (!tk) { problem(sheets.ru, ru.row, 'Image filename', 'Добавьте строку с этим именем файла на лист Turkmen.', 'Şu faýl atly setiri Turkmen sahypasyna goşuň.'); continue; }
    const labels = (column: 'Room' | 'Style'): Labels => ({ ru: ru.values[column], tk: tk.values[column] });
    const list = (column: 'Palette' | 'Material' | 'Detail'): Labels[] => {
      const ruList = ru.lists[column];
      const tkList = tk.lists[column];
      if (ruList.length > 0 && tkList.length > 0 && ruList.length !== tkList.length) {
        for (const [language, source] of [['ru', ru], ['tk', tk]] as const) problem(sheets[language], source.row, column, 'Укажите одинаковое число названий в одинаковом порядке на обоих листах.', 'Iki sahypada hem atlaryň sany we tertibi deň bolmaly.');
      }
      return Array.from({ length: Math.max(ruList.length, tkList.length) }, (_, index) => ({
        ru: ruList[index] ?? '', tk: tkList[index] ?? '',
      }));
    };
    photos.push({ row: ru.row, rows: { ru: ru.row, tk: tk.row }, value: {
      filename: ru.values['Image filename'], room: labels('Room'), style: labels('Style'), palette: list('Palette'), material: list('Material'), detail: list('Detail'),
    } });
  }
  for (const [key, tk] of tkRows) if (!ruRows.has(key)) problem(sheets.tk, tk.row, 'Image filename', 'Добавьте строку с этим именем файла на лист Russian.', 'Şu faýl atly setiri Russian sahypasyna goşuň.');
  return { photos, issues };
}

export function encodeWorkbook(input?: Catalog): Uint8Array {
  if (input && (input.photos.length > TRANSFER_LIMITS.photos || input.terms.length > TRANSFER_LIMITS.terms || input.rooms.length > TRANSFER_LIMITS.terms)) throw new AppError('TRANSFER_LIMIT');
  const catalog = input ? normalizePhotoFilenames(input) : undefined;
  const book = XLSX.utils.book_new();
  const rooms = new Map(catalog?.rooms.map(room => [room.id, room.labels]) ?? []);
  const terms = new Map(catalog?.terms.map(term => [term.id, term]) ?? []);
  for (const language of ['ru', 'tk'] as const) {
    const label = (id: string, kind: TermKind) => terms.get(id)?.kind === kind ? terms.get(id)!.labels[language] : '';
    const data = [
      [...WORKBOOK_HEADERS],
      ...(catalog?.photos.map(photo => {
        const fields = photoFieldsForLanguage(photo, language);
        return [
          photo.exportFilename!, rooms.get(fields.room)?.[language] ?? '', label(fields.styleId, 'style'),
          writeList(fields.paletteIds.map(id => label(id, 'palette')).filter(Boolean)),
          writeList(fields.materialIds.map(id => label(id, 'material')).filter(Boolean)),
          writeList(fields.detailIds.map(id => label(id, 'detail')).filter(Boolean)),
        ];
      }) ?? []),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet['!cols'] = [24, 24, 30, 40, 36, 40].map(wch => ({ wch }));
    sheet['!autofilter'] = { ref: sheet['!ref']! };
    XLSX.utils.book_append_sheet(book, sheet, sheets[language]);
  }
  const bytes = new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }));
  if (bytes.length > TRANSFER_LIMITS.workbookBytes) throw new AppError('TRANSFER_LIMIT');
  return bytes;
}
