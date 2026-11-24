import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import GalleryScreen from '../src/app/gallery';
import HomeScreen from '../src/app/index';
import ResultScreen from '../src/app/result';
import { seedCatalog } from '../src/data/catalog';
import { addDraftRoom } from '../src/domain/catalog';
import type { Session } from '../src/domain/types';
import { useApp, type AppContextValue } from '../src/state/AppProvider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('../src/state/AppProvider', () => ({ useApp: jest.fn() }));
jest.mock('../src/components/PhotoImage', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { PhotoImage: ({ label }: { label?: string }) => React.createElement(View, { accessibilityLabel: label }) };
});
jest.mock('../src/components/SwipePhoto', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { SwipePhoto: ({ onReady, onFailure, onChoice, onEntranceSettled, enabled, label, entrance }: { onReady: () => void; onFailure: () => void; onChoice: (choice: 'like' | 'dislike') => void; onEntranceSettled?: () => void; enabled: boolean; label: string; entrance?: 'like' | 'dislike' | null }) => React.createElement(View, null,
    React.createElement(Text, null, label),
    React.createElement(Text, null, entrance ? `entrance ${entrance}` : 'entrance none'),
    React.createElement(Text, null, enabled ? 'Swipe enabled' : 'Swipe disabled'),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Image finished loading', onPress: onReady }, React.createElement(Text, null, 'Image finished loading')),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Image failed', onPress: onFailure }, React.createElement(Text, null, 'Image failed')),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Swipe like', onPress: () => onChoice('like') }, React.createElement(Text, null, 'Swipe like')),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Swipe dislike', onPress: () => onChoice('dislike') }, React.createElement(Text, null, 'Swipe dislike')),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Entrance settled', onPress: onEntranceSettled }, React.createElement(Text, null, 'Entrance settled')),
  ) };
});

function sessionWith(count: number, complete = false): Session {
  return {
    id: 'client-test', catalog: seedCatalog, space: 'whole_house', createdAt: '2026-11-17T00:00:00.000Z',
    ratings: seedCatalog.galleries.whole_house.slice(0, count).map(photoId => ({ photoId, choice: 'like' })),
    status: complete ? 'complete' : 'active',
  };
}
let app: AppContextValue;
const asyncMock = () => jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  app = {
    ready: true, error: null, notices: [], language: 'tk', catalog: seedCatalog, draft: seedCatalog,
    session: sessionWith(0), busy: false,
    setLanguage: asyncMock(), startSession: asyncMock(),
    rate: asyncMock(), undo: asyncMock(), clearSession: asyncMock(),
    saveDraft: asyncMock(), publishDraft: asyncMock(), resetDraft: asyncMock(), refresh: asyncMock(), dismissNotices: jest.fn(),
  };
  jest.mocked(useApp).mockImplementation(() => app);
});

test('custom spaces become customer choices only in the published catalog', async () => {
  const room = { id: 'office', labels: { ru: 'Кабинет', tk: 'Iş otagy' } };
  app.draft = addDraftRoom(seedCatalog, room);
  app.draft.photos = [...app.draft.photos, { ...seedCatalog.photos[0], id: 'office-photo', room: room.id }];
  app.draft.galleries.office = ['office-photo'];
  app.session = null;
  const view = await render(<HomeScreen />);
  expect(screen.queryByRole('button', { name: 'Iş otagy, 1 surat' })).toBeNull();
  app.catalog = app.draft;
  await view.rerender(<HomeScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Iş otagy, 1 surat' }));
  expect(app.startSession).toHaveBeenCalledWith('office');
});

test('gallery hides style metadata and only accepts one rating after the image loads', async () => {
  let finish!: () => void;
  jest.mocked(app.rate).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await render(<GalleryScreen />);
  expect(screen.queryByText('Skandinaw')).not.toBeOnTheScreen();
  expect(screen.queryByText('Ýyly bitarap öwüşginler')).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Haladym' })).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Maňa däl' })).not.toBeOnTheScreen();
  expect(screen.queryByText(/Çepe süýşür/)).not.toBeOnTheScreen();
  expect(screen.getByText('Swipe disabled')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Swipe like' }));
  expect(app.rate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Image finished loading' }));
  expect(screen.getByText('Swipe enabled')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Swipe like' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Swipe dislike' }));
  expect(app.rate).toHaveBeenCalledTimes(1);
  expect(app.rate).toHaveBeenCalledWith('like');
  await act(async () => finish());
});

