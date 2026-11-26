import { beforeEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Photos from '../src/app/staff/photos';
import Vocabulary from '../src/app/staff/vocabulary';
import Preview from '../src/app/staff/preview';
import Galleries from '../src/app/staff/galleries';
import { cloneCatalog } from '../src/domain/catalog';
import { seedCatalog } from '../src/data/catalog';
import { Catalog } from '../src/domain/types';
import { AppContextValue, useApp } from '../src/state/AppProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('../src/state/AppProvider', () => ({ useApp: jest.fn() }));
jest.mock('../src/storage/images', () => ({ importPhotos: jest.fn() }));
jest.mock('../src/components/PhotoImage', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { PhotoImage: () => React.createElement(View) };
});

const asyncMock = () => jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
let app: AppContextValue;
beforeEach(() => {
  jest.clearAllMocks();
  app = {
    ready: true, error: null, notices: [], language: 'tk', catalog: cloneCatalog(seedCatalog), draft: cloneCatalog(seedCatalog),
    session: null, busy: false, setLanguage: asyncMock(), startSession: asyncMock(), rate: asyncMock(), undo: asyncMock(),
    clearSession: asyncMock(), saveDraft: asyncMock(), publishDraft: asyncMock(), resetDraft: asyncMock(), refresh: asyncMock(), dismissNotices: jest.fn(),
  };
  jest.mocked(useApp).mockImplementation(() => app);
});

test('changing a photo room removes it from its former gallery and keeps it in the library', async () => {
  await render(<Photos />);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Wanna otagy, Skandinaw' })[0]);
  const roomButtons = screen.getAllByRole('button', { name: 'Aşhana' });
  await fireEvent.press(roomButtons[roomButtons.length - 1]);
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty ýatda sakla' }));
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  const id = 'bathroom-scandinavian-1';
  expect(saved.photos.find(photo => photo.id === id)?.room).toBe('kitchen');
  expect(saved.galleries.bathroom).not.toContain(id);
  expect(saved.galleries.kitchen).toEqual(app.draft!.galleries.kitchen);
});

test('staff can give a roomless imported photo its first room and fill only the chosen translation', async () => {
  const draft = app.draft!;
  const photo = { ...draft.photos[0], room: '', blankTranslations: { style: 'tk', material: 'ru' } as const };
  draft.photos = [photo];
  for (const space of Object.keys(draft.galleries)) draft.galleries[space] = [];
  jest.mocked(app.saveDraft).mockImplementation(async change => { app.draft = typeof change === 'function' ? change(app.draft!) : change; });
  await render(<Photos />);
  await fireEvent.press(screen.getByRole('button', { name: 'Saýlanmady, Tegler gerek' }));
  expect(screen.getByRole('button', { name: 'Skandinaw' })).not.toBeSelected();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Aşhana' }).at(-1)!);
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty ýatda sakla' }));
  expect(app.draft!.photos[0]).toMatchObject({ room: 'kitchen', styleId: photo.styleId, blankTranslations: photo.blankTranslations });
  expect(app.draft!.galleries['']).toBeUndefined();
  await fireEvent.press(screen.getByRole('button', { name: 'Aşhana, Tegler gerek' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Skandinaw' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty ýatda sakla' }));
  expect(app.draft!.photos[0].blankTranslations).toEqual({ material: 'ru' });
  expect(screen.getByRole('button', { name: 'Aşhana, Skandinaw' })).toBeOnTheScreen();
});

