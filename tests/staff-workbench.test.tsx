import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useLayoutEffect } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
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
  expect(screen.getByRole('button', { name: 'Добавьте фото интерьера' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Выбрать фотографию' })).toBeNull();
  await fireEvent.press(screen.getByTestId('draft-photo-picker'));
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

test('draft entry omits collection controls and helper copy', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.queryByText('Подборки')).toBeNull();
  expect(screen.queryByText('Необязательно. Фото можно добавить в подборку позже.')).toBeNull();
  expect(screen.queryByText('Выберите комнату, чтобы сохранить фото.')).toBeNull();
  expect(screen.queryByText('Теги можно заполнить позже. Для публикации нужны стиль и хотя бы один тег каждой категории.')).toBeNull();
  expect(screen.getByTestId('draft-photo-section')).toHaveStyle({ borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 20 });
  expect(screen.getByTestId('draft-characteristics-section')).toHaveStyle({ borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20 });
  expect(screen.getByTestId('draft-entry-footer')).not.toHaveStyle({ borderTopWidth: StyleSheet.hairlineWidth });
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
  await fireEvent.press(screen.getByTestId('draft-photo-picker'));
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить форму' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
  expect(controller.photo).toEqual(staged);
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить форму' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить' }));
  expect(controller.photo).toBeNull();
  expect(discardPreparedPhotos).toHaveBeenCalledWith([staged]);
  expect(app.draft).toEqual(before);
  await fireEvent.press(screen.getByTestId('draft-photo-picker'));
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

test('Excel import has no merge control and saves through the replacement path', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Импорт из Excel' }));
  expect(screen.queryByRole('button', { name: 'Объединить' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить импорт в черновик' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Заменить черновик' }));
  expect(app.saveDraft).toHaveBeenLastCalledWith(expect.any(Function), { replace: true });
});

test('a failed import save releases its uncommitted images and preserves the old catalog', async () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = [{ ...workbook.photos[0], value: { ...workbook.photos[0].value, filename: 'new.jpg' } }];
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
  expect(screen.getByText(/сохраните книгу Excel и ZIP с фотографиями/)).toBeOnTheScreen();
});

test('a ready review shows the workbook and photo count before confirming draft replacement', async () => {
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  expect(screen.getByText(/Russian и Turkmen.*Пустая ячейка очищает поле/)).toBeOnTheScreen();
  expect(screen.getByText('Image filename · Room · Style · Palette · Material · Detail')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Импорт из Excel' }));
  const card = within(screen.getByTestId('import-review'));
  expect(card.getByText('catalog.xlsx')).toBeOnTheScreen();
  expect(card.getByText('В черновике будет 48 фото.')).toBeOnTheScreen();
  expect(card.queryByText(/Записей сейчас|После импорта|Подготовлено фотографий|Ванная/)).toBeNull();
  await fireEvent.press(card.getByRole('button', { name: 'Сохранить импорт в черновик' }));
  expect(screen.getByText('Заменить весь черновик?')).toBeOnTheScreen();
  expect(app.saveDraft).not.toHaveBeenCalled();
});

test.each([
  ['ru', 'Импорт из Excel', 'Сохранить импорт в черновик', 'Очистить весь черновик?', 'Вернуться к проверке', 'Очистить черновик'],
  ['tk', 'Excel-den import', 'Importy garalama ýazdyrmak', 'Garalamany doly arassalamalymy?', 'Syna dolanmak', 'Garalamany arassalamak'],
] as const)('a template clears the draft only after explicit confirmation in %s', async (language, pick, save, title, cancel, confirm) => {
  app.language = language;
  const before = cloneCatalog(app.draft!);
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'template.xlsx', workbook: decodeWorkbook(encodeWorkbook()) });
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: pick }));
  expect(screen.getByText(language === 'ru' ? 'В книге нет фото. Импорт очистит весь черновик.' : 'Kitapda surat ýok. Import tutuş garalamany arassalar.')).toBeOnTheScreen();
  expect(within(screen.getByTestId('import-review')).queryByRole('button', { name: /ZIP/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: save }));
  expect(screen.getByText(title)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: cancel }));
  expect(app.draft).toEqual(before);
  expect(app.saveDraft).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: save }));
  await fireEvent.press(screen.getByRole('button', { name: confirm }));
  expect(app.draft).toMatchObject({ photos: [], rooms: [], terms: [] });
  expect(app.draft!.galleries).toEqual({});
  expect(app.catalog).toEqual(before);
});

