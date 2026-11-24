import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
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
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `test-term-${++mockUuid}` }));
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
  jest.clearAllMocks(); mockUnlocked = true; mockUuid = 0;
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
  expect(save).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Комната' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Кухня' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Готово' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить фото в черновик' }));
  expect(app.draft!.photos.at(-1)).toMatchObject({ id: 'new-photo', room: 'kitchen', styleId: '' });
  expect(app.catalog).toEqual(seedCatalog);
  expect(pickWorkbook).not.toHaveBeenCalled();
  expect(screen.getByText('Фото добавлено в черновик.')).toBeOnTheScreen();
  expect(discardPreparedPhotos).not.toHaveBeenCalledWith([staged]);
});

test('an inline style needs both labels and is selected for the unsaved photo after saving', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Стиль' }));
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
  expect(screen.getByRole('radio', { name: 'Новый стиль' })).toBeChecked();
  expect(screen.queryByLabelText('Русское название')).toBeNull();
});

test('searching in either language and dismissing a multi-select sheet retains every chosen tag', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Натуральный дуб' }));
  await fireEvent.changeText(screen.getByLabelText('Поиск: Материалы'), 'Daş');
  expect(screen.queryByRole('checkbox', { name: 'Натуральный дуб' })).toBeNull();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Камень' }));
  await fireEvent(screen.getByTestId('selection-sheet'), 'requestClose');
  expect(controller.fields.materialIds).toEqual(['oak', 'stone']);
  expect(screen.getByRole('button', { name: 'Материалы' })).toHaveAccessibilityValue({ text: 'Натуральный дуб, Камень' });
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  expect(screen.getByLabelText('Поиск: Материалы')).toHaveDisplayValue('');
  expect(screen.getByRole('checkbox', { name: 'Натуральный дуб' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Камень' })).toBeChecked();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Металлические акценты' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Готово' }));
  expect(screen.getByText('+1')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Сбросить выбор' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Закрыть' }));
  expect(controller.fields.materialIds).toEqual([]);
  expect(app.saveDraft).not.toHaveBeenCalled();
});

test('room changes and deselection remove the previous collection while preserving the photo and Whole House', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  expect(screen.queryByRole('tab')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Комната' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Ванная' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Готово' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать фотографию' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Ванная' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Весь дом' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Комната' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Кухня' }));
  expect(controller.spaces).toEqual(['whole_house']);
  expect(screen.getByRole('radio', { name: 'Кухня' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Кухня' }));
  expect(controller.fields.room).toBe('');
  await fireEvent(screen.getByTestId('selection-sheet'), 'requestClose');
  expect(screen.getByRole('button', { name: 'Комната' })).toHaveAccessibilityValue({ text: 'Не выбрано' });
  expect(controller.photo).toEqual(staged);
  expect(screen.getByRole('checkbox', { name: 'Весь дом' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Сохранить фото в черновик' })).toBeDisabled();
});

test('a failed term save stays in the sheet, and unfinished labels and choices survive a lock', async () => {
  const view = await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Палитра' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Природные оттенки' }));
  await fireEvent.press(screen.getByRole('button', { name: '＋ Добавить: Палитра' }));
  await fireEvent.changeText(screen.getByLabelText('Русское название'), 'Новая палитра');
  await fireEvent.changeText(screen.getByLabelText('Türkmençe ady'), 'Täze palitra');
  jest.mocked(app.saveDraft).mockRejectedValueOnce(new AppError('STORAGE_FULL'));
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить термин' }));
  expect(within(screen.getByTestId('selection-sheet')).getByRole('alert')).toBeOnTheScreen();
  expect(screen.getByLabelText('Русское название')).toHaveDisplayValue('Новая палитра');
  mockUnlocked = false;
  await view.rerender(<StaffWorkspaceProvider><Probe show={false} /></StaffWorkspaceProvider>);
  expect(screen.queryByTestId('selection-sheet')).toBeNull();
  mockUnlocked = true;
  await view.rerender(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Палитра' }));
  expect(screen.getByLabelText('Türkmençe ady')).toHaveDisplayValue('Täze palitra');
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить термин' }));
  expect(controller.fields.paletteIds).toEqual(['earthy', app.draft!.terms.at(-1)!.id]);
  expect(screen.getByRole('checkbox', { name: 'Новая палитра' })).toBeChecked();
});

test('clear confirmation discards only unfinished input and photo feedback is inside the draft card', async () => {
  const before = cloneCatalog(app.draft!);
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать фотографию' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить форму' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
  expect(controller.photo).toEqual(staged);
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить форму' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить' }));
  expect(controller.photo).toBeNull();
  expect(discardPreparedPhotos).toHaveBeenCalledWith([staged]);
  expect(app.draft).toEqual(before);
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать фотографию' }));
  await act(async () => { controller.setFields({ ...controller.fields, room: 'kitchen' }); });
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить фото в черновик' }));
  expect(within(screen.getByTestId('draft-entry-card')).getByText('Фото добавлено в черновик.')).toBeOnTheScreen();
});

