import { expect, test } from '@jest/globals';
import * as XLSX from 'xlsx';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { seedCatalog } from '../src/data/catalog';
import { cloneCatalog } from '../src/domain/catalog';
import { addDraftPhoto, addDraftTerm, filenameKey, previewImport } from '../src/domain/catalog-transfer';
import { normalizePhotoFilenames } from '../src/domain/photo-filenames';
import { readZipIndex } from '../src/domain/zip';
import type { Catalog, Photo } from '../src/domain/types';
import { decodeWorkbook, encodeWorkbook, WORKBOOK_HEADERS } from '../src/storage/workbook';

const empty = (): Catalog => ({ ...cloneCatalog(seedCatalog), rooms: [], photos: [], terms: [], galleries: { whole_house: [] }, sample: false });
const bytes = (book: XLSX.WorkBook) => new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }));
function editWorkbook(edit: (book: XLSX.WorkBook) => void, catalog = seedCatalog) {
  const book = XLSX.read(encodeWorkbook(catalog), { type: 'array' });
  edit(book);
  return bytes(book);
}
function imageMap(catalog: Catalog) {
  return new Map(normalizePhotoFilenames(catalog).photos.map((photo, index) => [filenameKey(photo.exportFilename!), {
    ...photo, id: `prepared-${index}`, image: { kind: 'local' as const, file: `new-${index}.jpg`, thumbnail: `new-${index}-thumb.jpg` },
  }]));
}
const onePhoto = () => ({ ...cloneCatalog(seedCatalog), photos: [cloneCatalog(seedCatalog).photos[0]] });

test('exports only Russian and Turkmen with six readable columns and no hidden sheets', () => {
  const book = XLSX.read(encodeWorkbook(seedCatalog), { type: 'array' });
  expect(book.SheetNames).toEqual(['Russian', 'Turkmen']);
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1 });
    expect(rows[0]).toEqual(WORKBOOK_HEADERS);
    expect(rows).toHaveLength(seedCatalog.photos.length + 1);
    expect(rows.every(row => row.length === 6)).toBe(true);
  }
  expect(book.Workbook?.Sheets?.every(sheet => !sheet.Hidden)).toBe(true);
  expect(book.Sheets.Russian.B2.v).toBe('Ванная');
  expect(book.Sheets.Turkmen.B2.v).toBe('Wanna otagy');
  expect(book.Sheets.Russian.C2.v).toBe('Скандинавский');
  expect(book.Sheets.Russian.A2.v).toBe(book.Sheets.Turkmen.A2.v);
});

test('the empty template contains headers only with column widths and filters and cannot erase a draft through import', () => {
  const book = XLSX.read(encodeWorkbook(), { type: 'array', cellStyles: true });
  expect(book.SheetNames).toEqual(['Russian', 'Turkmen']);
  for (const name of book.SheetNames) {
    expect(book.Sheets[name]['!ref']).toBe('A1:F1');
    expect(book.Sheets[name]['!autofilter']).toEqual({ ref: 'A1:F1' });
    expect(book.Sheets[name]['!cols']).toHaveLength(6);
  }
  const decoded = decodeWorkbook(encodeWorkbook());
  expect(decoded.photos).toEqual([]);
  expect(decoded.issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Image filename' }));
  expect(previewImport(seedCatalog, decoded, new Map(), 'replace').issues.length).toBeGreaterThan(0);
});

test('a workbook and its images restore all bilingual descriptions into room galleries', () => {
  const input = cloneCatalog(seedCatalog);
  input.terms[0].labels = { ru: 'Тёплый современный', tk: 'Ýyly döwrebap' };
  const workbook = decodeWorkbook(encodeWorkbook(input));
  const preview = previewImport(empty(), workbook, imageMap(input), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.warnings).toBe(0);
  expect(decodeWorkbook(encodeWorkbook(preview.catalog)).photos.map(row => row.value)).toEqual(workbook.photos.map(row => row.value));
  expect(preview.catalog.galleries.whole_house).toEqual([]);
  for (const room of preview.catalog.rooms) expect(preview.catalog.galleries[room.id]).toEqual(preview.catalog.photos.filter(photo => photo.room === room.id).map(photo => photo.id));
  expect(preview.catalog.photos.every(photo => photo.image.kind === 'local' && !photo.sample)).toBe(true);
});

test('unchanged reimport retains photo identities, images, and curated galleries', () => {
  const current = normalizePhotoFilenames(seedCatalog);
  const preview = previewImport(current, decodeWorkbook(encodeWorkbook(current)), new Map(), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.updated).toBe(0);
  expect(preview.added).toBe(0);
  expect(preview.removed).toBe(0);
  expect(preview.catalog).toEqual(current);
});

test('language rows pair by normalized filename rather than row position', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets.Turkmen, { header: 1 });
    book.Sheets.Turkmen = XLSX.utils.aoa_to_sheet([rows[0], ...rows.slice(1).reverse().map(row => [row[0].toUpperCase(), ...row.slice(1)])]);
  }));
  expect(workbook.issues).toEqual([]);
  expect(workbook.photos[0].rows).toEqual({ ru: 2, tk: seedCatalog.photos.length + 1 });
  expect(workbook.photos[0].value.style).toEqual(seedCatalog.terms[0].labels);
  expect(previewImport(seedCatalog, workbook, new Map(), 'merge').issues).toEqual([]);
});

