/// <reference types="node" />
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { addDraftRoom, cloneCatalog, removeDraftOptions } from '../src/domain/catalog';
import { createSession, rateSession } from '../src/domain/session';

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

test('custom rooms persist and publish while existing sessions retain their original labels and rooms', async () => {
  const initial = await repository.loadState();
  await repository.saveSession(createSession(initial.catalog, 'kitchen', 'original'));
  const room = { id: 'office', labels: { ru: 'Кабинет', tk: 'Iş otagy' } };
  const draft = addDraftRoom(initial.draft, room);
  draft.photos.push({ ...draft.photos[0], id: 'office-photo', room: room.id });
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
  const imported = { ...draft.photos[0], id: 'incomplete-import', styleId: '', paletteIds: [], materialIds: [], detailIds: [] };
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
