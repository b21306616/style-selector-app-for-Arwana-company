/// <reference types="node" />
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { addDraftRoom, cloneCatalog, removeDraftOptions } from '../src/domain/catalog';
import { createSession, rateSession, undoSession } from '../src/domain/session';
import type { Catalog } from '../src/domain/types';
import { previewImport } from '../src/domain/catalog-transfer';
import { decodeWorkbook, encodeWorkbook } from '../src/storage/workbook';

// Exercise the actual SQL and rollback behavior without a simulator/native bridge.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = jest.requireActual<typeof import('node:sqlite')>('node:sqlite');
  const database = new DatabaseSync(':memory:');
  let failPublication = false;
  const adapter = {
    execAsync: async (sql: string) => database.exec(sql),
    runAsync: async (sql: string, ...parameters: (string | number | null)[]) => {
      if (failPublication && sql === 'UPDATE metadata SET value = ? WHERE key = ?') {
        failPublication = false;
        throw new Error('Simulated full disk');
      }
      return database.prepare(sql).run(...parameters);
    },
    getFirstAsync: async (sql: string, ...parameters: (string | number | null)[]) => database.prepare(sql).get(...parameters) ?? null,
    getAllAsync: async (sql: string, ...parameters: (string | number | null)[]) => database.prepare(sql).all(...parameters),
    withTransactionAsync: async (action: () => Promise<void>) => {
      database.exec('BEGIN');
      try { await action(); database.exec('COMMIT'); }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  return { openDatabaseAsync: async () => adapter, __database: database, __failPublication: () => { failPublication = true; } };
});

jest.mock('../src/storage/images', () => ({ assertCatalogImages: jest.fn(async () => undefined) }));

type Repository = typeof import('../src/storage/repository');
type Database = import('node:sqlite').DatabaseSync;
let repository: Repository;
let sqlite: { __database: Database; __failPublication(): void };

beforeEach(() => {
  jest.resetModules();
  repository = jest.requireActual<Repository>('../src/storage/repository');
  sqlite = jest.requireMock<typeof sqlite>('expo-sqlite');
});

afterEach(() => sqlite.__database.close());

test('initialization seeds once and persists language, session order, and undo across reads', async () => {
  const initial = await repository.loadState();
  expect(initial.language).toBe('ru');
  expect(initial.catalog.photos).toHaveLength(48);
  let session = createSession(initial.catalog, 'bathroom', 'saved');
  session = rateSession(session, 'like', session.catalog.galleries.bathroom[0]);
  await repository.saveSession(session);
  await repository.saveLanguage('tk');
  const resumed = await repository.loadState();
  expect(resumed.language).toBe('tk');
  expect(resumed.session?.ratings).toEqual(session.ratings);
  expect(resumed.session?.catalog.id).toBe(initial.catalog.id);
  const savedPayload = sqlite.__database.prepare('SELECT payload FROM active_session').get() as { payload: string };
  expect(JSON.parse(savedPayload.payload)).not.toHaveProperty('catalog');
});

test('legacy room definitions are supplied when reading published, draft, and session snapshots', async () => {
  const initial = await repository.loadState();
  await repository.saveSession(createSession(initial.catalog, 'kitchen', 'legacy'));
  const { rooms: _rooms, ...legacy } = initial.catalog;
  sqlite.__database.prepare('UPDATE catalog_revisions SET payload = ?').run(JSON.stringify(legacy));
  sqlite.__database.prepare('UPDATE catalog_draft SET payload = ?').run(JSON.stringify(legacy));
  const resumed = await repository.loadState();
  expect(resumed.catalog.rooms).toEqual(initial.catalog.rooms);
  expect(resumed.draft.rooms).toEqual(initial.draft.rooms);
  expect(resumed.session?.catalog.rooms).toEqual(initial.catalog.rooms);
  expect(resumed.notices).toEqual([]);
});