test('a referenced term cannot be deleted, and saving requires both language labels', async () => {
  await render(<Vocabulary />);
  await fireEvent.press(screen.getByText('Skandinaw'));
  expect(screen.getByRole('button', { name: 'Termini öçürmek' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Русское название'), '');
  expect(screen.getByRole('button', { name: 'Termini ýatda sakla' })).toBeDisabled();
  expect(app.saveDraft).not.toHaveBeenCalled();
});

test('publication is disabled for an untagged selected photo and presents a friendly location', async () => {
  app.draft!.photos[0].styleId = '';
  await render(<Preview />);
  expect(screen.getByRole('button', { name: 'Bu toplumlary çap etmek' })).toBeDisabled();
  expect(screen.getByText(/Bar bolan stili saýlaň.*Wanna otagy · surat 1/)).toBeOnTheScreen();
  expect(app.publishDraft).not.toHaveBeenCalled();
});

test('a missing translation on a gallery photo blocks publication even with a complete shared style', async () => {
  app.draft!.photos[0].blankTranslations = { style: 'tk' };
  await render(<Preview />);
  expect(screen.getByRole('button', { name: 'Bu toplumlary çap etmek' })).toBeDisabled();
  expect(screen.getByText(/Bu suratyň ýetmeýän terjimelerini dolduryň.*surat 1/)).toBeOnTheScreen();
});

test('staff publication reports success only after the save resolves', async () => {
  await render(<Preview />);
  await fireEvent.press(screen.getByRole('button', { name: 'Bu toplumlary çap etmek' }));
  expect(app.publishDraft).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Toplumlar taýyn')).toBeOnTheScreen();
});

test('gallery search retains the full selection when moving a filtered photo', async () => {
  const before = [...app.draft!.galleries.bathroom];
  const id = before[1];
  await render(<Galleries />);
  await fireEvent.press(screen.getByRole('button', { name: 'Görkeziliş tertibi' }));
  await fireEvent.changeText(screen.getByLabelText('Otag ýa-da stil boýunça gözleg'), id);
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty öňe süýşürmek' }));
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  expect(saved.galleries.bathroom).toEqual([before[1], before[0], ...before.slice(2)]);
  expect(saved.galleries.kitchen).toEqual(app.draft!.galleries.kitchen);
});

test('photo tiles expose selection state and only remove the chosen gallery entry', async () => {
  const before = [...app.draft!.galleries.bathroom];
  await render(<Galleries />);
  const tile = screen.getByRole('button', { name: 'Suraty aýyrmak: Wanna otagy, Skandinaw, orun 1' });
  expect(tile).toBeSelected();
  await fireEvent.press(tile);
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  expect(saved.galleries.bathroom).toEqual(before.slice(1));
  expect(saved.galleries.kitchen).toEqual(app.draft!.galleries.kitchen);
  expect(saved.photos).toEqual(app.draft!.photos);
});

test('the gallery editor follows the selected room and handles removal of the final room', async () => {
  const view = await render(<Galleries />);
  await fireEvent.press(screen.getByRole('button', { name: 'Aşhana' }));
  expect(screen.getByRole('button', { name: /Suraty aýyrmak: Aşhana, Skandinaw, orun 1$/ })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Suraty aýyrmak: Wanna otagy/ })).toBeNull();
  app.draft = { ...app.draft!, rooms: [], photos: [], galleries: {} };
  await view.rerender(<Galleries />);
  expect(screen.getByText('Ilki garalama formasynda otag goşuň.')).toBeOnTheScreen();
});

test('publication coverage is optional while publication remains available', async () => {
  await render(<Preview />);
  expect(screen.queryByText('Skandinaw · 3')).not.toBeOnTheScreen();
  const coverage = screen.getAllByRole('button', { name: 'Toplumyň düzümi' })[0];
  expect(coverage).toHaveProp('accessibilityState', { expanded: false });
  await fireEvent.press(coverage);
  expect(screen.getByText('Skandinaw · 3')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bu toplumlary çap etmek' })).toBeEnabled();
});

test('staff photos preserves Все комнаты search across rooms and roomless imports, and empty catalogs remain publishable', async () => {
  app.language = 'ru';
  const roomless = { ...app.draft!.photos[0], id: 'roomless-photo', room: '', styleId: '' };
  app.draft!.photos = [roomless, ...app.draft!.photos];
  const photos = await render(<Photos />);
  expect(screen.getByRole('button', { name: 'Все комнаты' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Не выбрано, Нужны теги' })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Поиск фотографий'), 'Гостиная');
  expect(screen.getAllByRole('button', { name: /^Гостиная,/ })).toHaveLength(8);
  expect(screen.queryByRole('button', { name: /^Ванная,/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Не выбрано, Нужны теги' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Поиск фотографий'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Кухня' }));
  expect(screen.queryByRole('button', { name: 'Не выбрано, Нужны теги' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Все комнаты' }));
  expect(screen.getByRole('button', { name: 'Не выбрано, Нужны теги' })).toBeOnTheScreen();

  app.draft = { ...app.draft!, rooms: [], photos: [roomless], galleries: {} };
  await photos.rerender(<Photos />);
  expect(screen.getByText('Сначала добавьте комнату в форме черновика.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '＋ Добавить фотографии' })).toBeDisabled();
  await photos.unmount();

  app.draft = { ...app.draft!, rooms: [], photos: [], galleries: {} };
  await render(<Preview />);
  expect(screen.getByRole('button', { name: 'Опубликовать подборки' })).toBeEnabled();
});
