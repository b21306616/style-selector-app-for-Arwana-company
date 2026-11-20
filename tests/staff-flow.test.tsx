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

test('changing a photo room removes it from its former room gallery while preserving Whole House', async () => {
  await render(<Photos />);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Wanna otagy, Skandinaw' })[0]);
  const roomButtons = screen.getAllByRole('button', { name: 'Aşhana' });
  await fireEvent.press(roomButtons[roomButtons.length - 1]);
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty ýatda sakla' }));
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  const id = 'bathroom-scandinavian-1';
  expect(saved.photos.find(photo => photo.id === id)?.room).toBe('kitchen');
  expect(saved.galleries.bathroom).not.toContain(id);
  expect(saved.galleries.whole_house).toContain(id);
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

test('staff publication reports success only after the save resolves', async () => {
  await render(<Preview />);
  await fireEvent.press(screen.getByRole('button', { name: 'Bu toplumlary çap etmek' }));
  expect(app.publishDraft).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Toplumlar taýyn')).toBeOnTheScreen();
});

test('gallery search retains the full selection when moving a filtered photo', async () => {
  const before = [...app.draft!.galleries.whole_house];
  const id = before[1];
  await render(<Galleries />);
  await fireEvent.press(screen.getByRole('button', { name: 'Görkeziliş tertibi' }));
  await fireEvent.changeText(screen.getByLabelText('Otag ýa-da stil boýunça gözleg'), id);
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty öňe süýşürmek' }));
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  expect(saved.galleries.whole_house).toEqual([before[1], before[0], ...before.slice(2)]);
  expect(saved.galleries.bathroom).toEqual(app.draft!.galleries.bathroom);
});

test('photo tiles expose selection state and only remove the chosen gallery entry', async () => {
  const before = [...app.draft!.galleries.whole_house];
  await render(<Galleries />);
  const tile = screen.getByRole('button', { name: 'Suraty aýyrmak: Wanna otagy, Skandinaw, orun 1' });
  expect(tile).toBeSelected();
  await fireEvent.press(tile);
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  expect(saved.galleries.whole_house).toEqual(before.slice(1));
  expect(saved.galleries.bathroom).toEqual(app.draft!.galleries.bathroom);
  expect(saved.photos).toEqual(app.draft!.photos);
});

test('publication coverage is optional while publication remains available', async () => {
  await render(<Preview />);
  expect(screen.queryByText('Skandinaw · 8')).not.toBeOnTheScreen();
  const coverage = screen.getAllByRole('button', { name: 'Toplumyň düzümi' })[0];
  expect(coverage).toHaveProp('accessibilityState', { expanded: false });
  await fireEvent.press(coverage);
  expect(screen.getByText('Skandinaw · 8')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bu toplumlary çap etmek' })).toBeEnabled();
});