test.each([
  ['whole_house', 'active'], ['whole_house', 'complete'], ['bathroom', 'active'], ['bathroom', 'complete'],
] as const)('room migration preserves the pinned %s session when %s', async (space, status) => {
  const { catalog: old } = await repository.loadState();
  const [a, b, c, d] = old.galleries.bathroom;
  const [k, ...kitchen] = old.galleries.kitchen;
  old.galleries.bathroom = [b, a];
  old.galleries.kitchen = kitchen;
  old.galleries.whole_house = [k, d, b, c];
  const draft = cloneCatalog(old);
  draft.galleries.bathroom = [c];
  draft.galleries.whole_house = [a, d, c, d, k];
  draft.photos.find(photo => photo.id === k)!.room = '';
  draft.rooms[0].labels.ru = 'Комната в черновике';
  const originalDeck = old.galleries[space];
  const reviewed = status === 'active' ? originalDeck.slice(0, 1) : originalDeck;
  const payload = { id: 'previous-client', space, status, createdAt: old.createdAt, ratings: reviewed.map(photoId => ({ photoId, choice: 'like' })) };
  const db = sqlite.__database;
  db.prepare('UPDATE catalog_revisions SET payload = ? WHERE id = ?').run(JSON.stringify(old), old.id);
  db.prepare('UPDATE catalog_draft SET payload = ?').run(JSON.stringify(draft));
  db.prepare('INSERT INTO active_session (singleton, catalog_id, payload) VALUES (1, ?, ?)').run(old.id, JSON.stringify(payload));
  db.exec('PRAGMA user_version = 1');

  const upgraded = await repository.loadState();
  expect(upgraded.notices).toEqual([]);
  expect(upgraded.catalog.id).not.toBe(old.id);
  expect(upgraded.catalog.version).toBe(old.version + 1);
  expect(upgraded.catalog.galleries).toEqual({ bathroom: [b, a, d, c], bedroom: old.galleries.bedroom, living_room: old.galleries.living_room, kitchen: [...kitchen, k] });
  expect(upgraded.draft.id).toBe(upgraded.catalog.id);
  expect(upgraded.draft.galleries).toEqual({ ...upgraded.catalog.galleries, bathroom: [c, a, d], kitchen });
  expect(upgraded.draft.rooms).toEqual(draft.rooms);
  expect(upgraded.catalog.rooms).toEqual(old.rooms);
  expect(upgraded.draft.photos).toEqual(draft.photos);
  expect(upgraded.session).toEqual({ ...payload, catalog: old });
  expect(await repository.loadState()).toEqual(upgraded);
  expect(() => createSession(upgraded.catalog, 'whole_house', 'new')).toThrow('EMPTY_GALLERY');
  expect(() => createSession(old, 'whole_house', 'new')).toThrow('EMPTY_GALLERY');

  let session = upgraded.session!;
  for (const id of originalDeck.slice(session.ratings.length)) session = rateSession(session, 'dislike', id);
  expect(session.status).toBe('complete');
  await repository.saveSession(session);
  expect((await repository.loadState()).session).toEqual(session);
  const undone = undoSession(session);
  await repository.saveSession(undone);
  expect((await repository.loadState()).session).toEqual(undone);
  const next = createSession(upgraded.catalog, 'bathroom', 'next-client');
  await repository.saveSession(next);
  expect((await repository.loadState()).session).toEqual(next);
  await repository.clearSession();
  expect((await repository.getReferencedCatalogs()).some(catalog => catalog.id === old.id)).toBe(false);
});

test('a failed room migration rolls back the new revision, draft and version, then retries once', async () => {
  const { catalog } = await repository.loadState();
  catalog.galleries.whole_house = catalog.galleries.bedroom.slice(0, 2);
  const original = JSON.stringify(catalog);
  const db = sqlite.__database;
  db.prepare('UPDATE catalog_revisions SET payload = ?').run(original);
  db.prepare('UPDATE catalog_draft SET payload = ?').run(original);
  db.exec('PRAGMA user_version = 1');
  db.exec("CREATE TRIGGER fail_draft BEFORE INSERT ON catalog_draft BEGIN SELECT RAISE(ABORT, 'draft write failed'); END");
  await expect(repository.loadState()).rejects.toThrow('draft write failed');
  expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
  expect(db.prepare('SELECT payload FROM catalog_revisions').all()).toEqual([{ payload: original }]);
  expect(db.prepare('SELECT payload FROM catalog_draft').get()).toEqual({ payload: original });
  expect(db.prepare("SELECT value FROM metadata WHERE key = 'current_catalog'").get()).toEqual({ value: catalog.id });
  db.exec('DROP TRIGGER fail_draft');
  const upgraded = await repository.loadState();
  expect(upgraded.catalog.galleries).not.toHaveProperty('whole_house');
  expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
  expect(await repository.loadState()).toEqual(upgraded);
});

