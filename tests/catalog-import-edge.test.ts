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
  const first = previewImport(draft, workbook, new Map());
  expect(first.base).toBe(before);
  expect(JSON.stringify(draft)).toBe(before);
  expect(previewImport(draft, workbook, new Map())).toEqual(first);
  expect(first.issues).toEqual([]);
  expect(first.added).toBe(first.catalog.rooms.length + first.catalog.terms.length + first.catalog.photos.length);
});

test('one-language corrections update shared labels without changing omitted photo references', () => {
  const draft = current();
  const incoming = entry(draft);
  incoming.value.style.tk = 'Täzelenen terjime';
  const result = previewImport(draft, book(incoming), new Map());
  expect(result.issues).toEqual([]);
  expect(result.catalog.terms.find(term => term.labels.ru === incoming.value.style.ru)?.labels.tk).toBe('Täzelenen terjime');
  expect(result.catalog.photos).toHaveLength(1);
  expect(result.catalog.photos[0].styleId).toBe('excel-style-1');
  expect(result.removed).toBeGreaterThan(0);
});

test('inconsistent repeated translations block import', () => {
  const draft = current();
  const repeated = entry(draft, draft.photos[1], 3);
  repeated.value.style = { ...entry(draft).value.style, tk: 'Başga terjime' };
  const inconsistent = previewImport(draft, book(entry(draft), repeated), new Map());
  expect(inconsistent.issues).toContainEqual(expect.objectContaining({ sheet: 'Russian', row: 3, column: 'Style' }));
});

test('PNG and JPEG imports sharing a stem keep distinct identities and reimport through either alias', () => {
  const draft = current();
  const png = entry(draft); png.value.filename = 'living.png';
  const jpg = entry(draft, draft.photos[0], 3); jpg.value.filename = 'living.jpg';
  const images = new Map([['living.png', prepared('png')], ['living.jpg', prepared('jpg')]]);
  const imported = previewImport(draft, book(png, jpg), images);
  expect(imported.issues).toEqual([]);
  expect(imported.catalog.photos.map(photo => photo.sourceFilename)).toEqual(['living.png', undefined]);
  expect(new Set(imported.catalog.photos.map(photo => photo.exportFilename)).size).toBe(2);
  const original = previewImport(imported.catalog, book(png, jpg), new Map());
  expect(original.issues).toEqual([]);
  expect(original.added).toBe(original.catalog.rooms.length + original.catalog.terms.length + original.catalog.photos.length);
  const canonical = { ...png, value: { ...png.value, filename: 'living-2.jpg' } };
  expect(previewImport(imported.catalog, book(canonical), new Map()).issues).toEqual([]);
  const duplicate = previewImport(imported.catalog, book(png, canonical), new Map());
  expect(duplicate.issues).toContainEqual(expect.objectContaining({ column: 'Image filename' }));
  const replacement = prepared('second-image');
  const separate = previewImport(imported.catalog, book(png, canonical), new Map([['living-2.jpg', replacement]]));
  expect(separate.issues).toEqual([]);
  expect(separate.catalog.photos.map(photo => photo.image)).toEqual([imported.catalog.photos[0].image, replacement.image]);
});

test('missing image errors have stable candidates and replacement builds only room galleries', () => {
  const draft = current();
  const incoming = entry(draft); incoming.value.filename = 'new.png';
  incoming.value.room = { ru: 'Новая комната', tk: 'Täze otag' };
  const missing = previewImport(draft, book(incoming), new Map());
  expect(missing.issues).toContainEqual(expect.objectContaining({ column: 'Image filename', row: 2 }));
  expect(previewImport(draft, book(incoming), new Map())).toEqual(missing);
  const result = previewImport(draft, book(incoming), new Map([['new.png', prepared('new')]]));
  expect(result.issues).toEqual([]);
  expect(result.catalog.photos).toHaveLength(1);
  expect(result.catalog.rooms).toHaveLength(1);
  expect(result.catalog.galleries.whole_house).toEqual([]);
  expect(result.catalog.galleries[result.catalog.photos[0].room]).toEqual([result.catalog.photos[0].id]);
});

test('moving an existing library-only photo preserves its omission from galleries', () => {
  const draft = current();
  const photo = draft.photos[0];
  for (const key of Object.keys(draft.galleries)) draft.galleries[key] = draft.galleries[key].filter(id => id !== photo.id);
  const incoming = entry(draft);
  incoming.value.room = { ...draft.rooms.find(room => room.id !== photo.room)!.labels };
  const result = previewImport(draft, book(incoming), new Map());
  expect(result.issues).toEqual([]);
  expect(result.catalog.galleries[result.catalog.photos[0].room]).toEqual([result.catalog.photos[0].id]);
  expect(result.catalog.galleries.whole_house).toEqual([]);
});

test('new tags in one cell seed fresh vocabulary without duplicate-name errors', () => {
  const draft = current();
  const incoming = entry(draft);
  incoming.value.palette = [
    { ru: 'Тёплые нейтральные тона', tk: 'Sowuk bitarap öwüşginler' },
    { ru: 'Природные оттенки', tk: 'Ýyly bitarap öwüşginler' },
  ];
  const result = previewImport(draft, book(incoming), new Map());
  const paletteIssues = result.issues.filter(issue => issue.column === 'Palette');
  expect(paletteIssues).toEqual([]);
});

test('cleared metadata can be saved to the draft and flagged for publication', () => {
  const draft = current();
  const single = cloneCatalog(draft);
  single.photos = [{ ...single.photos[0], styleId: '', paletteIds: [] }];
  const decoded = decodeWorkbook(encodeWorkbook(single));
  const preview = previewImport(draft, decoded, new Map());
  expect(preview.issues).toEqual([]);
  expect(preview.warnings).toBeGreaterThan(0);
  expect(preview.catalog.photos[0]).toMatchObject({ styleId: '', paletteIds: [] });
});