test('Unicode-normalized filenames pair between sheets and selected image files', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    book.Sheets.Russian.A2.v = 'sürat.jpg';
    book.Sheets.Turkmen.A2.v = 'SU\u0308RAT.JPG';
  }, onePhoto()));
  expect(workbook.issues).toEqual([]);
  const images = new Map([[filenameKey('su\u0308rat.jpg'), { ...seedCatalog.photos[0], id: 'new-photo' }]]);
  expect(previewImport(empty(), workbook, images, 'merge').issues).toEqual([]);
});

test.each(['Russian', 'Turkmen'])('%s requires all six values in every nonblank photo row', sheet => {
  for (const [index, column] of WORKBOOK_HEADERS.entries()) {
    const workbook = decodeWorkbook(editWorkbook(book => { book.Sheets[sheet][XLSX.utils.encode_cell({ r: 1, c: index })] = { t: 's', v: '' }; }, onePhoto()));
    expect(workbook.issues).toContainEqual(expect.objectContaining({ sheet, row: 2, column }));
  }
});

test('incomplete drafts export with blank values for completion in Excel', () => {
  const catalog = onePhoto();
  catalog.photos[0].styleId = '';
  catalog.photos[0].paletteIds = [];
  const book = XLSX.read(encodeWorkbook(catalog), { type: 'array' });
  expect(book.Sheets.Russian.C2.v).toBe('');
  expect(book.Sheets.Turkmen.D2.v).toBe('');
  expect(decodeWorkbook(encodeWorkbook(catalog)).issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Style' }),
    expect.objectContaining({ sheet: 'Turkmen', row: 2, column: 'Palette' }),
  ]));
});

test('multiple labels preserve order and quote embedded semicolons and quotation marks', () => {
  const catalog = onePhoto();
  const material = catalog.terms.find(term => term.id === catalog.photos[0].materialIds[0])!;
  material.labels = { ru: 'Дуб; "матовый"', tk: 'Dub; "ýalpyldysyz"' };
  catalog.photos[0].materialIds.push('stone');
  const book = XLSX.read(encodeWorkbook(catalog), { type: 'array' });
  expect(book.Sheets.Russian.E2.v).toBe('"Дуб; ""матовый"""; Камень');
  const workbook = decodeWorkbook(encodeWorkbook(catalog));
  expect(workbook.issues).toEqual([]);
  expect(workbook.photos[0].value.material).toEqual([material.labels, catalog.terms.find(term => term.id === 'stone')!.labels]);
});

