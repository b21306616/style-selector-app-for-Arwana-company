import { expect, test } from '@jest/globals';
import { seedCatalog } from '../src/data/catalog';
import { cloneCatalog } from '../src/domain/catalog';
import { previewImport, type CatalogWorkbook, type WorkbookPhoto, type WorkbookRow } from '../src/domain/catalog-transfer';
import { normalizePhotoFilenames } from '../src/domain/photo-filenames';
import type { Catalog, Photo } from '../src/domain/types';
import { decodeWorkbook, encodeWorkbook } from '../src/storage/workbook';

const current = () => normalizePhotoFilenames(cloneCatalog(seedCatalog));
function entry(catalog: Catalog, photo = catalog.photos[0], row = 2): WorkbookRow<WorkbookPhoto> {
  const label = (id: string) => ({ ...catalog.terms.find(term => term.id === id)!.labels });
  return { row, rows: { ru: row, tk: row + 10 }, value: {
    filename: photo.exportFilename!,
    room: { ...catalog.rooms.find(room => room.id === photo.room)!.labels },
    style: label(photo.styleId),
    palette: photo.paletteIds.map(label), material: photo.materialIds.map(label), detail: photo.detailIds.map(label),
  } };
}
const book = (...photos: WorkbookRow<WorkbookPhoto>[]): CatalogWorkbook => ({ photos, issues: [] });
const prepared = (id: string): Photo => ({ ...seedCatalog.photos[0], id, image: { kind: 'local', file: `${id}.jpg`, thumbnail: `${id}-thumb.jpg` } });

test('metadata-only preview uses the exact original fingerprint and never mutates its inputs', () => {
  const draft = cloneCatalog(seedCatalog);
  const before = JSON.stringify(draft);
  const workbook = book(entry(normalizePhotoFilenames(draft)));
  const first = previewImport(draft, workbook, new Map(), 'merge');
  expect(first.base).toBe(before);
  expect(JSON.stringify(draft)).toBe(before);
  expect(previewImport(draft, workbook, new Map(), 'merge')).toEqual(first);
  expect(first.issues).toEqual([]);
  expect(first.added).toBe(0);
  expect(first.updated).toBe(0);
});

test('one-language corrections update shared labels without changing omitted photo references', () => {
  const draft = current();
  const incoming = entry(draft);
  const styleId = draft.photos[0].styleId;
  incoming.value.style.tk = 'Täzelenen terjime';
  const result = previewImport(draft, book(incoming), new Map(), 'merge');
  expect(result.issues).toEqual([]);
  expect(result.catalog.terms.find(term => term.id === styleId)?.labels.tk).toBe('Täzelenen terjime');
  expect(result.catalog.photos.map(photo => photo.styleId)).toEqual(draft.photos.map(photo => photo.styleId));
  expect(result.updated).toBe(1);
});

test('conflicting language matches and inconsistent repeated translations block import', () => {
  const draft = current();
  const first = entry(draft);
  const otherStyle = draft.terms.find(term => term.kind === 'style' && term.id !== draft.photos[0].styleId)!;
  first.value.style.tk = otherStyle.labels.tk;
  const conflict = previewImport(draft, book(first), new Map(), 'merge');
  expect(conflict.issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 2, column: 'Style' }));

  const repeated = entry(draft, draft.photos[1], 3);
  repeated.value.style = { ...entry(draft).value.style, tk: 'Başga terjime' };
  const inconsistent = previewImport(draft, book(entry(draft), repeated), new Map(), 'merge');
  expect(inconsistent.issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 3, column: 'Style' }));
});