test('loading legacy filename data persists the backfill for drafts, revisions, and sessions', async () => {
  const initial = await repository.loadState();
  await repository.saveSession(createSession(initial.catalog, 'kitchen', 'filename-backfill'));
  const changed = cloneCatalog(initial.draft);
  changed.terms[0].labels.tk = 'Soňky neşir';
  await repository.saveDraft(changed);
  const published = await repository.publishDraft();
  const legacy = (catalog: Catalog) => {
    const value = JSON.parse(JSON.stringify(catalog)) as Catalog;
    delete value.nextPhotoNumber;
    for (const photo of value.photos) {
      delete photo.exportFilename;
      delete photo.sourceFilename;
    }
    return value;
  };
  const legacyCurrent = legacy(published.catalog);
  const legacySession = legacy(initial.catalog);
  sqlite.__database.prepare('UPDATE catalog_revisions SET payload = ? WHERE id = ?').run(JSON.stringify(legacyCurrent), published.catalog.id);
  sqlite.__database.prepare('UPDATE catalog_revisions SET payload = ? WHERE id = ?').run(JSON.stringify(legacySession), initial.catalog.id);
  sqlite.__database.prepare('UPDATE catalog_draft SET payload = ?').run(JSON.stringify(legacyCurrent));

  const migrated = await repository.loadState();
  const storedRevision = JSON.parse((sqlite.__database.prepare('SELECT payload FROM catalog_revisions WHERE id = ?').get(published.catalog.id) as { payload: string }).payload) as Catalog;
  const storedSessionRevision = JSON.parse((sqlite.__database.prepare('SELECT payload FROM catalog_revisions WHERE id = ?').get(initial.catalog.id) as { payload: string }).payload) as Catalog;
  const storedDraft = JSON.parse((sqlite.__database.prepare('SELECT payload FROM catalog_draft').get() as { payload: string }).payload) as Catalog;
  for (const catalog of [storedRevision, storedSessionRevision, storedDraft]) {
    expect(catalog.photos.every(photo => /^photo-\d+\.jpg$/.test(photo.exportFilename ?? ''))).toBe(true);
    expect(catalog.nextPhotoNumber).toBeGreaterThan(catalog.photos.length);
  }
  expect(migrated.session?.catalog.photos[0].exportFilename).toBe(storedSessionRevision.photos[0].exportFilename);

  const nextNumber = migrated.draft.nextPhotoNumber!;
  const deleted = cloneCatalog(migrated.draft);
  const removed = deleted.photos.shift()!;
  for (const space of Object.keys(deleted.galleries) as (keyof typeof deleted.galleries)[]) deleted.galleries[space] = deleted.galleries[space].filter(id => id !== removed.id);
  await repository.saveDraft(deleted);
  const withNewPhoto = cloneCatalog((await repository.loadState()).draft);
  withNewPhoto.photos.push({ ...initial.draft.photos[0], id: 'backfilled-new', exportFilename: undefined, sourceFilename: undefined });
  await repository.saveDraft(withNewPhoto);
  expect((await repository.loadState()).draft.photos.find(photo => photo.id === 'backfilled-new')?.exportFilename).toBe(`photo-${String(nextNumber).padStart(4, '0')}.jpg`);
});

test('custom rooms persist and publish while existing sessions retain their original labels and rooms', async () => {
  const initial = await repository.loadState();
  await repository.saveSession(createSession(initial.catalog, 'kitchen', 'original'));
  const room = { id: 'office', labels: { ru: 'Кабинет', tk: 'Iş otagy' } };
  const draft = addDraftRoom(initial.draft, room);
  draft.photos.push({ ...draft.photos[0], id: 'office-photo', room: room.id, exportFilename: undefined, sourceFilename: undefined });
  draft.galleries.office.push('office-photo');
  await repository.saveDraft(draft);
  expect((await repository.loadState()).draft.rooms).toContainEqual(room);
  expect((await repository.loadState()).catalog.rooms).not.toContainEqual(room);
  const published = await repository.publishDraft();
  expect(published.catalog.photos.find(photo => photo.id === 'office-photo')?.room).toBe('office');
  const resumed = await repository.loadState();
  expect(resumed.catalog.rooms).toContainEqual(room);
  expect(resumed.session?.catalog.rooms).not.toContainEqual(room);
});

test('deleting all unused rooms survives save, publication, restart reads, and draft reset', async () => {
  const initial = await repository.loadState();
  const draft = cloneCatalog(initial.draft);
  draft.photos = [];
  for (const id of Object.keys(draft.galleries)) draft.galleries[id] = [];
  const empty = removeDraftOptions(draft, 'room', draft.rooms.map(room => room.id));
  await repository.saveDraft(empty);
  expect((await repository.loadState()).draft.rooms).toEqual([]);
  await repository.publishDraft();
  expect((await repository.loadState()).catalog.rooms).toEqual([]);
  expect((await repository.resetDraft()).rooms).toEqual([]);
});