test.each(['"незакрыто', 'Камень;', 'Камень;;Дуб', 'Камень"Дуб', '"Камень"Дуб'])('rejects malformed multiple-label syntax: %s', value => {
  const workbook = decodeWorkbook(editWorkbook(book => { book.Sheets.Russian.E2.v = value; }, onePhoto()));
  expect(workbook.issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Material' }));
});

test('reports unequal translated list counts and repeated labels', () => {
  const workbook = decodeWorkbook(editWorkbook(book => { book.Sheets.Russian.E2.v = 'Дуб; ДУБ'; }, onePhoto()));
  expect(workbook.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Material' }),
    expect.objectContaining({ sheet: 'Turkmen', row: 2, column: 'Material' }),
  ]));
});

test('rejects formulas, Excel errors, invalid filenames, and overlong labels at their actual cells', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    book.Sheets.Russian.C2 = { t: 's', v: 'Скандинавский', f: 'CONCAT("Скандинавский")' };
    book.Sheets.Turkmen.D2 = { t: 'e', v: 7 };
    book.Sheets.Russian.A3.v = '../photo.jpg';
    book.Sheets.Turkmen.B3.v = 'O'.repeat(101);
  }));
  expect(workbook.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Style' }),
    expect.objectContaining({ sheet: 'Turkmen', row: 2, column: 'Palette' }),
    expect.objectContaining({ sheet: 'Russian', row: 3, column: 'Image filename' }),
    expect.objectContaining({ sheet: 'Turkmen', row: 3, column: 'Room' }),
  ]));
});

test('rejects duplicate filenames and missing translation rows', () => {
  const workbook = decodeWorkbook(editWorkbook(book => { book.Sheets.Turkmen.A3.v = String(book.Sheets.Turkmen.A2.v).toUpperCase(); }));
  expect(workbook.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: 'Turkmen', row: 3, column: 'Image filename' }),
    expect.objectContaining({ sheet: 'Russian', row: 3, column: 'Image filename' }),
  ]));
});

test('requires the exact headings and rejects extra populated columns on Russian and Turkmen sheets', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    book.Sheets.Russian.A1.v = 'id';
    book.Sheets.Turkmen.G2 = { t: 's', v: 'extra' };
    book.Sheets.Turkmen['!ref'] = `A1:G${seedCatalog.photos.length + 1}`;
  }));
  expect(workbook.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: 'Russian', row: 1, column: 'Image filename' }),
    expect.objectContaining({ sheet: 'Turkmen', row: 2, column: 'G' }),
  ]));
});

test('blank extra columns and blank rows are ignored without inventing photos', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    book.Sheets.Russian['!ref'] = 'A1:J4';
    book.Sheets.Russian.J4 = { t: 's', v: '' };
    book.Sheets.Turkmen['!ref'] = 'A1:F4';
  }, onePhoto()));
  expect(workbook.issues).toEqual([]);
  expect(workbook.photos).toHaveLength(1);
});

test('sparse rows past the photo limit remain importable with their actual locations', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    for (const name of book.SheetNames) {
      const sheet = book.Sheets[name];
      const values = WORKBOOK_HEADERS.map((_, column) => sheet[XLSX.utils.encode_cell({ r: 1, c: column })]?.v);
      for (const column of WORKBOOK_HEADERS.keys()) delete sheet[XLSX.utils.encode_cell({ r: 1, c: column })];
      XLSX.utils.sheet_add_aoa(sheet, [values], { origin: 'A750' });
    }
  }, onePhoto()));
  expect(workbook.issues).toEqual([]);
  expect(workbook.photos).toHaveLength(1);
  expect(workbook.photos[0].rows).toEqual({ ru: 750, tk: 750 });
});