test('a filename-only photo can be confirmed and saved without any previous room or tags', async () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  const first = workbook.photos[0];
  workbook.photos = [{ ...first, value: { filename: first.value.filename, room: { ru: '', tk: '' }, style: { ru: '', tk: '' }, palette: [], material: [], detail: [] } }];
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'partial.xlsx', workbook });
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Импорт из Excel' }));
  expect(screen.getByText('Перед публикацией заполните недостающие данные.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить импорт в черновик' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Заменить черновик' }));
  expect(app.draft).toMatchObject({ photos: [{ room: '', styleId: '', paletteIds: [], materialIds: [], detailIds: [] }], rooms: [], terms: [] });
  expect(app.draft!.galleries).toEqual({});
});

test('unsupported workbook guidance directs staff to download the new template without opening import review', async () => {
  jest.mocked(pickWorkbook).mockRejectedValue(new AppError('INVALID_WORKBOOK'));
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Импорт из Excel' }));
  expect(screen.getByText(/Старый формат не поддерживается — нажмите «Скачать шаблон»/)).toBeOnTheScreen();
  expect(screen.queryByText('Проверка импорта')).toBeNull();
  expect(app.saveDraft).not.toHaveBeenCalled();
});

test('blocked import review does not display misleading pre-publish tag warnings alongside blocking issues', async () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = [
    { ...workbook.photos[0], value: { ...workbook.photos[0].value, room: { ru: '', tk: '' } } },
    { ...workbook.photos[1], value: { ...workbook.photos[1].value, filename: 'needed.jpg' } },
  ];
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'broken.xlsx', workbook });
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { await controller.chooseWorkbook(); });
  expect(controller.review!.issues.length).toBeGreaterThan(0);
  expect(controller.review!.warnings).toBeGreaterThan(0);
  expect(screen.queryByText('Перед публикацией заполните недостающие данные.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Сохранить импорт в черновик' })).toBeDisabled();
  expect(app.saveDraft).not.toHaveBeenCalled();
});

test('Turkmen export copy explains which vocabulary transfers with photos', async () => {
  app.language = 'tk';
  jest.mocked(createExport).mockResolvedValue({ workbook: '/cache/catalog.xlsx', photos: '/cache/photos.zip', directory: '/cache/export' });
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Excel-e eksport' }));
  expect(screen.getByText(/suratlarda ulanylýan otaglar we tegler/)).toBeOnTheScreen();
});

test('selecting a missing image enables import and the workbook creates its named room', async () => {
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = [{ ...workbook.photos[0], value: { ...workbook.photos[0].value, filename: 'office.jpg', room: { ru: 'Кабинет', tk: 'Iş otagy' } } }];
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'office.xlsx', workbook });
  jest.mocked(pickImportImages).mockResolvedValue(new Map([['office.jpg', staged]]));
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  await act(async () => { await controller.chooseWorkbook(); });
  expect(screen.getByText(/Russian · строка 2 · Image filename.*office\.jpg/s)).toBeOnTheScreen();
  expect(screen.queryByText(/Импорт очистит весь черновик/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Сохранить импорт в черновик' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать ZIP или фотографии' }));
  const room = controller.review!.catalog.rooms.find(item => item.labels.ru === 'Кабинет')!;
  expect(app.draft!.galleries[room.id]).toBeUndefined();
  expect(controller.review!.issues).toEqual([]);
  expect(screen.getByText('В черновике будет 1 фото.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Сохранить импорт в черновик' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Заменить черновик' }));
  expect(app.draft!.rooms).toEqual([room]);
  expect(app.draft!.galleries).toEqual({ [room.id]: [app.draft!.photos[0].id] });
});