test('preliminary result is available at 20 ratings, not 19', async () => {
  app.session = sessionWith(19);
  const view = await render(<GalleryScreen />);
  expect(screen.queryByRole('button', { name: 'Deslapky netijäni görmek' })).not.toBeOnTheScreen();
  app = { ...app, session: sessionWith(20) };
  await view.rerender(<GalleryScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Deslapky netijäni görmek' }));
  expect(router.replace).toHaveBeenCalledWith('/result');
});

test('completed gallery replaces itself with the result route', async () => {
  app.session = sessionWith(32, true);
  await render(<GalleryScreen />);
  expect(router.replace).toHaveBeenCalledWith('/result');
});

test('result protects previous client choices until reset is confirmed', async () => {
  app.session = sessionWith(32, true);
  await render(<ResultScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Täze müşderi bilen başlamak' }));
  expect(app.clearSession).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Täze saýlawy başlamak' }));
  expect(app.clearSession).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('Russian home uses real gallery counts and asks before replacing a client session', async () => {
  app.language = 'ru'; app.session = sessionWith(3);
  await render(<HomeScreen />);
  expect(screen.getByRole('button', { name: 'Русский' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Ванная, 12 фото' }));
  expect(app.startSession).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Начать новый сеанс' }));
  expect(app.startSession).toHaveBeenCalledWith('bathroom');
  expect(router.push).toHaveBeenCalledWith('/gallery');
});

test('result keeps features behind Details and preserves the selection when closing it', async () => {
  app.session = sessionWith(32, true);
  await render(<ResultScreen />);
  expect(screen.getAllByRole('button', { name: /Halanan suraty açmak/ }).length).toBeGreaterThan(0);
  expect(screen.queryByText('Ýyly bitarap öwüşginler')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Jikme-jik' }));
  expect(screen.getByText('Ýyly bitarap öwüşginler')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Jikme-jikligi ýapmak' }));
  expect(screen.queryByText('Ýyly bitarap öwüşginler')).not.toBeOnTheScreen();
  expect(app.clearSession).not.toHaveBeenCalled();
  expect(app.undo).not.toHaveBeenCalled();
});

test('liked-photo viewer uses accessible icon navigation with correct boundaries', async () => {
  app.session = { ...sessionWith(32, true), ratings: sessionWith(32, true).ratings.map((rating, index) => ({ ...rating, choice: index < 2 ? 'like' : 'dislike' })) };
  await render(<ResultScreen />);
  await fireEvent.press(screen.getAllByRole('button', { name: /Halanan suraty açmak/ })[0]);
  expect(screen.getByRole('button', { name: 'Öňki' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Indiki' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Indiki' }));
  expect(screen.getByRole('button', { name: 'Indiki' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Öňki' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Ýapmak' }));
  expect(screen.queryByRole('button', { name: 'Indiki' })).not.toBeOnTheScreen();
});

test('failed photos cannot be rated until a successful reload', async () => {
  await render(<GalleryScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Image failed' }));
  expect(screen.getByText('Swipe disabled')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Swipe like' }));
  expect(app.rate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty täzeden açmak' }));
  expect(screen.getByText('Swipe disabled')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Image finished loading' }));
  expect(screen.getByText('Swipe enabled')).toBeOnTheScreen();
  expect(app.rate).not.toHaveBeenCalled();
});

test('undo brings a liked photo back from the like side', async () => {
  app.session = sessionWith(1);
  jest.mocked(app.undo).mockImplementation(async () => { app = { ...app, session: sessionWith(0) }; });
  const view = await render(<GalleryScreen />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Soňky saýlawy yza gaýtarmak' })); });
  await view.rerender(<GalleryScreen />);
  expect(app.undo).toHaveBeenCalledTimes(1);
  expect(screen.getByText('entrance like')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Entrance settled' }));
  expect(screen.getByText('entrance none')).toBeOnTheScreen();
});

test('undo brings a disliked photo back from the dislike side', async () => {
  const photoId = seedCatalog.galleries.whole_house[0];
  app.session = { ...sessionWith(1), ratings: [{ photoId, choice: 'dislike' }] };
  jest.mocked(app.undo).mockImplementation(async () => { app = { ...app, session: sessionWith(0) }; });
  const view = await render(<GalleryScreen />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Soňky saýlawy yza gaýtarmak' })); });
  await view.rerender(<GalleryScreen />);
  expect(screen.getByText('entrance dislike')).toBeOnTheScreen();
});

test('undo stays disabled before the first rating', async () => {
  await render(<GalleryScreen />);
  expect(screen.getByRole('button', { name: 'Soňky saýlawy yza gaýtarmak' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Soňky saýlawy yza gaýtarmak' }));
  expect(app.undo).not.toHaveBeenCalled();
  expect(screen.getByText('entrance none')).toBeOnTheScreen();
});

test('changing the last choice opens the gallery from that choice side', async () => {
  app.session = sessionWith(32, true);
  await render(<ResultScreen />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Soňky saýlawy üýtgetmek' })); });
  expect(app.undo).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/gallery', params: { entrance: 'like' } });
});

test('continuing a preliminary result opens the gallery without a return animation', async () => {
  app.session = sessionWith(20);
  await render(<ResultScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Saýlamagy dowam etmek' }));
  expect(router.replace).toHaveBeenCalledWith('/gallery');
  expect(app.undo).not.toHaveBeenCalled();
});

test('no liked photos produces an honest empty result and no invented style', async () => {
  app.session = { ...sessionWith(32, true), ratings: sessionWith(32, true).ratings.map(rating => ({ ...rating, choice: 'dislike' })) };
  await render(<ResultScreen />);
  expect(screen.getByText('Stil entek anyklanmady')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Halanan suraty açmak/ })).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Jikme-jik' }));
  expect(screen.getByText('Umumy aýratynlyklar entek kesgitlenmedi.')).toBeOnTheScreen();
});