test('rejects legacy workbooks, extra sheets, swapped order, missing sheets, and hidden tabs with INVALID_WORKBOOK', () => {
  const legacyMinimal = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(legacyMinimal, XLSX.utils.aoa_to_sheet([['key', 'value'], ['format_version', '2']]), 'Metadata');
  expect(() => decodeWorkbook(bytes(legacyMinimal))).toThrow('INVALID_WORKBOOK');

  const legacyFull = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(legacyFull, XLSX.utils.aoa_to_sheet([['key', 'value'], ['format_version', '2']]), 'Metadata');
  XLSX.utils.book_append_sheet(legacyFull, XLSX.utils.aoa_to_sheet([['id', 'ru', 'tk'], ['bathroom', 'Ванная', 'Wanna otagy']]), 'Rooms');
  XLSX.utils.book_append_sheet(legacyFull, XLSX.utils.aoa_to_sheet([['id', 'kind', 'ru', 'tk']]), 'Terms');
  XLSX.utils.book_append_sheet(legacyFull, XLSX.utils.aoa_to_sheet([['id', 'image_filename', 'room', 'style_id', 'palette_ids', 'material_ids', 'detail_ids', 'sample']]), 'Photos');
  XLSX.utils.book_append_sheet(legacyFull, XLSX.utils.aoa_to_sheet([['space', 'photo_id', 'position'], ...Array.from({ length: 600 }, (_, i) => ['whole_house', `p-${i}`, i + 1])]), 'Galleries');
  XLSX.utils.book_append_sheet(legacyFull, XLSX.utils.aoa_to_sheet([['Русский', 'Türkmençe']]), 'Guide');
  expect(() => decodeWorkbook(bytes(legacyFull))).toThrow('INVALID_WORKBOOK');

  expect(() => decodeWorkbook(editWorkbook(book => {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['note']]), 'Notes');
  }, onePhoto()))).toThrow('INVALID_WORKBOOK');

  expect(() => decodeWorkbook(editWorkbook(book => {
    book.SheetNames = ['Russian'];
    delete book.Sheets.Turkmen;
  }, onePhoto()))).toThrow('INVALID_WORKBOOK');

  expect(() => decodeWorkbook(editWorkbook(book => {
    book.SheetNames = ['Turkmen', 'Russian'];
  }, onePhoto()))).toThrow('INVALID_WORKBOOK');

  expect(() => decodeWorkbook(editWorkbook(book => {
    book.Workbook = { Sheets: [{ name: 'Russian', Hidden: 0 }, { name: 'Turkmen', Hidden: 1 }] };
  }, onePhoto()))).toThrow('INVALID_WORKBOOK');
});

test('merge preserves omitted records and existing gallery selections regardless of spreadsheet order', () => {
  const current = normalizePhotoFilenames(seedCatalog);
  const workbook = decodeWorkbook(encodeWorkbook(current));
  workbook.photos = workbook.photos.slice(0, 2).reverse();
  const preview = previewImport(current, workbook, new Map(), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog).toEqual(current);
});

test('new merged photos join only their room gallery, never Whole House', () => {
  const workbook = decodeWorkbook(encodeWorkbook(onePhoto()));
  workbook.photos[0].value.filename = 'new.jpg';
  const supplied = { ...seedCatalog.photos[0], id: 'prepared-new', sample: false };
  const preview = previewImport(seedCatalog, workbook, new Map([['new.jpg', supplied]]), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.photos).toHaveLength(seedCatalog.photos.length + 1);
  expect(preview.catalog.galleries[supplied.room]).toContain('prepared-new');
  expect(preview.catalog.galleries.whole_house).toEqual(seedCatalog.galleries.whole_house);
});

test('replacement keeps represented content and builds room galleries in Russian row order', () => {
  const original = normalizePhotoFilenames(seedCatalog);
  const workbook = decodeWorkbook(encodeWorkbook(original));
  workbook.photos = workbook.photos.slice(0, 3).reverse();
  const preview = previewImport(original, workbook, new Map(), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.photos.map(photo => photo.id)).toEqual(original.photos.slice(0, 3).reverse().map(photo => photo.id));
  expect(preview.catalog.galleries.bathroom).toEqual(preview.catalog.photos.map(photo => photo.id));
  expect(preview.catalog.galleries.whole_house).toEqual([]);
  expect(preview.catalog.rooms.map(room => room.id)).toEqual(['bathroom']);
  expect(preview.removed).toBeGreaterThanOrEqual(seedCatalog.photos.length - 3);
  expect(original).toEqual(normalizePhotoFilenames(seedCatalog));
});

