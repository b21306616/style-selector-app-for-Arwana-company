import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { seedCatalog } from '../src/data/catalog';
import { cloneCatalog } from '../src/domain/catalog';
import type { Catalog, Session } from '../src/domain/types';
import { AppProvider, useApp } from '../src/state/AppProvider';
import type { AppSnapshot } from '../src/storage/repository';

let mockSnapshot: AppSnapshot;
const mockSaveDraft = jest.fn(async (draft: Catalog) => { mockSnapshot.draft = draft; });
const mockSaveSession = jest.fn(async (session: Session) => { mockSnapshot.session = session; });
jest.mock('../src/storage/images', () => ({ cleanupImageFiles: jest.fn(async () => undefined) }));
jest.mock('../src/storage/repository', () => ({
  loadState: async () => mockSnapshot,
  getReferencedCatalogs: async () => [mockSnapshot.catalog, mockSnapshot.draft],
  saveDraft: (draft: Catalog) => mockSaveDraft(draft),
  saveSession: (session: Session) => mockSaveSession(session),
  clearSession: async () => { mockSnapshot.session = null; },
  saveLanguage: async () => undefined,
  publishDraft: async () => ({ catalog: mockSnapshot.draft, draft: mockSnapshot.draft }),
  resetDraft: async () => JSON.parse(JSON.stringify(mockSnapshot.catalog)),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(AppProvider, null, children);
}

beforeEach(() => {
  mockSnapshot = { catalog: cloneCatalog(seedCatalog), draft: cloneCatalog(seedCatalog), session: null, language: 'en', notices: [] };
  mockSaveDraft.mockClear();
  mockSaveSession.mockClear();
});

test('a delayed photo import merges into the latest draft without overwriting later vocabulary edits', async () => {
  const { result } = await renderHook(useApp, { wrapper: Wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  const capturedBeforeImport = result.current.draft!;
  const edited = cloneCatalog(capturedBeforeImport);
  edited.terms[0].labels.en = 'Later staff edit';
  await act(async () => { await result.current.saveDraft(edited); });
  const imported = { ...capturedBeforeImport.photos[0], id: 'delayed-import' };
  await act(async () => {
    await result.current.saveDraft((current) => ({ ...current, photos: [...current.photos, imported] }));
  });
  expect(result.current.draft?.terms[0].labels.en).toBe('Later staff edit');
  expect(result.current.draft?.photos.at(-1)?.id).toBe('delayed-import');
  expect(mockSnapshot.draft.terms[0].labels.en).toBe('Later staff edit');
});

test('a failed save does not mutate visible state, including mutating functional updaters', async () => {
  const { result } = await renderHook(useApp, { wrapper: Wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  const original = result.current.draft?.terms[0].labels.en;
  mockSaveDraft.mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => {
    await expect(result.current.saveDraft((current) => {
      current.terms[0].labels.en = 'Not saved';
      return current;
    })).rejects.toThrow('STORAGE_ERROR');
  });
  expect(result.current.draft?.terms[0].labels.en).toBe(original);
  expect(result.current.busy).toBe(false);
});

test('simultaneous rating callbacks cannot skip over the next photo', async () => {
  const { result } = await renderHook(useApp, { wrapper: Wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { await result.current.startSession('bathroom'); });
  mockSaveSession.mockClear();
  await act(async () => { await Promise.all([result.current.rate('like'), result.current.rate('dislike')]); });
  expect(mockSaveSession).toHaveBeenCalledTimes(1);
  expect(result.current.session?.ratings).toEqual([{ photoId: seedCatalog.galleries.bathroom[0], choice: 'like' }]);
});