test.each([
  ['ru', 'android'], ['ru', 'ios'], ['tk', 'android'], ['tk', 'ios'],
] as const)('the %s review on %s narrow layout with large text handles ready, missing-image, and incomplete imports', async (language, os) => {
  app.language = language;
  const ru = language === 'ru';
  const platform = jest.replaceProperty(Platform, 'OS', os);
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, scale: 1, fontScale: 2 } satisfies ReturnType<typeof useWindowDimensions>);
  try {
    await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
    await fireEvent.press(screen.getByRole('button', { name: ru ? 'Импорт из Excel' : 'Excel-den import' }));
    let card = within(screen.getByTestId('import-review'));
    expect(card.getByText('catalog.xlsx')).toBeOnTheScreen();
    expect(card.getByText(ru ? 'В черновике будет 48 фото.' : 'Garalamada 48 surat bolar.')).toBeOnTheScreen();
    expect(card.getByRole('button', { name: ru ? 'Сохранить импорт в черновик' : 'Importy garalama ýazdyrmak' })).toBeEnabled();

    const missingBook = decodeWorkbook(encodeWorkbook(seedCatalog));
    missingBook.photos = [{ ...missingBook.photos[0], value: { ...missingBook.photos[0].value, filename: 'missing.jpg', style: { ru: '', tk: '' } } }];
    jest.mocked(pickWorkbook).mockResolvedValueOnce({ name: 'missing.xlsx', workbook: missingBook });
    jest.mocked(pickImportImages).mockResolvedValueOnce(new Map([['missing.jpg', staged]]));
    await fireEvent.press(screen.getByRole('button', { name: ru ? 'Импорт из Excel' : 'Excel-den import' }));
    card = within(screen.getByTestId('import-review'));
    expect(card.getByText(/missing\.jpg/)).toBeOnTheScreen();
    expect(card.getByRole('button', { name: ru ? 'Сохранить импорт в черновик' : 'Importy garalama ýazdyrmak' })).toBeDisabled();
    await fireEvent.press(card.getByRole('button', { name: ru ? 'Выбрать ZIP или фотографии' : 'ZIP ýa-da suratlary saýlamak' }));
    expect(card.getByText(ru ? 'В черновике будет 1 фото.' : 'Garalamada 1 surat bolar.')).toBeOnTheScreen();
    expect(card.getByText(ru ? 'Перед публикацией заполните недостающие данные.' : 'Çap etmezden ozal ýetmeýän maglumatlary dolduryň.')).toBeOnTheScreen();
    expect(card.getByRole('button', { name: ru ? 'Сохранить импорт в черновик' : 'Importy garalama ýazdyrmak' })).toBeEnabled();
  } finally {
    platform.restore();
    dimensions.mockRestore();
  }
});

test.each(['ru', 'tk'] as const)('the %s review offers additional errors on demand on a narrow screen with large text', async language => {
  app.language = language;
  const ru = language === 'ru';
  const workbook = decodeWorkbook(encodeWorkbook(seedCatalog));
  workbook.photos = workbook.photos.slice(0, 27).map((entry, index) => ({ ...entry, value: { ...entry.value, filename: `required-${index + 1}.jpg` } }));
  jest.mocked(pickWorkbook).mockResolvedValue({ name: 'catalog.xlsx', workbook });
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, scale: 1, fontScale: 2 } satisfies ReturnType<typeof useWindowDimensions>);
  try {
    await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
    await fireEvent.press(screen.getByRole('button', { name: ru ? 'Импорт из Excel' : 'Excel-den import' }));
    let card = within(screen.getByTestId('import-review'));
    expect(card.getByText(/required-1\.jpg/)).toBeOnTheScreen();
    expect(card.queryByText(/required-2\.jpg/)).toBeNull();
    let more = card.getByRole('button', { name: ru ? 'Остальные ошибки (26)' : 'Beýleki ýalňyşlyklar (26)' });
    await fireEvent.press(more);
    expect(card.getByText(/required-26\.jpg/)).toBeOnTheScreen();
    expect(card.queryByText(/required-27\.jpg/)).toBeNull();
    await fireEvent.press(card.getByRole('button', { name: ru ? 'Следующие ошибки' : 'Indiki ýalňyşlyklar' }));
    expect(card.getByText(/required-27\.jpg/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: ru ? 'Импорт из Excel' : 'Excel-den import' }));
    card = within(screen.getByTestId('import-review'));
    expect(card.queryByText(/required-27\.jpg/)).toBeNull();
    more = card.getByRole('button', { name: ru ? 'Остальные ошибки (26)' : 'Beýleki ýalňyşlyklar (26)' });
    await fireEvent.press(more);
    expect(card.getByText(/required-2\.jpg/)).toBeOnTheScreen();
    await fireEvent.press(more);
    expect(card.queryByText(/required-2\.jpg/)).toBeNull();
    await fireEvent.press(card.getByRole('button', { name: ru ? 'Отменить импорт' : 'Importy ýatyrmak' }));
    expect(screen.queryByTestId('import-review')).toBeNull();
    expect(app.saveDraft).not.toHaveBeenCalled();
  } finally { dimensions.mockRestore(); }
});

