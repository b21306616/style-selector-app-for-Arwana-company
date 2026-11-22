import { expect, test } from '@jest/globals';
import * as XLSX from 'xlsx';
import { strToU8, zipSync } from 'fflate';
import { seedCatalog } from '../src/data/catalog';
import { cloneCatalog } from '../src/domain/catalog';
import { addDraftPhoto, addDraftTerm, filenameKey, previewImport, type CatalogWorkbook } from '../src/domain/catalog-transfer';
import { readZipIndex } from '../src/domain/zip';
import type { Catalog, Photo } from '../src/domain/types';
import { decodeWorkbook, encodeWorkbook, exportFilename } from '../src/storage/workbook';

const empty = (): Catalog => ({ ...cloneCatalog(seedCatalog), photos: [], terms: [], galleries: { whole_house: [], bathroom: [], bedroom: [], living_room: [], kitchen: [] }, sample: false });
function editWorkbook(edit: (book: XLSX.WorkBook) => void) {
  const book = XLSX.read(encodeWorkbook(seedCatalog), { type: 'array' });
  edit(book);
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }));
}
function imageMap(catalog: Catalog) {
  return new Map(catalog.photos.map((photo, index) => [filenameKey(exportFilename(index)), { ...photo, image: { kind: 'local' as const, file: `new-${index}.jpg`, thumbnail: `new-${index}-thumb.jpg` } }]));
}

test('a full workbook plus separate images restores the catalog on a fresh device', () => {
  const input = cloneCatalog(seedCatalog);
  input.terms[0].labels = { ru: 'Тёплый современный', tk: 'Ýyly döwrebap' };
  const workbook = decodeWorkbook(encodeWorkbook(input));
  const preview = previewImport(empty(), workbook, imageMap(input), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.terms).toEqual(input.terms);
  expect(preview.catalog.galleries).toEqual(input.galleries);
  expect(preview.catalog.photos.map(({ image, ...metadata }) => metadata)).toEqual(input.photos.map(({ image, ...metadata }) => metadata));
  expect(preview.catalog.photos.every(photo => photo.image.kind === 'local')).toBe(true);
  expect(preview.catalog.sample).toBe(input.sample);
});

test('metadata-only reimport retains existing images without reporting false updates', () => {
  const preview = previewImport(seedCatalog, decodeWorkbook(encodeWorkbook(seedCatalog)), new Map(), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.updated).toBe(0);
  expect(preview.added).toBe(0);
  expect(preview.removed).toBe(0);
  expect(preview.catalog).toEqual(seedCatalog);
});

test('merge keeps omitted records and appends omitted gallery photos in their original order', () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = workbook.photos.slice(0, 2);
  workbook.terms = [];
  const before = seedCatalog.galleries.whole_house;
  workbook.galleries = [{ row: 2, value: { space: 'whole_house', photoId: before[1], position: 1 } }];
  const preview = previewImport(seedCatalog, workbook, new Map(), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.photos).toHaveLength(seedCatalog.photos.length);
  expect(preview.catalog.galleries.whole_house).toEqual([before[1], ...before.filter(id => id !== before[1])]);
  expect(seedCatalog.galleries.whole_house).toEqual(before);
});

test('replacement removes omitted records and clears omitted galleries without altering the input', () => {
  const original = cloneCatalog(seedCatalog);
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = workbook.photos.slice(0, 1);
  workbook.galleries = [];
  const preview = previewImport(original, workbook, new Map(), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.removed).toBe(seedCatalog.photos.length - 1);
  expect(preview.catalog.photos).toHaveLength(1);
  expect(Object.values(preview.catalog.galleries).flat()).toEqual([]);
  expect(original).toEqual(seedCatalog);
});

test('room changes remove former room membership and preserve Whole House', () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  const photo = workbook.photos[0];
  const oldRoom = photo.value.room;
  photo.value.room = oldRoom === 'kitchen' ? 'bedroom' : 'kitchen';
  workbook.photos = [photo]; workbook.terms = []; workbook.galleries = [];
  const preview = previewImport(seedCatalog, workbook, new Map(), 'merge');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.galleries[oldRoom]).not.toContain(photo.value.id);
  expect(preview.catalog.galleries.whole_house).toEqual(seedCatalog.galleries.whole_house);
});

test('new photo filenames are matched case insensitively and missing files identify their row', () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  const missing = previewImport(empty(), workbook, new Map(), 'replace');
  expect(missing.issues).toContainEqual(expect.objectContaining({ sheet: 'Photos', row: 2, column: 'image_filename' }));
  workbook.photos[0].value.filename = 'PHOTO-0001.JPG';
  expect(previewImport(empty(), workbook, imageMap(seedCatalog), 'replace').issues).toEqual([]);
});