test('busy saves disable form and sheet changes until the operation finishes', async () => {
  let finish!: () => void;
  jest.mocked(app.saveDraft).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Стиль' }));
  await fireEvent.press(screen.getByRole('button', { name: '＋ Добавить: Стиль' }));
  await fireEvent.changeText(screen.getByLabelText('Русское название'), 'Новый');
  await fireEvent.changeText(screen.getByLabelText('Türkmençe ady'), 'Täze');
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить термин' }));
  expect(screen.getByRole('button', { name: 'Закрыть' })).toBeDisabled();
  expect(controller.busy).toBe(true);
  await fireEvent(screen.getByTestId('selection-sheet'), 'requestClose');
  expect(screen.getByTestId('selection-sheet')).toBeOnTheScreen();
  await act(async () => { finish(); });
  expect(screen.getByRole('button', { name: 'Закрыть' })).toBeEnabled();
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

test('changing viewport and text size preserves the photo while adapting the form', async () => {
  app.language = 'tk';
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 1024, height: 768, scale: 1, fontScale: 1 });
  try {
    const view = await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
    await fireEvent.press(screen.getByRole('button', { name: 'Surat saýlamak' }));
    await act(async () => { controller.setFields({ ...controller.fields, room: 'kitchen' }); });
    expect(screen.getByTestId('draft-photo-editor')).toHaveStyle({ flexDirection: 'row' });
    for (const [width, height, fontScale] of [[768, 1024, 1], [390, 844, 1], [320, 568, 2], [1024, 768, 1.5]]) {
      dimensions.mockReturnValue({ width, height, scale: 1, fontScale });
      await view.rerender(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
      expect(screen.getByTestId('draft-photo-editor')).toHaveStyle({ flexDirection: 'column' });
      expect(screen.getByRole('button', { name: 'Suraty garalama ýazdyrmak' })).toBeEnabled();
      expect(controller.photo).toEqual(staged);
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Materiallar' }));
    await fireEvent.changeText(screen.getByLabelText('Gözleg: Materiallar'), 'Daş');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Daş' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Taýýar' }));
    expect(controller.fields.materialIds).toEqual(['stone']);
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

test('a room can be created without a photo, searched in either language, and deselected', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Комната' }));
  await fireEvent.press(screen.getByRole('button', { name: '＋ Добавить: Комната' }));
  expect(screen.getByRole('button', { name: 'Сохранить комнату' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Русское название'), 'Кабинет');
  expect(screen.getByRole('button', { name: 'Сохранить комнату' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Türkmençe ady'), 'Iş otagy');
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить комнату' }));
  const room = app.draft!.rooms.at(-1)!;
  expect(controller.fields.room).toBe(room.id);
  expect(app.draft!.galleries[room.id]).toEqual([]);
  expect(app.catalog!.rooms).toHaveLength(4);
  await fireEvent.changeText(screen.getByLabelText('Поиск: Комната'), 'iş otagy');
  expect(screen.getByRole('radio', { name: 'Кабинет' })).toBeChecked();
  expect(screen.queryByRole('radio', { name: 'Кухня' })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Кабинет' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Готово' }));
  expect(controller.fields.room).toBe('');
  expect(controller.photo).toBeNull();
});

test.each(['room', 'style'] as const)('bulk %s deletion preserves search selections and protects used options', async kind => {
  const unused = [
    { id: 'unused-1', labels: { ru: 'Первый', tk: 'Birinji' } },
    { id: 'unused-2', labels: { ru: 'Второй', tk: 'Ikinji' } },
  ];
  if (kind === 'room') {
    app.draft!.rooms.push(...unused);
    app.draft!.galleries['unused-1'] = []; app.draft!.galleries['unused-2'] = [];
  } else app.draft!.terms.push(...unused.map(option => ({ ...option, kind: 'style' as const })));
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  const label = kind === 'room' ? 'Комната' : 'Стиль';
  await fireEvent.press(screen.getByRole('button', { name: label }));
  expect(screen.queryByRole('button', { name: 'Сбросить выбор' })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Первый' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать для удаления' }));
  expect(screen.getByRole('checkbox', { name: kind === 'room' ? 'Кухня' : 'Минимализм' })).toBeDisabled();
  await fireEvent.press(within(screen.getByTestId('selection-sheet')).getByRole('checkbox', { name: 'Первый' }));
  await fireEvent.changeText(screen.getByLabelText(`Поиск: ${label}`), 'Ikinji');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Второй' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить (2)' }));
  expect(screen.getByText('Удалить выбранные записи (2)?')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Отмена' }));
  expect(app.saveDraft).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить (2)' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить (2)' }));
  expect((kind === 'room' ? app.draft!.rooms : app.draft!.terms).some(item => item.id.startsWith('unused-'))).toBe(false);
  expect(kind === 'room' ? controller.fields.room : controller.fields.styleId).toBe('');
  expect(app.draft!.photos).toEqual(seedCatalog.photos);
});