test('changing viewport and text size preserves the photo while adapting the form', async () => {
  app.language = 'tk';
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 1024, height: 768, scale: 1, fontScale: 1 });
  try {
    const view = await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
    await fireEvent.press(screen.getByTestId('draft-photo-picker'));
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

test.each(['room', 'style', 'palette', 'material', 'detail'] as const)('bulk %s deletion preserves search selections and protects used options', async kind => {
  const unused = [
    { id: 'unused-1', labels: { ru: 'Первый', tk: 'Birinji' } },
    { id: 'unused-2', labels: { ru: 'Второй', tk: 'Ikinji' } },
  ];
  if (kind === 'room') {
    app.draft!.rooms.push(...unused);
    app.draft!.galleries['unused-1'] = []; app.draft!.galleries['unused-2'] = [];
  } else app.draft!.terms.push(...unused.map(option => ({ ...option, kind })));
  await render(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  const label = kind === 'room' ? 'Комната' : kind === 'style' ? 'Стиль' : kind === 'palette' ? 'Палитра' : kind === 'material' ? 'Материалы' : 'Детали';
  const usedLabel = kind === 'room' ? 'Кухня' : kind === 'style' ? 'Минимализм' : kind === 'palette' ? 'Тёплые нейтральные тона' : kind === 'material' ? 'Натуральный дуб' : 'Лаконичные линии';
  const selectionRole = kind === 'room' || kind === 'style' ? 'radio' : 'checkbox';
  await fireEvent.press(screen.getByRole('button', { name: label }));
  if (kind === 'room' || kind === 'style') expect(screen.queryByRole('button', { name: 'Сбросить выбор' })).toBeNull();
  else expect(screen.getByRole('button', { name: 'Сбросить выбор' })).toBeDisabled();
  await fireEvent.press(screen.getByRole(selectionRole, { name: 'Первый' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать для удаления' }));
  expect(screen.getByRole('checkbox', { name: usedLabel })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать все' }));
  expect(screen.getByRole('button', { name: 'Удалить (2)' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Снять все' }));
  expect(screen.getByRole('button', { name: 'Удалить (0)' })).toBeDisabled();
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
  if (kind === 'room') expect(controller.fields.room).toBe('');
  else if (kind === 'style') expect(controller.fields.styleId).toBe('');
  else expect(controller.fields[kind === 'palette' ? 'paletteIds' : kind === 'material' ? 'materialIds' : 'detailIds']).toEqual([]);
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
  await act(async () => { controller.setFields({ ...controller.fields, room: 'kitchen', styleId: 'minimalist' }); });
  app.draft = { ...app.draft!, rooms: [], terms: [], photos: [], galleries: {} };
  await view.rerender(<StaffWorkspaceProvider><Probe /></StaffWorkspaceProvider>);
  expect(controller.fields).toMatchObject({ room: '', styleId: '' });
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