test('parser reports formula cells, duplicate IDs, unsupported rooms and repeated gallery positions', () => {
  const workbook = decodeWorkbook(editWorkbook(book => {
    book.Sheets.Terms.A3 = { t: 's', v: book.Sheets.Terms.A2.v };
    book.Sheets.Photos.D2 = { t: 's', v: 'modern', f: 'CONCAT("modern")' };
    book.Sheets.Photos.C3 = { t: 's', v: 'office' };
    book.Sheets.Galleries.C3 = { t: 'n', v: 1 };
  }));
  expect(workbook.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ sheet: 'Terms', row: 3 }),
    expect.objectContaining({ sheet: 'Photos', row: 2, column: 'style_id' }),
    expect.objectContaining({ sheet: 'Photos', row: 3, column: 'room' }),
    expect.objectContaining({ sheet: 'Galleries', row: 3 }),
  ]));
});

test('unknown references block import while incomplete tagging is only a publication warning', () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos[0].value.styleId = 'missing-style';
  expect(previewImport(seedCatalog, workbook, new Map(), 'merge').issues).toContainEqual(expect.objectContaining({ column: 'style_id', row: 2 }));
  workbook.photos[0].value.styleId = '';
  workbook.photos[0].value.paletteIds = [];
  const incomplete = previewImport(seedCatalog, workbook, new Map(), 'merge');
  expect(incomplete.issues).toEqual([]);
  expect(incomplete.warnings).toBeGreaterThan(0);
});

test('the empty template is valid and guide examples are never imported', () => {
  const workbook = decodeWorkbook(encodeWorkbook());
  expect(workbook).toEqual({ terms: [], photos: [], galleries: [], issues: [] });
});

test('rejects truncated archives, unsafe paths, excessive expansion and unsupported format versions', () => {
  expect(() => decodeWorkbook(encodeWorkbook(seedCatalog).subarray(0, 100))).toThrow();
  const unsafe = zipSync({ '../photo.jpg': strToU8('image') });
  expect(() => readZipIndex(unsafe.length, (offset, length) => unsafe.subarray(offset, offset + length), 1000)).toThrow('INVALID_ARCHIVE');
  const large = zipSync({ 'photo.jpg': new Uint8Array(2000) });
  expect(() => readZipIndex(large.length, (offset, length) => large.subarray(offset, offset + length), 1000)).toThrow('TRANSFER_LIMIT');
  expect(() => decodeWorkbook(editWorkbook(book => { book.Sheets.Metadata.B2.v = '2'; }))).toThrow('INVALID_WORKBOOK');
});

test('500-photo workbook round trip preserves every record and gallery position', () => {
  const catalog = cloneCatalog(seedCatalog);
  catalog.photos = Array.from({ length: 500 }, (_, index) => ({ ...seedCatalog.photos[index % seedCatalog.photos.length], id: `benchmark-${index}` }));
  catalog.galleries = { ...empty().galleries, whole_house: catalog.photos.map(photo => photo.id) };
  const preview = previewImport(empty(), decodeWorkbook(encodeWorkbook(catalog)), imageMap(catalog), 'replace');
  expect(preview.issues).toEqual([]);
  expect(preview.catalog.photos).toHaveLength(500);
  expect(preview.catalog.galleries.whole_house).toEqual(catalog.galleries.whole_house);
  expect(() => encodeWorkbook({ ...catalog, photos: [...catalog.photos, catalog.photos[0]] })).toThrow('TRANSFER_LIMIT');
});

test('direct entry preserves unrelated draft edits and rejects duplicate vocabulary names', () => {
  const photo: Photo = { ...seedCatalog.photos[0], id: 'new-photo' };
  const next = addDraftPhoto(seedCatalog, photo, [photo.room, 'whole_house']);
  expect(next.photos).toHaveLength(seedCatalog.photos.length + 1);
  expect(next.galleries.whole_house.at(-1)).toBe(photo.id);
  expect(seedCatalog.photos).not.toContainEqual(photo);
  expect(() => addDraftTerm(next, { ...next.terms[0], id: 'duplicate' })).toThrow('DUPLICATE_TERM');
});

test('replacement requires its own referenced terms and disallows ambiguous bilingual names', () => {
  const workbook: CatalogWorkbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.terms = [];
  expect(previewImport(seedCatalog, workbook, new Map(), 'replace').issues.length).toBeGreaterThan(0);
  workbook.terms = [{ row: 2, value: { ...seedCatalog.terms[0], id: 'other-id' } }];
  expect(previewImport(seedCatalog, workbook, new Map(), 'merge').issues).toContainEqual(expect.objectContaining({ sheet: 'Terms', row: 2 }));
});
