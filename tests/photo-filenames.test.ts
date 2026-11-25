import { expect, test } from '@jest/globals';
import { seedCatalog } from '../src/data/catalog';
import { normalizePhotoFilenames, filenameKey, exportFilename } from '../src/domain/photo-filenames';
import type { Catalog, Photo } from '../src/domain/types';

const photo = (id: string, sourceFilename?: string): Photo => ({ ...seedCatalog.photos[0], id, sourceFilename });
const catalog = (photos: Photo[]): Catalog => ({ ...seedCatalog, photos });

test('legacy names are assigned once and survive deletion, reordering and JSON persistence', () => {
  const input = catalog([photo('a'), photo('b'), photo('c')]);
  const first = normalizePhotoFilenames(input);
  expect(first.photos.map(item => item.exportFilename)).toEqual(['photo-0001.jpg', 'photo-0002.jpg', 'photo-0003.jpg']);
  expect(input.photos[0].exportFilename).toBeUndefined();
  const edited = normalizePhotoFilenames({ ...first, photos: [first.photos[2], first.photos[0], photo('d')] });
  expect(edited.photos.map(item => item.exportFilename)).toEqual(['photo-0003.jpg', 'photo-0001.jpg', 'photo-0004.jpg']);
  expect(normalizePhotoFilenames(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
});

test('an older edit object cannot erase canonical filenames or original import aliases', () => {
  const initial = normalizePhotoFilenames(catalog([photo('a', 'kitchen.png')]));
  const saved = normalizePhotoFilenames(catalog([{ ...photo('a'), room: 'bedroom' }]), initial);
  expect(saved.photos[0]).toMatchObject({ exportFilename: 'kitchen.jpg', sourceFilename: 'kitchen.png', room: 'bedroom' });
});

test('JPEG names reserve every incoming source name regardless of row order', () => {
  const input = catalog([photo('png', 'living.png'), photo('jpg', 'living.jpg'), photo('webp', 'living.webp')]);
  const normalized = normalizePhotoFilenames(input);
  expect(normalized.photos.map(item => item.exportFilename)).toEqual(['living-2.jpg', 'living.jpg', 'living-3.jpg']);
  expect(normalized.photos[0].sourceFilename).toBe('living.png');
  expect(normalized.photos[1].sourceFilename).toBeUndefined();
  const names = normalized.photos.flatMap(item => [item.exportFilename!, ...(item.sourceFilename ? [item.sourceFilename] : [])]);
  expect(new Set(names.map(filenameKey)).size).toBe(names.length);
});

test('the external reservation list prevents filenames being taken from later import rows', () => {
  expect(normalizePhotoFilenames(catalog([photo('a', 'living.png')]), undefined, ['living.jpg']).photos[0].exportFilename).toBe('living-2.jpg');
});

test('case and Unicode equivalent aliases cannot identify separate photos', () => {
  expect(() => normalizePhotoFilenames(catalog([photo('a', 'Cafe\u0301.png'), photo('b', 'CAFÉ.PNG')]))).toThrow('DUPLICATE_FILENAME');
  expect(() => normalizePhotoFilenames(catalog([{ ...photo('a'), exportFilename: 'living.jpg' }, photo('b', 'LIVING.JPG')]))).toThrow('DUPLICATE_FILENAME');
});

test('filename counters survive deletion, replacement and reset to an older snapshot', () => {
  const initial = normalizePhotoFilenames(catalog([photo('a')]));
  const newer = normalizePhotoFilenames({ ...initial, photos: [...initial.photos, photo('b')] });
  const reset = normalizePhotoFilenames(initial, newer);
  const added = normalizePhotoFilenames({ ...reset, photos: [...reset.photos, photo('c')] });
  expect(added.photos[1].exportFilename).toBe('photo-0003.jpg');
  const empty = normalizePhotoFilenames(catalog([]), added);
  expect(normalizePhotoFilenames({ ...empty, photos: [photo('d')] }).photos[0].exportFilename).toBe('photo-0004.jpg');
});

test('generated names skip reserved import numbers and preserve valid path-free names', () => {
  const normalized = normalizePhotoFilenames(catalog([photo('import', 'photo-0100.jpg'), photo('new')]));
  expect(normalized.photos[1].exportFilename).toBe('photo-0101.jpg');
  expect(exportFilename(0)).toBe('photo-0001.jpg');
  expect(() => normalizePhotoFilenames(catalog([photo('a', '../living.png')]))).toThrow('INVALID_CATALOG');
  expect(() => normalizePhotoFilenames(catalog([{ ...photo('a'), exportFilename: 'living.png' }]))).toThrow('INVALID_CATALOG');
});