test('publishing revisions cannot change an active session or release its photo references', async () => {
  const initial = await repository.loadState();
  const session = createSession(initial.catalog, 'bathroom', 'pinned');
  await repository.saveSession(session);
  const draft = cloneCatalog(initial.draft);
  const removedId = draft.galleries.bathroom[0];
  draft.photos = draft.photos.filter((photo) => photo.id !== removedId);
  for (const space of Object.keys(draft.galleries) as (keyof typeof draft.galleries)[]) draft.galleries[space] = draft.galleries[space].filter((id) => id !== removedId);
  draft.terms[0].labels.tk = 'Renamed for future clients';
  await repository.saveDraft(draft);
  const published = await repository.publishDraft();
  expect(published.catalog.id).not.toBe(initial.catalog.id);
  const resumed = await repository.loadState();
  expect(resumed.session?.catalog.terms[0].labels.tk).toBe(initial.catalog.terms[0].labels.tk);
  expect(resumed.session?.catalog.photos.some((photo) => photo.id === removedId)).toBe(true);
  expect((await repository.getReferencedCatalogs()).some((catalog) => catalog.id === initial.catalog.id)).toBe(true);
  await repository.clearSession();
  expect((await repository.getReferencedCatalogs()).some((catalog) => catalog.id === initial.catalog.id)).toBe(false);
});

test('invalid publication retains the current catalog and incomplete library entries stay in draft', async () => {
  const initial = await repository.loadState();
  const draft = cloneCatalog(initial.draft);
  const imported = { ...draft.photos[0], id: 'incomplete-import', exportFilename: undefined, sourceFilename: undefined, styleId: '', paletteIds: [], materialIds: [], detailIds: [] };
  draft.photos.push(imported);
  await repository.saveDraft(draft);
  const published = await repository.publishDraft();
  expect(published.draft.photos.some((photo) => photo.id === imported.id)).toBe(true);
  expect(published.catalog.photos.some((photo) => photo.id === imported.id)).toBe(false);
  draft.galleries.bathroom.push(imported.id);
  await repository.saveDraft(draft);
  await expect(repository.publishDraft()).rejects.toThrow('INVALID_CATALOG');
  expect((await repository.loadState()).catalog.id).toBe(published.catalog.id);
});

test('failure midway through publication rolls back the revision and pointer atomically', async () => {
  const initial = await repository.loadState();
  const draft = cloneCatalog(initial.draft);
  draft.terms[0].labels.tk = 'Draft value';
  await repository.saveDraft(draft);
  sqlite.__failPublication();
  await expect(repository.publishDraft()).rejects.toThrow('Simulated full disk');
  const state = await repository.loadState();
  expect(state.catalog).toEqual(initial.catalog);
  expect(state.draft.terms[0].labels.tk).toBe('Draft value');
  expect(sqlite.__database.prepare('SELECT COUNT(*) AS count FROM catalog_revisions').get()).toEqual({ count: 1 });
  await expect(repository.publishDraft()).resolves.toHaveProperty('catalog.version', 2);
});

test('serialized session clearing cannot be undone by an older queued write', async () => {
  const { catalog } = await repository.loadState();
  const session = createSession(catalog, 'bedroom', 'queued');
  await Promise.all([repository.saveSession(session), repository.clearSession()]);
  expect((await repository.loadState()).session).toBeNull();
});

test('corrupted sessions are preserved for recovery without replacing the published catalog', async () => {
  const { catalog } = await repository.loadState();
  await repository.saveSession(createSession(catalog, 'kitchen', 'corrupted'));
  sqlite.__database.prepare('UPDATE active_session SET payload = ?').run('{broken-json');
  const state = await repository.loadState();
  expect(state.notices).toEqual(['SESSION_DAMAGED']);
  expect(state.session).toBeNull();
  expect(state.catalog).toEqual(catalog);
  expect(sqlite.__database.prepare('SELECT payload FROM recovery_copies').get()).toEqual({ payload: '{broken-json' });
});

test('corrupted published content is never silently replaced with demo data', async () => {
  await repository.loadState();
  sqlite.__database.prepare('UPDATE catalog_revisions SET payload = ?').run('corrupt original');
  await expect(repository.loadState()).rejects.toThrow('CATALOG_DAMAGED');
  expect(sqlite.__database.prepare('SELECT payload FROM catalog_revisions').get()).toEqual({ payload: 'corrupt original' });
});

