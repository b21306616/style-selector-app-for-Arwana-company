import * as SQLite from 'expo-sqlite';
import { seedCatalog } from '../data/catalog';
import { cloneCatalog, validateCatalog } from '../domain/catalog';
import { normalizePhotoFilenames } from '../domain/photo-filenames';
import { AppError } from '../domain/errors';
import { isValidSession } from '../domain/session';
import { type Catalog, type Language, type Session } from '../domain/types';
import { catalogSpaces, normalizeCatalog, validLabels, validRoomId } from '../domain/rooms';
import { assertCatalogImages } from './images';

const DATABASE_VERSION = 1;
let opening: Promise<SQLite.SQLiteDatabase> | undefined;
let queue: Promise<unknown> = Promise.resolve();

/** All DB work uses this lane, including reads, so transactions cannot interleave. */
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => undefined);
  return result;
}

async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    let openedDatabase: SQLite.SQLiteDatabase | undefined;
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync('arwana.db');
      openedDatabase = db;
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) > DATABASE_VERSION) throw new AppError('UNSUPPORTED_DATABASE');
      if ((version?.user_version ?? 0) < 1) {
        await db.withTransactionAsync(async () => {
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS catalog_revisions (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS catalog_draft (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS active_session (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), catalog_id TEXT NOT NULL REFERENCES catalog_revisions(id), payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS recovery_copies (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL, catalog_id TEXT, created_at TEXT NOT NULL);
            PRAGMA user_version = 1;
          `);
        });
      }
      const current = await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', 'current_catalog');
      if (!current) {
        // Only a genuinely new database is seeded. Never replace unreadable user data.
        const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM catalog_revisions');
        if ((count?.count ?? 0) !== 0) throw new AppError('CATALOG_DAMAGED');
        await db.withTransactionAsync(async () => {
          await db.runAsync('INSERT INTO catalog_revisions (id, payload) VALUES (?, ?)', seedCatalog.id, JSON.stringify(seedCatalog));
          await db.runAsync('INSERT INTO metadata (key, value) VALUES (?, ?)', 'current_catalog', seedCatalog.id);
          await db.runAsync('INSERT INTO metadata (key, value) VALUES (?, ?)', 'language', 'ru');
          await db.runAsync('INSERT INTO catalog_draft (singleton, payload) VALUES (1, ?)', JSON.stringify(seedCatalog));
        });
      }
      return db;
    })().catch(async (error: unknown) => {
      if (openedDatabase) {
        try { await openedDatabase.closeAsync(); } catch { /* Keep the original initialization error. */ }
      }
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

interface ParsedCatalog { catalog: Catalog; migratedPayload?: string }

function parsePublishedRecord(payload: string | undefined): ParsedCatalog {
  try {
    const raw = JSON.parse(payload ?? 'null');
    const catalog = normalizeCatalog(raw);
    if (validateCatalog(catalog).length) throw new Error('Invalid catalog');
    const value = catalog as Catalog;
    if (typeof value.id !== 'string' || !Number.isInteger(value.version) || typeof value.createdAt !== 'string') throw new Error('Invalid header');
    const normalized = JSON.stringify(value);
    return { catalog: value, ...(JSON.stringify(raw) === normalized ? {} : { migratedPayload: normalized }) };
  } catch {
    throw new AppError('CATALOG_DAMAGED');
  }
}

function parsePublished(payload: string | undefined): Catalog {
  return parsePublishedRecord(payload).catalog;
}

function parseDraftRecord(payload: string | undefined): ParsedCatalog {
  const raw = JSON.parse(payload ?? 'null');
  const value = normalizeCatalog(raw) as Catalog;
  // Incomplete editorial metadata is allowed in drafts. Malformed structures are not.
  if (!value || !Array.isArray(value.rooms) || value.rooms.some(room => !room || !validRoomId(room.id) || !validLabels(room.labels)) || new Set(value.rooms.map(room => room.id)).size !== value.rooms.length || !Array.isArray(value.photos) || !Array.isArray(value.terms) ||
    !value.galleries || catalogSpaces(value).some((space) => !Array.isArray(value.galleries[space])) ||
    value.terms.some((term) => !term || typeof term.id !== 'string' || !term.labels || typeof term.labels.tk !== 'string' || typeof term.labels.ru !== 'string') ||
    value.photos.some((photo) => !photo || typeof photo.id !== 'string' || !photo.image || !Array.isArray(photo.paletteIds) || !Array.isArray(photo.materialIds) || !Array.isArray(photo.detailIds))) {
    throw new AppError('DRAFT_DAMAGED');
  }
  const normalized = JSON.stringify(value);
  return { catalog: value, ...(JSON.stringify(raw) === normalized ? {} : { migratedPayload: normalized }) };
}

function parseDraft(payload: string | undefined): Catalog {
  return parseDraftRecord(payload).catalog;
}

export interface AppSnapshot {
  language: Language;
  catalog: Catalog;
  draft: Catalog;
  session: Session | null;
  notices: string[];
}

async function readState(db: SQLite.SQLiteDatabase): Promise<AppSnapshot> {
  const currentRow = await db.getFirstAsync<{ id: string; payload: string }>('SELECT id, payload FROM catalog_revisions WHERE id = (SELECT value FROM metadata WHERE key = ?)', 'current_catalog');
  const parsedCatalog = parsePublishedRecord(currentRow?.payload);
  const catalog = parsedCatalog.catalog;
  const revisionMigrations = new Map<string, string>();
  if (currentRow && parsedCatalog.migratedPayload) revisionMigrations.set(currentRow.id, parsedCatalog.migratedPayload);
  const notices: string[] = [];
  const draftRow = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM catalog_draft WHERE singleton = 1');
  let draft: Catalog;
  let draftMigration: string | undefined;
  let damagedDraft: string | undefined;
  try {
    const parsedDraft = parseDraftRecord(draftRow?.payload);
    draft = parsedDraft.catalog;
    draftMigration = parsedDraft.migratedPayload;
  } catch {
    draft = cloneCatalog(catalog);
    damagedDraft = draftRow?.payload;
    draftMigration = JSON.stringify(draft);
    notices.push('DRAFT_DAMAGED');
  }

  let session: Session | null = null;
  const sessionRow = await db.getFirstAsync<{ payload: string; catalog_id: string }>('SELECT payload, catalog_id FROM active_session WHERE singleton = 1');
  let damagedSession: { payload: string; catalogId: string } | undefined;
  if (sessionRow) {
    try {
      const sessionCatalogRow = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM catalog_revisions WHERE id = ?', sessionRow.catalog_id);
      const parsedSessionCatalog = sessionRow.catalog_id === currentRow?.id ? parsedCatalog : parsePublishedRecord(sessionCatalogRow?.payload);
      if (parsedSessionCatalog.migratedPayload) revisionMigrations.set(sessionRow.catalog_id, parsedSessionCatalog.migratedPayload);
      const sessionCatalog = parsedSessionCatalog.catalog;
      const saved: unknown = JSON.parse(sessionRow.payload);
      if (!isValidSession(saved, sessionCatalog)) throw new Error('Invalid session');
      session = { ...saved, catalog: sessionCatalog };
    } catch {
      damagedSession = { payload: sessionRow.payload, catalogId: sessionRow.catalog_id };
      notices.push('SESSION_DAMAGED');
    }
  }
  if (revisionMigrations.size || draftMigration || damagedDraft !== undefined || damagedSession) {
    await db.withTransactionAsync(async () => {
      for (const [id, payload] of revisionMigrations) await db.runAsync('UPDATE catalog_revisions SET payload = ? WHERE id = ?', payload, id);
      if (damagedDraft !== undefined) await db.runAsync('INSERT INTO recovery_copies (kind, payload, created_at) VALUES (?, ?, ?)', 'draft', damagedDraft, new Date().toISOString());
      if (draftMigration) await db.runAsync('INSERT OR REPLACE INTO catalog_draft (singleton, payload) VALUES (1, ?)', draftMigration);
      if (damagedSession) {
        await db.runAsync('INSERT INTO recovery_copies (kind, payload, catalog_id, created_at) VALUES (?, ?, ?, ?)', 'session', damagedSession.payload, damagedSession.catalogId, new Date().toISOString());
        await db.runAsync('DELETE FROM active_session WHERE singleton = 1');
      }
    });
  }
  const languageRow = await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', 'language');
  return { language: languageRow?.value === 'tk' ? 'tk' : 'ru', catalog, draft, session, notices };
}

export function loadState(): Promise<AppSnapshot> {
  return serialized(async () => readState(await database()));
}

export function saveLanguage(language: Language): Promise<void> {
  return serialized(async () => {
    const db = await database();
    await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', 'language', language);
  });
}

export function saveSession(session: Session): Promise<void> {
  return serialized(async () => {
    const db = await database();
    const { catalog, ...payload } = session;
    if (!isValidSession(payload, catalog)) throw new AppError('STALE_RATING');
    await db.runAsync('INSERT OR REPLACE INTO active_session (singleton, catalog_id, payload) VALUES (1, ?, ?)', catalog.id, JSON.stringify(payload));
  });
}

async function pruneRevisions(db: SQLite.SQLiteDatabase): Promise<void> {
  // Recovery copies may refer to any old image metadata. Keep their revisions intact.
  const recoveries = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM recovery_copies');
  if ((recoveries?.count ?? 0) > 0) return;
  await db.runAsync(`DELETE FROM catalog_revisions
    WHERE id NOT IN (SELECT value FROM metadata WHERE key = 'current_catalog')
      AND id NOT IN (SELECT catalog_id FROM active_session)`);
}

export function clearSession(): Promise<void> {
  return serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM active_session WHERE singleton = 1');
      await pruneRevisions(db);
    });
  });
}

export function saveDraft(draft: Catalog): Promise<void> {
  return serialized(async () => {
    const db = await database();
    // Draft content can be incomplete; publication performs the strict validation.
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM catalog_draft WHERE singleton = 1');
    const previous = row ? parseDraft(row.payload) : undefined;
    const saved = normalizePhotoFilenames(draft, previous);
    await db.runAsync('INSERT OR REPLACE INTO catalog_draft (singleton, payload) VALUES (1, ?)', JSON.stringify(saved));
  });
}

export function resetDraft(): Promise<Catalog> {
  return serialized(async () => {
    const db = await database();
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM catalog_revisions WHERE id = (SELECT value FROM metadata WHERE key = ?)', 'current_catalog');
    const previous = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM catalog_draft WHERE singleton = 1');
    const catalog = normalizePhotoFilenames(parsePublished(row?.payload), previous ? parseDraft(previous.payload) : undefined);
    await db.runAsync('INSERT OR REPLACE INTO catalog_draft (singleton, payload) VALUES (1, ?)', JSON.stringify(catalog));
    return cloneCatalog(catalog);
  });
}

export function publishDraft(): Promise<{ catalog: Catalog; draft: Catalog }> {
  return serialized(async () => {
    const db = await database();
    const state = await readState(db);
    const issues = validateCatalog(state.draft);
    if (issues.length) throw new AppError('INVALID_CATALOG', issues.map((issue) => `${issue.subject}: ${issue.labels.tk}`).join('\n'));
    const selected = new Set(catalogSpaces(state.draft).flatMap((space) => state.draft.galleries[space]));
    const version = state.catalog.version + 1;
    const published: Catalog = {
      ...cloneCatalog(state.draft), id: `catalog-${version}-${Date.now()}`, version, createdAt: new Date().toISOString(),
      photos: state.draft.photos.filter((photo) => selected.has(photo.id)),
      sample: state.draft.photos.some((photo) => selected.has(photo.id) && photo.sample),
    };
    await assertCatalogImages(published);
    const draft: Catalog = { ...cloneCatalog(state.draft), id: published.id, version, createdAt: published.createdAt, sample: published.sample };
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO catalog_revisions (id, payload) VALUES (?, ?)', published.id, JSON.stringify(published));
      await db.runAsync('UPDATE metadata SET value = ? WHERE key = ?', published.id, 'current_catalog');
      await db.runAsync('UPDATE catalog_draft SET payload = ? WHERE singleton = 1', JSON.stringify(draft));
      await pruneRevisions(db);
    });
    return { catalog: published, draft };
  });
}

/** Includes retained revisions and recovery drafts, so file cleanup cannot invalidate them. */
export function getReferencedCatalogs(): Promise<Catalog[]> {
  return serialized(async () => {
    const db = await database();
    const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM catalog_revisions UNION ALL SELECT payload FROM catalog_draft UNION ALL SELECT payload FROM recovery_copies WHERE kind = ?', 'draft');
    const catalogs: Catalog[] = [];
    for (const row of rows) {
      try {
        const value = JSON.parse(row.payload) as Catalog;
        if (Array.isArray(value.photos)) catalogs.push(value);
        else throw new Error('Invalid photo references');
      } catch {
        // Unknown references must stop cleanup instead of risking permanent data loss.
        throw new AppError('CATALOG_DAMAGED');
      }
    }
    return catalogs;
  });
}