test('moving a selected existing photo moves its room membership while preserving Whole House', () => {
  const workbook = decodeWorkbook(encodeWorkbook(onePhoto()));
  workbook.photos[0].value.room = seedCatalog.rooms.find(room => room.id === 'kitchen')!.labels;
  const preview = previewImport(seedCatalog, workbook, new Map(), 'merge');
  const id = seedCatalog.photos[0].id;
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.galleries.bathroom).not.toContain(id);
  expect(preview.catalog.galleries.kitchen).toContain(id);
  expect(preview.catalog.galleries.whole_house).toEqual(seedCatalog.galleries.whole_house);
});

test('missing images identify their spreadsheet row, while supplied files replace existing images', () => {
  const workbook = decodeWorkbook(encodeWorkbook(onePhoto()));
  expect(previewImport(empty(), workbook, new Map(), 'replace').issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Image filename' }));
  const preview = previewImport(seedCatalog, workbook, imageMap(onePhoto()), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.photos[0].id).toBe(seedCatalog.photos[0].id);
  expect(preview.catalog.photos[0].image).toEqual({ kind: 'local', file: 'new-0.jpg', thumbnail: 'new-0-thumb.jpg' });
  expect(preview.updated).toBe(1);
});

test('a consistent translation correction reuses shared vocabulary identities', () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  for (const photo of workbook.photos) if (photo.value.style.ru === 'Скандинавский') photo.value.style.tk = 'Täze Skandinaw';
  const preview = previewImport(seedCatalog, workbook, new Map(), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.terms.find(term => term.id === 'scandinavian')!.labels.tk).toBe('Täze Skandinaw');
  expect(preview.catalog.terms).toHaveLength(seedCatalog.terms.length);
  expect(preview.updated).toBe(1);
});