test('filenames persist through stale photo edits and reset never reuses deleted filename numbers', async () => {
  const initial = await repository.loadState();
  const stale = { ...initial.draft.photos[0], exportFilename: undefined, sourceFilename: undefined };
  const draft = cloneCatalog(initial.draft);
  draft.photos.push({ ...stale, id: 'new-photo', sourceFilename: 'bedroom.png' });
  await repository.saveDraft(draft);
  const afterImport = await repository.loadState();
  expect(afterImport.draft.photos.at(-1)).toMatchObject({ exportFilename: 'bedroom.jpg', sourceFilename: 'bedroom.png' });
  const edited = cloneCatalog(afterImport.draft);
  edited.photos[0] = { ...stale, styleId: '' };
  edited.photos.push({ ...stale, id: 'generated-photo' });
  await repository.saveDraft(edited);
  const beforeReset = await repository.loadState();
  const usedNumber = beforeReset.draft.nextPhotoNumber!;
  expect(beforeReset.draft.photos[0].exportFilename).toBe(initial.draft.photos[0].exportFilename);
  const reset = await repository.resetDraft();
  expect(reset.nextPhotoNumber).toBe(usedNumber);
  reset.photos.push({ ...stale, id: 'after-reset' });
  await repository.saveDraft(reset);
  expect((await repository.loadState()).draft.photos.at(-1)?.exportFilename).toBe(`photo-${String(usedNumber).padStart(4, '0')}.jpg`);
});

test('replacement saves reset draft content and filename allocation history', async () => {
  const initial = await repository.loadState();
  const source = initial.draft.photos[0];
  const replacement: Catalog = {
    ...cloneCatalog(initial.draft),
    nextPhotoNumber: 1,
    rooms: [cloneCatalog(initial.draft).rooms.find(room => room.id === source.room)!],
    terms: cloneCatalog(initial.draft).terms.filter(term => [source.styleId, ...source.paletteIds, ...source.materialIds, ...source.detailIds].includes(term.id)),
    photos: [{ ...source, id: 'replacement-photo', exportFilename: undefined, sourceFilename: undefined, sample: false }],
    galleries: { [source.room]: ['replacement-photo'] },
    sample: false,
  };
  await repository.saveDraft(replacement, { replace: true });
  const saved = (await repository.loadState()).draft;
  expect(saved.photos).toHaveLength(1);
  expect(saved.photos[0]).toMatchObject({ id: 'replacement-photo', exportFilename: 'photo-0001.jpg', sample: false });
  expect(saved.nextPhotoNumber).toBe(2);
  expect(saved.galleries).toEqual({ [source.room]: ['replacement-photo'] });
});

test('partial and empty Excel replacements survive SQLite reloads and preserve the active customer catalog', async () => {
  const { catalog, draft } = await repository.loadState();
  const session = createSession(catalog, 'kitchen', 'before-import');
  await repository.saveSession(session);
  const book = decodeWorkbook(encodeWorkbook(draft));
  book.photos = book.photos.slice(0, 2);
  book.photos[0].value.room = { ru: 'Кабинет', tk: '' };
  book.photos[1].value.room = { ru: '', tk: 'Başga otag' };
  book.photos[0].value.style = { ru: 'Модерн', tk: '' };
  book.photos[1].value.style = { ru: 'Модерн', tk: 'Döwrebap' };
  book.photos[0].value.detail = [{ ru: '', tk: 'Tekje' }];
  const partial = previewImport(draft, book, new Map());
  expect(partial.issues).toEqual([]);
  await repository.saveDraft(partial.catalog, { replace: true });
  const reopened = await repository.loadState();
  expect(reopened.notices).toEqual([]);
  expect(reopened.draft).toEqual(partial.catalog);
  expect(reopened.catalog).toEqual(catalog);
  expect(reopened.session).toEqual(session);
  expect(decodeWorkbook(encodeWorkbook(reopened.draft)).photos.map(row => row.value)).toEqual(book.photos.map(row => row.value));
  await expect(repository.publishDraft()).rejects.toThrow('INVALID_CATALOG');

  const empty = previewImport(reopened.draft, decodeWorkbook(encodeWorkbook()), new Map());
  await repository.saveDraft(empty.catalog, { replace: true });
  expect(await repository.loadState()).toMatchObject({
    notices: [], catalog, session, draft: { rooms: [], terms: [], photos: [], galleries: {}, nextPhotoNumber: 1, sample: false },
  });
});