test('PNG and JPEG imports sharing a stem keep distinct identities and reimport through either alias', () => {
  const draft = current();
  const png = entry(draft); png.value.filename = 'living.png';
  const jpg = entry(draft, draft.photos[0], 3); jpg.value.filename = 'living.jpg';
  const images = new Map([['living.png', prepared('png')], ['living.jpg', prepared('jpg')]]);
  const imported = previewImport(draft, book(png, jpg), images, 'merge');
  expect(imported.issues).toEqual([]);
  expect(imported.catalog.photos.find(photo => photo.id === 'png')).toMatchObject({ exportFilename: 'living-2.jpg', sourceFilename: 'living.png' });
  expect(imported.catalog.photos.find(photo => photo.id === 'jpg')?.exportFilename).toBe('living.jpg');
  const original = previewImport(imported.catalog, book(png, jpg), new Map(), 'merge');
  expect(original.issues).toEqual([]);
  expect(original.added).toBe(0);
  expect(original.updated).toBe(0);
  const canonical = { ...png, value: { ...png.value, filename: 'living-2.jpg' } };
  expect(previewImport(imported.catalog, book(canonical), new Map(), 'merge').issues).toEqual([]);
  const duplicate = previewImport(imported.catalog, book(png, canonical), new Map(), 'merge');
  expect(duplicate.issues).toContainEqual(expect.objectContaining({ column: 'Image filename' }));
});

test('missing image errors have stable candidates and replacement builds only room galleries', () => {
  const draft = current();
  const incoming = entry(draft); incoming.value.filename = 'new.png';
  incoming.value.room = { ru: 'Новая комната', tk: 'Täze otag' };
  const missing = previewImport(draft, book(incoming), new Map(), 'replace');
  expect(missing.issues).toContainEqual(expect.objectContaining({ column: 'Image filename', row: 2 }));
  expect(previewImport(draft, book(incoming), new Map(), 'replace')).toEqual(missing);
  const result = previewImport(draft, book(incoming), new Map([['new.png', prepared('new')]]), 'replace');
  expect(result.issues).toEqual([]);
  expect(result.catalog.photos).toHaveLength(1);
  expect(result.catalog.rooms).toHaveLength(1);
  expect(result.catalog.galleries.whole_house).toEqual([]);
  expect(result.catalog.galleries[result.catalog.photos[0].room]).toEqual(['new']);
});

test('moving an existing library-only photo preserves its omission from galleries', () => {
  const draft = current();
  const photo = draft.photos[0];
  for (const key of Object.keys(draft.galleries)) draft.galleries[key] = draft.galleries[key].filter(id => id !== photo.id);
  const incoming = entry(draft);
  incoming.value.room = { ...draft.rooms.find(room => room.id !== photo.room)!.labels };
  const result = previewImport(draft, book(incoming), new Map(), 'merge');
  expect(result.issues).toEqual([]);
  expect(Object.values(result.catalog.galleries).flat()).not.toContain(photo.id);
});

test('multiple unresolved tags in one cell do not report a false duplicate-name error', () => {
  const draft = current();
  const incoming = entry(draft);
  incoming.value.palette = [
    { ru: 'Тёплые нейтральные тона', tk: 'Sowuk bitarap öwüşginler' },
    { ru: 'Природные оттенки', tk: 'Ýyly bitarap öwüşginler' },
  ];
  const result = previewImport(draft, book(incoming), new Map(), 'merge');
  const paletteIssues = result.issues.filter(issue => issue.column === 'Palette');
  expect(paletteIssues).toHaveLength(2);
  expect(paletteIssues.every(issue => !issue.labels.ru.includes('повторяется'))).toBe(true);
});

test('decodeWorkbook and previewImport report a single clean issue per blank or mismatched cell', () => {
  const draft = current();
  const single = cloneCatalog(draft);
  single.photos = [{ ...single.photos[0], styleId: '', paletteIds: [] }];
  const decoded = decodeWorkbook(encodeWorkbook(single));
  const preview = previewImport(draft, decoded, new Map(), 'merge');
  expect(preview.issues.filter(issue => issue.sheet === 'Russian' && issue.column === 'Style')).toHaveLength(1);
  expect(preview.issues.filter(issue => issue.sheet === 'Turkmen' && issue.column === 'Palette')).toHaveLength(1);
});