test('inconsistent translations and labels referring to different records block importing', () => {
  const inconsistent = decodeWorkbook(encodeWorkbook(seedCatalog));
  inconsistent.photos[0].value.style.tk = 'Başga terjime';
  expect(previewImport(seedCatalog, inconsistent, new Map(), 'merge').issues).toContainEqual(expect.objectContaining({ column: 'Style' }));
  const conflicting = decodeWorkbook(encodeWorkbook(onePhoto()));
  conflicting.photos[0].value.style.tk = seedCatalog.terms.find(term => term.id === 'minimalist')!.labels.tk;
  expect(previewImport(seedCatalog, conflicting, new Map(), 'merge').issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Style' }));
});

test('new bilingual room and term labels get internal IDs without workbook IDs', () => {
  const workbook = decodeWorkbook(encodeWorkbook(onePhoto()));
  workbook.photos[0].value.room = { ru: 'Кабинет', tk: 'Iş otagy' };
  workbook.photos[0].value.style = { ru: 'Уютный', tk: 'Rahat' };
  const preview = previewImport(empty(), workbook, imageMap(onePhoto()), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.rooms[0].labels).toEqual(workbook.photos[0].value.room);
  expect(preview.catalog.terms.find(term => term.kind === 'style')!.labels).toEqual(workbook.photos[0].value.style);
  expect(previewImport(empty(), workbook, imageMap(onePhoto()), 'replace').catalog).toEqual(preview.catalog);
});

test('vocabulary resolution stops at the 5,000-term limit while existing terms remain reusable', () => {
  const source = onePhoto();
  const workbook = decodeWorkbook(encodeWorkbook(source));
  workbook.photos[0].value.palette = Array.from({ length: 5_001 }, (_, index) => ({ ru: `Палитра ${index}`, tk: `Palitra ${index}` }));
  const limited = previewImport(empty(), workbook, imageMap(source), 'replace');
  expect(limited.issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Palette' }));
  expect(limited.catalog.terms).toHaveLength(5_000);

  const full = cloneCatalog(seedCatalog);
  full.terms.push(...Array.from({ length: 5_000 - full.terms.length }, (_, index) => ({
    id: `unused-${index}`, kind: 'detail' as const, labels: { ru: `Неиспользуемый ${index}`, tk: `Ulanylmaýan ${index}` },
  })));
  const unchanged = previewImport(full, decodeWorkbook(encodeWorkbook(full)), new Map(), 'merge');
  expect(unchanged.issues).toEqual([]);
  expect(unchanged.catalog.terms).toHaveLength(5_000);
});

test('rejects truncated archives, non-ZIP workbooks, unsafe paths, excessive expansion and embedded images', () => {
  expect(() => decodeWorkbook(encodeWorkbook(seedCatalog).subarray(0, 100))).toThrow('INVALID_WORKBOOK');
  expect(() => decodeWorkbook(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toThrow('INVALID_WORKBOOK');
  const unsafe = zipSync({ '../photo.jpg': strToU8('image') });
  expect(() => readZipIndex(unsafe.length, (offset, length) => unsafe.subarray(offset, offset + length), 1000)).toThrow('INVALID_ARCHIVE');
  const large = zipSync({ 'photo.jpg': new Uint8Array(2000) });
  expect(() => readZipIndex(large.length, (offset, length) => large.subarray(offset, offset + length), 1000)).toThrow('TRANSFER_LIMIT');
  const contents = unzipSync(encodeWorkbook(onePhoto()));
  contents['xl/media/photo.jpg'] = new Uint8Array([1]);
  expect(() => decodeWorkbook(zipSync(contents))).toThrow('INVALID_WORKBOOK');
});

test('encodeWorkbook drops unresolved term references cleanly without malformed separators', () => {
  const catalog = onePhoto();
  catalog.photos[0].paletteIds = [...catalog.photos[0].paletteIds, 'missing-term'];
  const book = XLSX.read(encodeWorkbook(catalog), { type: 'array' });
  expect(book.Sheets.Russian.D2.v).not.toMatch(/;\s*$/);
  expect(decodeWorkbook(encodeWorkbook(catalog)).issues).toEqual([]);
});

test('500 photos round trip with all descriptions and room order while 501 are rejected', () => {
  const catalog = cloneCatalog(seedCatalog);
  catalog.photos = Array.from({ length: 500 }, (_, index) => ({ ...seedCatalog.photos[index % seedCatalog.photos.length], id: `benchmark-${index}` }));
  const workbook = decodeWorkbook(encodeWorkbook(catalog));
  const preview = previewImport(empty(), workbook, imageMap(catalog), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.photos).toHaveLength(500);
  expect(decodeWorkbook(encodeWorkbook(preview.catalog)).photos.map(row => row.value)).toEqual(workbook.photos.map(row => row.value));
  expect(() => encodeWorkbook({ ...catalog, photos: [...catalog.photos, catalog.photos[0]] })).toThrow('TRANSFER_LIMIT');
  expect(() => decodeWorkbook(editWorkbook(book => {
    for (const name of book.SheetNames) {
      XLSX.utils.sheet_add_aoa(book.Sheets[name], [['extra.jpg', 'Room', 'Style', 'Palette', 'Material', 'Detail']], { origin: 'A502' });
    }
  }, catalog))).toThrow('TRANSFER_LIMIT');
}, 15000);

test('direct entry preserves unrelated draft edits and rejects duplicate vocabulary names', () => {
  const photo: Photo = { ...seedCatalog.photos[0], id: 'new-photo' };
  const next = addDraftPhoto(seedCatalog, photo, [photo.room, 'whole_house']);
  expect(next.photos).toHaveLength(seedCatalog.photos.length + 1);
  expect(next.galleries.whole_house.at(-1)).toBe(photo.id);
  expect(seedCatalog.photos).not.toContainEqual(photo);
  expect(() => addDraftTerm(next, { ...next.terms[0], id: 'duplicate' })).toThrow('DUPLICATE_TERM');
});