test('failed deletion keeps the selected room and draft intact for a retry', async () => {
  app.draft!.rooms.push({ id: 'unused', labels: { ru: 'Кабинет', tk: 'Iş otagy' } });
  app.draft!.galleries.unused = [];
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { controller.setFields({ ...controller.fields, room: 'unused' }); });
  jest.mocked(app.saveDraft).mockRejectedValueOnce(new AppError('STORAGE_FULL'));
  await fireEvent.press(screen.getByRole('button', { name: 'Комната' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать для удаления' }));
  await fireEvent.press(within(screen.getByTestId('selection-sheet')).getByRole('checkbox', { name: 'Кабинет' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить (1)' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить (1)' }));
  expect(controller.fields.room).toBe('unused');
  expect(app.draft!.rooms.some(room => room.id === 'unused')).toBe(true);
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить (1)' }));
  expect(controller.fields.room).toBe('');
});

test('style selection stays open, replaces the previous style, and toggles off', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Стиль' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Минимализм' }));
  await fireEvent.changeText(screen.getByLabelText('Поиск: Стиль'), 'Skandinaw');
  await fireEvent.press(screen.getByRole('radio', { name: 'Скандинавский' }));
  expect(controller.fields.styleId).toBe('scandinavian');
  await fireEvent.press(screen.getByRole('radio', { name: 'Скандинавский' }));
  expect(controller.fields.styleId).toBe('');
  expect(screen.getByTestId('selection-sheet')).toBeOnTheScreen();
});

test('empty rooms remain manageable and external draft changes clear unavailable form choices', async () => {
  const view = await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { controller.setFields({ ...controller.fields, room: 'kitchen', styleId: 'minimalist' }); controller.setSpaces(['kitchen', 'whole_house']); });
  app.draft = { ...app.draft!, rooms: [], terms: [], photos: [], galleries: { whole_house: [] } };
  await view.rerender(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  expect(controller.fields).toMatchObject({ room: '', styleId: '' });
  expect(controller.spaces).toEqual(['whole_house']);
  await fireEvent.press(screen.getByRole('button', { name: 'Комната' }));
  expect(screen.getByText('Пока нет вариантов. Добавьте новый.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '＋ Добавить: Комната' })).toBeEnabled();
});

test.each(['ru', 'tk'] as const)('photo errors in %s preserve the previous photo, and removal keeps metadata', async language => {
  app.language = language;
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { controller.setFields({ ...controller.fields, room: 'kitchen', styleId: 'minimalist' }); await controller.choosePhoto(); });
  jest.mocked(pickDraftPhoto).mockResolvedValueOnce(null);
  await act(async () => { await controller.choosePhoto(); });
  expect(controller.photo).toEqual(staged);
  jest.mocked(pickDraftPhoto).mockRejectedValueOnce(new AppError('DRAFT_PHOTO_TOO_LARGE'));
  await act(async () => { await controller.choosePhoto(); });
  expect(screen.getByText(language === 'ru' ? 'Размер выбранного фото не должен превышать 10 МБ.' : 'Saýlanan suratyň ölçegi 10 MB-dan geçmeli däl.')).toBeOnTheScreen();
  expect(controller.photo).toEqual(staged);
  expect(discardPreparedPhotos).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: language === 'ru' ? 'Удалить фото' : 'Suraty aýyrmak' }));
  expect(controller.photo).toBeNull();
  expect(controller.fields).toMatchObject({ room: 'kitchen', styleId: 'minimalist' });
  expect(discardPreparedPhotos).toHaveBeenCalledWith([staged]);
  await act(async () => { await controller.choosePhoto(); });
  expect(controller.photo).toEqual(staged);
});
