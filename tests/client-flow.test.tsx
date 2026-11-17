import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import GalleryScreen from '../src/app/gallery';
import HomeScreen from '../src/app/index';
import ResultScreen from '../src/app/result';
import { seedCatalog } from '../src/data/catalog';
import type { Session } from '../src/domain/types';
import { useApp, type AppContextValue } from '../src/state/AppProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('../src/state/AppProvider', () => ({ useApp: jest.fn() }));
jest.mock('../src/components/PhotoImage', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { PhotoImage: ({ label }: { label?: string }) => React.createElement(View, { accessibilityLabel: label }) };
});
jest.mock('../src/components/SwipePhoto', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { SwipePhoto: ({ onReady, label }: { onReady: () => void; label: string }) => React.createElement(View, null,
    React.createElement(Text, null, label),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Image finished loading', onPress: onReady }, React.createElement(Text, null, 'Image finished loading')),
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
    ready: true, error: null, notices: [], language: 'en', catalog: seedCatalog, draft: seedCatalog,
    session: sessionWith(0), busy: false,
    setLanguage: asyncMock(), startSession: asyncMock(),
    rate: asyncMock(), undo: asyncMock(), clearSession: asyncMock(),
    saveDraft: asyncMock(), publishDraft: asyncMock(), resetDraft: asyncMock(), refresh: asyncMock(), dismissNotices: jest.fn(),
  };
  jest.mocked(useApp).mockImplementation(() => app);
});

test('gallery hides style metadata and only accepts one rating after the image loads', async () => {
  let finish!: () => void;
  jest.mocked(app.rate).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await render(<GalleryScreen />);
  expect(screen.queryByText('Scandinavian')).not.toBeOnTheScreen();
  expect(screen.queryByText('Warm neutrals')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Love it' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Image finished loading' }));
  expect(screen.getByRole('button', { name: 'Love it' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Love it' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Not for me' }));
  expect(app.rate).toHaveBeenCalledTimes(1);
  expect(app.rate).toHaveBeenCalledWith('like');
  await act(async () => finish());
});

test('preliminary result is available at 20 ratings, not 19', async () => {
  app.session = sessionWith(19);
  const view = await render(<GalleryScreen />);
  expect(screen.queryByRole('button', { name: 'See preliminary result' })).not.toBeOnTheScreen();
  app = { ...app, session: sessionWith(20) };
  await view.rerender(<GalleryScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'See preliminary result' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Start with a new client' }));
  expect(app.clearSession).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear and start fresh' }));
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
