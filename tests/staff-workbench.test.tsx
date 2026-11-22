import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLayoutEffect } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { DashboardWorkbench } from '../src/features/staff/DashboardWorkbench';
import { StaffWorkspaceProvider, useStaffWorkspace } from '../src/features/staff/workspace-context';
import { useApp, type AppContextValue } from '../src/state/AppProvider';
import { cloneCatalog } from '../src/domain/catalog';
import { seedCatalog } from '../src/data/catalog';
import { AppError } from '../src/domain/errors';
import { pickDraftPhoto, discardPreparedPhotos, assertCatalogImages } from '../src/storage/images';
import { createExport, pickImportImages, pickWorkbook, shareExport } from '../src/storage/catalog-files';
import { decodeWorkbook, encodeWorkbook } from '../src/storage/workbook';
import type { Photo } from '../src/domain/types';

let mockUnlocked = true;
jest.mock('../src/features/staff/auth-context', () => ({ useStaffAuth: () => ({ unlocked: mockUnlocked, isUnlocked: () => mockUnlocked }) }));
jest.mock('../src/state/AppProvider', () => ({ useApp: jest.fn() }));
jest.mock('../src/storage/images', () => ({ pickDraftPhoto: jest.fn(), discardPreparedPhotos: jest.fn(), assertCatalogImages: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('../src/storage/catalog-files', () => ({ createExport: jest.fn(), discardExport: jest.fn(), pickImportImages: jest.fn(), pickWorkbook: jest.fn(), shareExport: jest.fn() }));
jest.mock('../src/components/PhotoImage', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { PhotoImage: () => React.createElement(View) };
});

const asyncMock = () => jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
let app: AppContextValue;
let controller: ReturnType<typeof useStaffWorkspace>;
function Probe({ show = true }: { show?: boolean }) {
  const value = useStaffWorkspace();
  useLayoutEffect(() => { controller = value; }, [value]);
  return show ? <DashboardWorkbench /> : <Text>Locked</Text>;
}
const staged: Photo = { ...seedCatalog.photos[0], id: 'new-photo', image: { kind: 'local', file: 'prepared.jpg', thumbnail: 'prepared-thumb.jpg' } };
beforeEach(() => {
  jest.clearAllMocks(); mockUnlocked = true;
  app = {
    ready: true, error: null, notices: [], language: 'ru', catalog: cloneCatalog(seedCatalog), draft: cloneCatalog(seedCatalog), session: null, busy: false,
    setLanguage: asyncMock(), startSession: asyncMock(), rate: asyncMock(), undo: asyncMock(), clearSession: asyncMock(), publishDraft: asyncMock(), resetDraft: asyncMock(), refresh: asyncMock(), dismissNotices: jest.fn(),
    saveDraft: jest.fn<AppContextValue['saveDraft']>(async update => { app.draft = typeof update === 'function' ? update(app.draft!) : update; }),
  };
  jest.mocked(useApp).mockImplementation(() => app);
  jest.mocked(pickDraftPhoto).mockResolvedValue(staged);
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'catalog.xlsx', workbook: decodeWorkbook(encodeWorkbook(seedCatalog)) });
  jest.mocked(assertCatalogImages).mockResolvedValue(undefined);
});

test('staff can create a photo directly on the dashboard without opening Excel import', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  const save = screen.getByRole('button', { name: 'Сохранить фото в черновик' });
  expect(save).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать фотографию' }));
  expect(save).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Кухня' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить фото в черновик' }));
  expect(app.draft!.photos.at(-1)).toMatchObject({ id: 'new-photo', room: 'kitchen', styleId: '' });
  expect(app.catalog).toEqual(seedCatalog);
  expect(pickWorkbook).not.toHaveBeenCalled();
  expect(screen.getByText('Фото добавлено в черновик.')).toBeOnTheScreen();
  expect(discardPreparedPhotos).not.toHaveBeenCalledWith([staged]);
});

