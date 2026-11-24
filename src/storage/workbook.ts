import * as XLSX from 'xlsx';
import { Unzip, UnzipInflate } from 'fflate';
import { AppError } from '../domain/errors';
import { TRANSFER_LIMITS, transferIssue, validFilename, type CatalogWorkbook, type TransferIssue } from '../domain/catalog-transfer';
import { readZipIndex, updateCrc } from '../domain/zip';
import { ROOMS, SPACES, type Catalog, type Room, type Space, type TermKind } from '../domain/types';
import { catalogSpaces, defaultRooms, validRoomId } from '../domain/rooms';

const headers = {
  Rooms: ['id', 'ru', 'tk'],
  Terms: ['id', 'kind', 'ru', 'tk'],
  Photos: ['id', 'image_filename', 'room', 'style_id', 'palette_ids', 'material_ids', 'detail_ids', 'sample'],
  Galleries: ['space', 'photo_id', 'position'],
};
const kinds: TermKind[] = ['style', 'palette', 'material', 'detail'];
const validId = (value: string) => !!value && value.length <= 120 && !/[;\x00-\x1f]/.test(value);
export const exportFilename = (index: number) => `photo-${String(index + 1).padStart(4, '0')}.jpg`;

function validateArchive(bytes: Uint8Array) {
  if (bytes.length > TRANSFER_LIMITS.workbookBytes) throw new AppError('TRANSFER_LIMIT');
  const index = readZipIndex(bytes.length, (offset, length) => bytes.subarray(offset, offset + length), TRANSFER_LIMITS.xmlBytes);
  const expected = new Map(index.map(entry => [entry.name, entry]));
  let completed = 0;
  const seen = new Set<string>();
  const unzip = new Unzip(file => {
    const entry = expected.get(file.name);
    if (!entry || seen.has(file.name)) throw new AppError('INVALID_ARCHIVE');
    seen.add(file.name);
    let count = 0;
    let crc = -1;
    file.ondata = (error, chunk, final) => {
      if (error) throw new AppError('INVALID_ARCHIVE');
      count += chunk.length;
      if (count > entry.size) throw new AppError('TRANSFER_LIMIT');
      crc = updateCrc(crc, chunk);
      if (final) {
        if (count !== entry.size || ((crc ^ -1) >>> 0) !== entry.crc) throw new AppError('INVALID_ARCHIVE');
        completed++;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 16384) unzip.push(bytes.subarray(offset, offset + 16384), offset + 16384 >= bytes.length);
  if (completed !== index.length || !expected.has('xl/workbook.xml') || index.some(entry => /vbaProject|^xl\/media\//i.test(entry.name))) throw new AppError('INVALID_WORKBOOK');
}

export function decodeWorkbook(bytes: Uint8Array): CatalogWorkbook {
  validateArchive(bytes);
  let book: XLSX.WorkBook;
  try { book = XLSX.read(bytes, { type: 'array', cellFormula: true, sheetRows: 5002 }); }
  catch { throw new AppError('INVALID_WORKBOOK'); }
  const issues: TransferIssue[] = [];
  const problem = (sheet: string, row: number, column: string, ru: string, tk: string) => issues.push(transferIssue(sheet, row, ru, tk, column));
  const metadata = book.Sheets.Metadata;
  const version = String(metadata?.B2?.v);
  if (!metadata || metadata.A2?.v !== 'format_version' || !['1', '2'].includes(version)) throw new AppError('INVALID_WORKBOOK');
  function rows(sheet: keyof typeof headers, limit: number): { row: number; values: Record<string, string> }[] {
    const source = book.Sheets[sheet];
    if (!source) { problem(sheet, 1, '', 'Отсутствует обязательный лист.', 'Hökmany sahypa ýok.'); return []; }
    const range = XLSX.utils.decode_range(source['!fullref'] ?? source['!ref'] ?? 'A1');
    if (range.e.r > limit || range.e.c > 30) throw new AppError('TRANSFER_LIMIT');
    const data = XLSX.utils.sheet_to_json<unknown[]>(source, { header: 1, defval: '', blankrows: true, raw: true });
    const names = (data[0] ?? []).map(String);
    if (headers[sheet].some(name => !names.includes(name)) || new Set(names.filter(Boolean)).size !== names.filter(Boolean).length) {
      problem(sheet, 1, '', 'Столбцы не соответствуют шаблону.', 'Sütünler şablona gabat gelmeýär.'); return [];
    }
    return data.slice(1).flatMap((cells, index) => {
      if (cells.every(value => value === '' || value === null)) return [];
      const row = index + 2;
      const values: Record<string, string> = {};
      for (const name of headers[sheet]) {
        const column = names.indexOf(name);
        const cell = source[XLSX.utils.encode_cell({ r: row - 1, c: column })];
        if (cell?.f || cell?.t === 'e') problem(sheet, row, name, 'Используйте значения, без формул и ошибок Excel.', 'Excel formulalarynyň we ýalňyşlyklarynyň ýerine bahalary ulanyň.');
        const value = String(cells[column] ?? '').trim();
        if (value.length > 4000) problem(sheet, row, name, 'Значение слишком длинное.', 'Baha gaty uzyn.');
        values[name] = value;
      }
      return [{ row, values }];
    });
  }
  const ids = (sheet: string, row: number, column: string, value: string, optional = false) => {
    if ((!optional || value) && !validId(value)) problem(sheet, row, column, 'Нужен текстовый ID без точки с запятой (до 120 символов).', 'Nokatly otursyz tekst ID gerek (120 nyşana çenli).');
    return value;
  };
  const rooms = version === '1' ? defaultRooms.map(room => ({ row: 0, value: { ...room, labels: { ...room.labels } } })) : rows('Rooms', TRANSFER_LIMITS.terms).map(({ row, values: v }) => {
    if (!validRoomId(v.id)) problem('Rooms', row, 'id', 'Нужен уникальный ID комнаты: буквы A–Z, цифры, дефис или подчёркивание.', 'Otagyň ID-si üçin A–Z harplaryny, sanlary, defisi ýa-da aşaky çyzygy ulanyň.');
    for (const language of ['ru', 'tk']) if (!v[language] || v[language].length > 100) problem('Rooms', row, language, 'Введите название (1–100 символов).', 'Ady giriziň (1–100 nyşan).');
    return { row, value: { id: v.id, labels: { ru: v.ru, tk: v.tk } } };
  });
  const terms = rows('Terms', TRANSFER_LIMITS.terms).map(({ row, values: v }) => {
    ids('Terms', row, 'id', v.id);
    if (!kinds.includes(v.kind as TermKind)) problem('Terms', row, 'kind', 'Категория: style, palette, material или detail.', 'Kategoriýa: style, palette, material ýa-da detail.');
    for (const language of ['ru', 'tk']) if (!v[language] || v[language].length > 100) problem('Terms', row, language, 'Введите название (1–100 символов).', 'Ady giriziň (1–100 nyşan).');
    return { row, value: { id: v.id, kind: v.kind as TermKind, labels: { ru: v.ru, tk: v.tk } } };
  });
  const photos = rows('Photos', TRANSFER_LIMITS.photos).map(({ row, values: v }) => {
    ids('Photos', row, 'id', v.id);
    ids('Photos', row, 'style_id', v.style_id, true);
    if (version === '1' ? !(ROOMS as readonly string[]).includes(v.room) : !validRoomId(v.room)) problem('Photos', row, 'room', 'Неизвестная комната; см. Rooms и Guide.', 'Otag näbelli; Rooms we Guide sahypalaryna serediň.');
    if (v.image_filename && !validFilename(v.image_filename)) problem('Photos', row, 'image_filename', 'Нужно имя изображения без пути.', 'Suratyň ýolsyz faýl ady gerek.');
    if (!['true', 'false', ''].includes(v.sample.toLowerCase())) problem('Photos', row, 'sample', 'Используйте TRUE или FALSE.', 'TRUE ýa-da FALSE ulanyň.');
    const tags = (column: string) => {
      const list = v[column] ? v[column].split(';').map(id => ids('Photos', row, column, id.trim())) : [];
      if (new Set(list).size !== list.length) problem('Photos', row, column, 'Теги повторяются.', 'Tegler gaýtalanýar.');
      return list;
    };
    return { row, value: { id: v.id, filename: v.image_filename, room: v.room as Room, styleId: v.style_id, paletteIds: tags('palette_ids'), materialIds: tags('material_ids'), detailIds: tags('detail_ids'), sample: v.sample.toLowerCase() === 'true' } };
  });
  const galleries = rows('Galleries', TRANSFER_LIMITS.photos * 2).map(({ row, values: v }) => {
    if (version === '1' ? !SPACES.includes(v.space) : v.space !== 'whole_house' && !validRoomId(v.space)) problem('Galleries', row, 'space', 'Неизвестная подборка; см. Guide.', 'Toplum näbelli; Guide sahypasyna serediň.');
    ids('Galleries', row, 'photo_id', v.photo_id);
    const position = Number(v.position);
    if (!Number.isInteger(position) || position < 1 || position > TRANSFER_LIMITS.photos) problem('Galleries', row, 'position', 'Позиция: целое число от 1 до 500.', 'Orun: 1-den 500-e çenli bitin san.');
    return { row, value: { space: v.space as Space, photoId: v.photo_id, position } };
  });
  function unique<T>(sheet: string, entries: { row: number; value: T }[], key: (value: T) => string) {
    const seen = new Set<string>();
    for (const { row, value } of entries) { const id = key(value); if (seen.has(id)) problem(sheet, row, '', `Повтор: ${id}`, `Gaýtalanýar: ${id}`); seen.add(id); }
  }
  unique('Rooms', rooms, room => room.id);
  unique('Terms', terms, term => term.id);
  unique('Photos', photos, photo => photo.id);
  unique('Galleries', galleries, entry => `${entry.space}:${entry.photoId}`);
  unique('Galleries', galleries, entry => `${entry.space}:${entry.position}`);
  return { rooms, terms, photos, galleries, issues };
}

export function encodeWorkbook(catalog?: Catalog): Uint8Array {
  if (catalog && (catalog.photos.length > TRANSFER_LIMITS.photos || catalog.terms.length > TRANSFER_LIMITS.terms || catalog.rooms.length > TRANSFER_LIMITS.terms)) throw new AppError('TRANSFER_LIMIT');
  const book = XLSX.utils.book_new();
  const add = (name: string, data: (string | number | boolean)[][]) => {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet['!cols'] = data[0].map((_, index) => ({ wch: index === 0 ? 32 : 24 }));
    if (name in headers) sheet['!autofilter'] = { ref: sheet['!ref']! };
    XLSX.utils.book_append_sheet(book, sheet, name);
  };
  add('Metadata', [['key', 'value'], ['format_version', '2'], ['exported_at', new Date().toISOString()], ['source', 'draft']]);
  add('Rooms', [headers.Rooms, ...(catalog?.rooms ?? defaultRooms).map(room => [room.id, room.labels.ru, room.labels.tk])]);
  add('Terms', [headers.Terms, ...(catalog?.terms.map(term => [term.id, term.kind, term.labels.ru, term.labels.tk]) ?? [])]);
  add('Photos', [headers.Photos, ...(catalog?.photos.map((photo, index) => [photo.id, exportFilename(index), photo.room, photo.styleId, photo.paletteIds.join(';'), photo.materialIds.join(';'), photo.detailIds.join(';'), photo.sample]) ?? [])]);
  add('Galleries', [headers.Galleries, ...(catalog ? catalogSpaces(catalog).flatMap(space => catalog.galleries[space].map((id, index) => [space, id, index + 1])) : [])]);
  add('Guide', [
    ['Русский', 'Türkmençe'],
    ['Заполняйте Rooms, Terms, Photos, Galleries. Не меняйте заголовки и Metadata.', 'Rooms, Terms, Photos, Galleries sahypalaryny dolduryň. Sütün atlaryny we Metadata-ny üýtgetmäň.'],
    ['ID — постоянный текстовый код. Новый ID добавляет запись; существующий обновляет.', 'ID hemişelik tekst kody. Täze ID ýazgy goşýar; bar bolan ID täzelenýär.'],
    ['Категории: style; palette; material; detail. Оба перевода обязательны.', 'Kategoriýalar: style; palette; material; detail. Iki dilde at gerek.'],
    ['Комнаты задаются в Rooms: id, ru, tk. В Photos.room и Galleries.space укажите ID. Подборка всего дома: whole_house.', 'Otaglary Rooms-da kesgitläň: id, ru, tk. Photos.room we Galleries.space üçin ID ulanyň. Bütin jaý: whole_house.'],
    ['Несколько ID тегов разделяйте точкой с запятой: oak;linen. Формулы не поддерживаются.', 'Teg ID-lerini nokatly otur bilen aýryň: oak;linen. Formulalar goldanylmaýar.'],
    ['Фото находятся отдельно: выберите ZIP или изображения. image_filename — имя файла без пути.', 'Suratlar aýratyn: ZIP ýa-da suratlary saýlaň. image_filename — ýolsyz faýl ady.'],
    ['Если новый файл не выбран, фото с существующим ID сохраняет своё изображение.', 'Täze faýl saýlanmasa, bar bolan ID-li surat öňki şekilini saklaýar.'],
    ['Merge сохраняет отсутствующие записи; Replace заменяет весь черновик. Публикация выполняется отдельно.', 'Merge ýok ýazgylary saklaýar; Replace ähli garalamany çalyşýar. Çap etmek aýratyn ýerine ýetirilýär.'],
    ['Примеры ниже не импортируются. Перенесите свои строки в соответствующие листы.', 'Aşakdaky mysallar import edilmeýär. Öz ýazgylaryňyzy degişli sahypalara geçiriň.'],
    ['Terms: modern | style | Современный | Döwrebap', 'Terms: oak | material | Дуб | Dub'],
    ['Photos: room-01 | room-01.jpg | bedroom | modern | warm | oak | simple | FALSE', 'Galleries: bedroom | room-01 | 1'],
    ['До 500 фото; XLSX до 10 MiB; фото до 50 MiB каждое и 1 GiB всего.', '500 surata çenli; XLSX 10 MiB çenli; her surat 50 MiB we jemi 1 GiB çenli.'],
  ]);
  const bytes = new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }));
  if (bytes.length > TRANSFER_LIMITS.workbookBytes) throw new AppError('TRANSFER_LIMIT');
  return bytes;
}
