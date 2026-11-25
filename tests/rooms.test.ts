import { expect, test } from '@jest/globals';
import { seedCatalog } from '../src/data/catalog';
import { addDraftRoom, cloneCatalog, removeDraftOptions, validateCatalog } from '../src/domain/catalog';
import { addDraftPhoto } from '../src/domain/catalog-transfer';
import { defaultRooms, normalizeCatalog } from '../src/domain/rooms';
import { normalizePhotoFilenames } from '../src/domain/photo-filenames';
import { spaceLabel } from '../src/ui/copy';

const office = { id: 'office', labels: { ru: 'Кабинет', tk: 'Iş otagy' } };

test('a bilingual room gets an empty gallery and stable photo references', () => {
  const draft = addDraftRoom(seedCatalog, office);
  expect(draft.galleries.office).toEqual([]);
  expect(spaceLabel('office', 'ru', draft.rooms)).toBe('Кабинет');
  const saved = addDraftPhoto(draft, { ...seedCatalog.photos[0], id: 'office-photo', room: 'office' }, ['office', 'whole_house']);
  expect(saved.galleries.office).toEqual(['office-photo']);
  expect(validateCatalog(saved)).toEqual([]);
  expect(seedCatalog.rooms).toEqual(defaultRooms);
});

test('creation validates both names and rejects duplicates in either language', () => {
  expect(() => addDraftRoom(seedCatalog, { ...office, labels: { ru: ' ', tk: 'Iş' } })).toThrow('INVALID_CATALOG');
  expect(() => addDraftRoom(seedCatalog, { ...office, labels: { ru: 'К'.repeat(101), tk: 'Iş' } })).toThrow('INVALID_CATALOG');
  expect(() => addDraftRoom(seedCatalog, { ...office, labels: { ru: '  ВАННАЯ ', tk: 'Other' } })).toThrow('DUPLICATE_ROOM');
  expect(() => addDraftRoom(seedCatalog, { ...office, labels: { ru: 'Other', tk: 'aşhana' } })).toThrow('DUPLICATE_ROOM');
  expect(() => addDraftRoom(seedCatalog, { ...office, id: 'whole_house' })).toThrow('INVALID_CATALOG');
});

test('bulk deletion is atomic and protects all saved draft photo assignments', () => {
  const draft = addDraftRoom(seedCatalog, office);
  expect(() => removeDraftOptions(draft, 'room', ['office', 'kitchen'])).toThrow('REFERENCED_ROOM');
  expect(draft.rooms).toContainEqual(office);
  const cleared = removeDraftOptions(draft, 'room', ['office']);
  expect(cleared.rooms).not.toContainEqual(office);
  expect(cleared.galleries).not.toHaveProperty('office');
  expect(cleared.photos).toEqual(draft.photos);
  expect(() => removeDraftOptions(draft, 'style', ['minimalist'])).toThrow('REFERENCED_TERM');
  expect(() => removeDraftOptions(draft, 'room', ['missing'])).toThrow('STALE_DRAFT');
});

test.each(['palette', 'material', 'detail'] as const)('bulk %s deletion protects saved photo tags and deletes unused tags', kind => {
  const draft = cloneCatalog(seedCatalog);
  const referenced = draft.terms.find(term => term.kind === kind)!;
  const unused = { id: `${kind}-unused`, kind, labels: { ru: 'Свободный', tk: 'Boş' } };
  draft.terms.push(unused);

  expect(() => removeDraftOptions(draft, kind, [unused.id, referenced.id])).toThrow('REFERENCED_TERM');
  expect(draft.terms).toContainEqual(unused);

  const next = removeDraftOptions(draft, kind, [unused.id]);
  expect(next.terms).not.toContainEqual(unused);
  expect(next.photos).toEqual(draft.photos);
});

test('unused built-in rooms can be removed, including the final room', () => {
  const draft = { ...cloneCatalog(seedCatalog), photos: [], galleries: Object.fromEntries(Object.keys(seedCatalog.galleries).map(id => [id, []])) };
  const empty = removeDraftOptions(draft, 'room', draft.rooms.map(room => room.id));
  expect(empty.rooms).toEqual([]);
  expect(empty.galleries).toEqual({ whole_house: [] });
  expect(validateCatalog(empty)).toEqual([]);
  expect(normalizeCatalog(empty)).toEqual(normalizePhotoFilenames(empty));
  expect(() => addDraftPhoto(empty, seedCatalog.photos[0], [])).toThrow('ROOM_REQUIRED');
});

test('legacy payload normalization preserves IDs, while malformed new definitions are rejected', () => {
  const { rooms: _rooms, ...legacy } = seedCatalog;
  expect(normalizeCatalog(legacy)).toEqual(normalizePhotoFilenames(seedCatalog));
  expect(validateCatalog({ ...seedCatalog, rooms: null })).toContainEqual(expect.objectContaining({ code: 'STRUCTURE' }));
  expect(validateCatalog({ ...seedCatalog, rooms: [...seedCatalog.rooms, office, office] })).toContainEqual(expect.objectContaining({ code: 'ROOM_DEFINITION' }));
});
