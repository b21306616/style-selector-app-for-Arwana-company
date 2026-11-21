import { beforeEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Dashboard from '../src/app/staff/dashboard';
import { cloneCatalog } from '../src/domain/catalog';
import { seedCatalog } from '../src/data/catalog';
import { AppContextValue, useApp } from '../src/state/AppProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('../src/state/AppProvider', () => ({ useApp: jest.fn() }));
jest.mock('../src/features/staff/auth-context', () => ({ useStaffAuth: () => ({ lock: jest.fn() }) }));
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
    ready: true, error: null, notices: [], language: 'ru', catalog: cloneCatalog(seedCatalog), draft: cloneCatalog(seedCatalog),
    session: null, busy: false, setLanguage: asyncMock(), startSession: asyncMock(), rate: asyncMock(), undo: asyncMock(),
    clearSession: asyncMock(), saveDraft: asyncMock(), publishDraft: asyncMock(), resetDraft: asyncMock(), refresh: asyncMock(), dismissNotices: jest.fn(),
  };
  jest.mocked(useApp).mockImplementation(() => app);
});

test('staff dashboard displays simplified summary buttons for all 5 spaces without preview strips', async () => {
  await render(<Dashboard />);
  expect(screen.getByText('Обзор подборок')).toBeOnTheScreen();
  expect(screen.getByText('Весь дом')).toBeOnTheScreen();
  expect(screen.getByText('Кухня')).toBeOnTheScreen();
  expect(screen.getByText('Гостиная')).toBeOnTheScreen();
  expect(screen.getByText('Спальня')).toBeOnTheScreen();
  expect(screen.getByText('Ванная')).toBeOnTheScreen();

  const publishedButtons = screen.getAllByRole('button', { name: /Опубликовано: \d+/ });
  expect(publishedButtons).toHaveLength(5);

  const draftButtons = screen.getAllByRole('button', { name: /Черновик: \d+/ });
  expect(draftButtons).toHaveLength(5);
});

test('clicking published summary button opens slide modal with published photos and close works', async () => {
  await render(<Dashboard />);
  const kitchenPublished = screen.getByRole('button', { name: `Кухня, Опубликовано: ${app.catalog!.galleries.kitchen.length}` });
  await fireEvent.press(kitchenPublished);

  expect(screen.getByText(`Опубликовано · ${app.catalog!.galleries.kitchen.length}`)).toBeOnTheScreen();

  const closeButton = screen.getByRole('button', { name: 'Закрыть' });
  await fireEvent.press(closeButton);

  expect(screen.queryByText(`Опубликовано · ${app.catalog!.galleries.kitchen.length}`)).toBeNull();
});

test('clicking draft summary button opens slide modal with draft photos', async () => {
  app.draft!.galleries.bedroom = ['bedroom-1', 'bedroom-2'];
  app.draft!.photos = [
    { id: 'bedroom-1', room: 'bedroom', styleId: 'scandinavian', paletteIds: [], materialIds: [], detailIds: [], image: { kind: 'bundled', key: 'b1' }, width: 800, height: 600, sample: false },
    { id: 'bedroom-2', room: 'bedroom', styleId: 'minimalism', paletteIds: [], materialIds: [], detailIds: [], image: { kind: 'bundled', key: 'b2' }, width: 800, height: 600, sample: false },
  ];

  await render(<Dashboard />);
  const bedroomDraft = screen.getByRole('button', { name: 'Спальня, Черновик: 2' });
  await fireEvent.press(bedroomDraft);

  expect(screen.getByText('Черновик · 2')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Спальня, Скандинавский, 1' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Спальня, , 2' })).toBeOnTheScreen();
});

test('staff dashboard renders Turkmen labels and single-line space overview correctly', async () => {
  app.language = 'tk';
  await render(<Dashboard />);
  expect(screen.getByText('Toplumlara umumy syn')).toBeOnTheScreen();
  expect(screen.getByText('Aşhana')).toBeOnTheScreen();
  expect(screen.getByText('Myhman otagy')).toBeOnTheScreen();
  expect(screen.getByText('Ýatylýan otag')).toBeOnTheScreen();
  expect(screen.getByText('Wanna otagy')).toBeOnTheScreen();
  expect(screen.getByText('Bütin jaý')).toBeOnTheScreen();

  const publishedButtons = screen.getAllByRole('button', { name: /Çap edilen: \d+/ });
  expect(publishedButtons).toHaveLength(5);

  const draftButtons = screen.getAllByRole('button', { name: /Garalama: \d+/ });
  expect(draftButtons).toHaveLength(5);
});
