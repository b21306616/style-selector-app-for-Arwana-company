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
    ready: true, error: null, notices: [], language: 'en', catalog: cloneCatalog(seedCatalog), draft: cloneCatalog(seedCatalog),
    session: null, busy: false, setLanguage: asyncMock(), startSession: asyncMock(), rate: asyncMock(), undo: asyncMock(),
    clearSession: asyncMock(), saveDraft: asyncMock(), publishDraft: asyncMock(), resetDraft: asyncMock(), refresh: asyncMock(), dismissNotices: jest.fn(),
  };
  jest.mocked(useApp).mockImplementation(() => app);
});

test('changing a photo room removes it from its former room gallery while preserving Whole House', async () => {
  await render(<Photos />);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Bathroom, Scandinavian' })[0]);
  const roomButtons = screen.getAllByRole('button', { name: 'Kitchen' });
  await fireEvent.press(roomButtons[roomButtons.length - 1]);
  await fireEvent.press(screen.getByRole('button', { name: 'Save photo' }));
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  const id = 'bathroom-scandinavian-1';
  expect(saved.photos.find(photo => photo.id === id)?.room).toBe('kitchen');
  expect(saved.galleries.bathroom).not.toContain(id);
  expect(saved.galleries.whole_house).toContain(id);
});

test('a referenced term cannot be deleted, and saving requires both language labels', async () => {
  await render(<Vocabulary />);
  await fireEvent.press(screen.getByText('Scandinavian'));
  expect(screen.getByRole('button', { name: 'Delete term' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Русское название'), '');
  expect(screen.getByRole('button', { name: 'Save term' })).toBeDisabled();
  expect(app.saveDraft).not.toHaveBeenCalled();
});

test('publication is disabled for an untagged selected photo and presents a friendly location', async () => {
  app.draft!.photos[0].styleId = '';
  await render(<Preview />);
  expect(screen.getByRole('button', { name: 'Publish these galleries' })).toBeDisabled();
  expect(screen.getByText(/Choose a valid style.*Bathroom · photo 1/)).toBeOnTheScreen();
  expect(app.publishDraft).not.toHaveBeenCalled();
});

test('staff publication reports success only after the save resolves', async () => {
  await render(<Preview />);
  await fireEvent.press(screen.getByRole('button', { name: 'Publish these galleries' }));
  expect(app.publishDraft).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Your galleries are ready')).toBeOnTheScreen();
});

test('gallery search retains the full selection when moving a filtered photo', async () => {
  const before = [...app.draft!.galleries.whole_house];
  const id = before[1];
  await render(<Galleries />);
  await fireEvent.press(screen.getByRole('button', { name: 'Selected order' }));
  await fireEvent.changeText(screen.getByLabelText('Search room or style'), id);
  await fireEvent.press(screen.getByRole('button', { name: 'Move photo earlier' }));
  const saved = jest.mocked(app.saveDraft).mock.calls[0][0] as Catalog;
  expect(saved.galleries.whole_house).toEqual([before[1], before[0], ...before.slice(2)]);
  expect(saved.galleries.bathroom).toEqual(app.draft!.galleries.bathroom);
});