test('an inline style needs both labels and is selected for the unsaved photo after saving', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: '＋ Добавить: Стиль' }));
  expect(screen.getByRole('button', { name: 'Сохранить термин' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Русское название'), 'Новый стиль');
  expect(screen.getByRole('button', { name: 'Сохранить термин' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Türkmençe ady'), 'Täze stil');
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить термин' }));
  const term = app.draft!.terms.at(-1)!;
  expect(term.labels).toEqual({ ru: 'Новый стиль', tk: 'Täze stil' });
  expect(controller.fields.styleId).toBe(term.id);
  expect(controller.photo).toBeNull();
});

test('photo form and picker results survive a lock while applying changes still requires unlock', async () => {
  let finish!: (photo: Photo) => void;
  jest.mocked(pickDraftPhoto).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { controller.setFields({ ...controller.fields, room: 'kitchen' }); });
  await act(async () => { void controller.choosePhoto(); });
  mockUnlocked = false;
  await view.rerender(<StaffWorkspaceProvider><Probe show={false} /></StaffWorkspaceProvider>);
  await act(async () => { finish(staged); });
  expect(controller.photo).toEqual(staged);
  expect(controller.fields.room).toBe('kitchen');
  await act(async () => { await controller.savePhoto(); });
  expect(app.saveDraft).not.toHaveBeenCalled();
  expect(controller.error).toMatchObject({ code: 'STAFF_LOCKED' });
  mockUnlocked = true;
  await view.rerender(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить фото в черновик' }));
  expect(app.draft!.photos.at(-1)!.room).toBe('kitchen');
});

test('replacement requires confirmation and refuses a draft changed after the review', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Импорт из Excel' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Заменить черновик' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить импорт в черновик' }));
  expect(app.saveDraft).not.toHaveBeenCalled();
  expect(screen.getByText('Заменить весь черновик?')).toBeOnTheScreen();
  app.draft!.terms[0].labels.ru = 'Changed during review';
  await act(async () => { await controller.applyImport(); });
  expect(app.draft!.terms[0].labels.ru).toBe('Changed during review');
  expect(controller.error).toMatchObject({ code: 'STALE_DRAFT' });
  expect(controller.confirmReplace).toBe(false);
  expect(controller.book).not.toBeNull();
});

test('a failed import save releases its uncommitted images and preserves the old catalog', async () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = [{ row: 2, value: { ...workbook.photos[0].value, id: 'imported-photo', filename: 'new.jpg' } }];
  workbook.galleries = [];
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'new.xlsx', workbook });
  jest.mocked(pickImportImages).mockResolvedValue(new Map([['new.jpg', staged]]));
  const original = cloneCatalog(app.draft!);
  app.saveDraft = jest.fn<AppContextValue['saveDraft']>().mockRejectedValue(new AppError('STORAGE_FULL'));
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { await controller.chooseWorkbook(); });
  await act(async () => { await controller.chooseImages(); });
  await act(async () => { await controller.applyImport(); });
  expect(controller.images.size).toBe(0);
  expect(controller.error).toMatchObject({ code: 'STORAGE_FULL' });
  expect(app.draft).toEqual(original);
  expect(discardPreparedPhotos).toHaveBeenCalled();
});

test('export shares workbook and photo ZIP from one snapshot and can share them again', async () => {
  jest.mocked(createExport).mockResolvedValue({ workbook: '/cache/catalog.xlsx', photos: '/cache/photos.zip', directory: '/cache/export' });
  jest.mocked(shareExport).mockResolvedValue(undefined);
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Экспорт в Excel' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить / отправить Excel' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить / отправить ZIP с фото' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить / отправить Excel' }));
  expect(createExport).toHaveBeenCalledTimes(1);
  expect(shareExport).toHaveBeenNthCalledWith(1, '/cache/catalog.xlsx', false);
  expect(shareExport).toHaveBeenNthCalledWith(2, '/cache/photos.zip', true);
  expect(shareExport).toHaveBeenNthCalledWith(3, '/cache/catalog.xlsx', false);
});

test('Turkmen direct-entry and Excel controls remain present on a narrow screen', async () => {
  app.language = 'tk';
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, scale: 1, fontScale: 2 } satisfies ReturnType<typeof useWindowDimensions>);
  try {
    await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
    expect(screen.getByRole('button', { name: 'Excel-den import' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Excel-e eksport' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Suraty garalama ýazdyrmak' })).toBeOnTheScreen();
  } finally { dimensions.mockRestore(); }
});

test('unmounting during a picker cleans up its eventual result without saving it', async () => {
  let finish!: (photo: Photo) => void;
  jest.mocked(pickDraftPhoto).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { void controller.choosePhoto(); });
  await view.unmount();
  await act(async () => { finish(staged); });
  expect(discardPreparedPhotos).toHaveBeenCalledWith([staged]);
  expect(app.saveDraft).not.toHaveBeenCalled();
});
