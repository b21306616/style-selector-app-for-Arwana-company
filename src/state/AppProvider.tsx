import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cloneCatalog } from '../domain/catalog';
import { normalizePhotoFilenames } from '../domain/photo-filenames';
import { AppError, errorCode } from '../domain/errors';
import { createSession, rateSession, undoSession } from '../domain/session';
import type { Catalog, Choice, Language, Session, Space } from '../domain/types';
import { cleanupImageFiles } from '../storage/images';
import * as repository from '../storage/repository';

interface AppState {
  ready: boolean;
  error: string | null;
  notices: string[];
  language: Language;
  catalog: Catalog | null;
  draft: Catalog | null;
  session: Session | null;
}

export interface AppContextValue extends AppState {
  busy: boolean;
  setLanguage(language: Language): Promise<void>;
  startSession(space: Space): Promise<void>;
  rate(choice: Choice): Promise<void>;
  undo(): Promise<void>;
  clearSession(): Promise<void>;
  saveDraft(catalog: Catalog | ((current: Catalog) => Catalog), options?: { replace?: boolean }): Promise<void>;
  publishDraft(): Promise<void>;
  resetDraft(): Promise<void>;
  refresh(): Promise<void>;
  dismissNotices(): void;
}

const initialState: AppState = { ready: false, error: null, notices: [], language: 'ru', catalog: null, draft: null, session: null };
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  const apply = useCallback((update: Partial<AppState>) => {
    const next = { ...stateRef.current, ...update };
    stateRef.current = next;
    if (mounted.current) setState(next);
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const loaded = await repository.loadState();
      // This only runs before presenting the initial UI, never alongside staff imports.
      if (!stateRef.current.ready) {
        try {
          const referenced = await repository.getReferencedCatalogs();
          await cleanupImageFiles(referenced);
        } catch {
          // Leave files intact if their references cannot be read reliably.
        }
      }
      apply({ ...loaded, ready: true, error: null });
    } catch (error) {
      apply({ ready: false, error: errorCode(error) });
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [apply]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  /** The ref closes the window between touch events and the next React render. */
  const mutate = useCallback(async (operation: () => Promise<void>, ignoreIfBusy = false) => {
    if (busyRef.current) {
      if (ignoreIfBusy) return;
      throw new AppError('BUSY');
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      throw error instanceof AppError ? error : new AppError(errorCode(error));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  const setLanguage = useCallback((language: Language) => mutate(async () => {
    await repository.saveLanguage(language);
    apply({ language });
  }), [apply, mutate]);

  const startSession = useCallback((space: Space) => mutate(async () => {
    const catalog = stateRef.current.catalog;
    if (!catalog) throw new AppError('CATALOG_DAMAGED');
    const next = createSession(catalog, space, `session-${Date.now()}`);
    await repository.saveSession(next);
    apply({ session: next });
  }), [apply, mutate]);

  const rate = useCallback((choice: Choice) => {
    const captured = stateRef.current.session;
    const expectedId = captured?.catalog.galleries[captured.space][captured.ratings.length];
    return mutate(async () => {
      const session = stateRef.current.session;
      if (!session || !captured || session.id !== captured.id) throw new AppError('NO_SESSION');
      const next = rateSession(session, choice, expectedId ?? '');
      await repository.saveSession(next);
      apply({ session: next });
    }, true);
  }, [apply, mutate]);

  const undo = useCallback(() => mutate(async () => {
    const session = stateRef.current.session;
    if (!session) throw new AppError('NO_SESSION');
    const next = undoSession(session);
    if (next !== session) {
      await repository.saveSession(next);
      apply({ session: next });
    }
  }, true), [apply, mutate]);

  const clearSession = useCallback(() => mutate(async () => {
    await repository.clearSession();
    apply({ session: null });
  }), [apply, mutate]);

  const saveDraft = useCallback((catalog: Catalog | ((current: Catalog) => Catalog), options?: { replace?: boolean }) => mutate(async () => {
    const current = stateRef.current.draft;
    if (!current) throw new AppError('CATALOG_DAMAGED');
    // The updater receives the latest snapshot, so a reviewed replacement cannot
    // overwrite edits made while the import was being prepared.
    // The updater receives a copy so it cannot mutate visible state before persistence succeeds.
    const saved = normalizePhotoFilenames(
      cloneCatalog(typeof catalog === 'function' ? catalog(cloneCatalog(current)) : catalog),
      options?.replace ? undefined : current,
    );
    await repository.saveDraft(saved, options);
    apply({ draft: saved });
  }), [apply, mutate]);

  const publishDraft = useCallback(() => mutate(async () => {
    const published = await repository.publishDraft();
    apply(published);
  }), [apply, mutate]);

  const resetDraft = useCallback(() => mutate(async () => {
    const draft = await repository.resetDraft();
    apply({ draft });
  }), [apply, mutate]);

  const dismissNotices = useCallback(() => apply({ notices: [] }), [apply]);
  const value = useMemo<AppContextValue>(() => ({
    ...state, busy, setLanguage, startSession, rate, undo, clearSession, saveDraft, publishDraft, resetDraft, refresh, dismissNotices,
  }), [state, busy, setLanguage, startSession, rate, undo, clearSession, saveDraft, publishDraft, resetDraft, refresh, dismissNotices]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}
