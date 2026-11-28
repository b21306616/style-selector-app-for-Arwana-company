import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import GalleryScreen from '../src/app/gallery';
import { createSession, rateSession } from '../src/domain/session';
import type { Choice, Language, Photo, Session } from '../src/domain/types';
import { AppProvider, useApp } from '../src/state/AppProvider';
import type { AppSnapshot } from '../src/storage/repository';
import { errorText } from '../src/ui/copy';
import { singleRoomCatalog } from './room-fixture';

let mockSnapshot: AppSnapshot;
let mockEntrance: Choice | undefined;
let mockReducedMotion = false;
const mockSave = jest.fn<(session: Session) => Promise<void>>();
const mockMount = jest.fn<(id: string) => void>();
const mockAnimations: { target: number; finish: (finished: boolean) => void }[] = [];

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), setParams: jest.fn() }, useLocalSearchParams: () => ({ entrance: mockEntrance }),
}));
jest.mock('../src/storage/repository', () => ({
  loadState: async () => mockSnapshot, getReferencedCatalogs: async () => [], saveSession: (session: Session) => mockSave(session),
}));
jest.mock('../src/storage/images', () => ({
  photoSource: (photo: Photo) => ({ uri: photo.id }), cleanupImageFiles: async () => {},
}));
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: function Image({ source, ...props }: { source: { uri: string } }) {
    React.useEffect(() => { mockMount(source.uri); }, [source.uri]);
    return React.createElement(View, { ...props, testID: source.uri });
  } };
});
jest.mock('react-native-gesture-handler', () => ({
  usePanGesture: (gesture: unknown) => gesture,
  GestureDetector: ({ gesture, children }: { gesture: unknown; children: unknown }) =>
    require('react').cloneElement(children, { gesture, testID: 'photo-pan' }),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => callback(...args) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: require('react-native').View },
  useReducedMotion: () => mockReducedMotion, useAnimatedStyle: (style: () => unknown) => style(),
  useSharedValue: function useSharedValue(initial: unknown) {
    return require('react').useState(() => {
      let value = initial;
      return { get: () => value, set: (next: unknown) => { value = next; } };
    })[0];
  },
  clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
  withSpring: (target: number, _: unknown, finish?: (finished: boolean) => void) => {
    if (finish) mockAnimations.push({ target, finish });
    return target;
  },
  cancelAnimation: () => {}, withTiming: (target: number) => target, withSequence: (...targets: number[]) => targets.at(-1),
  Easing: { out: () => undefined, quad: () => undefined },
}));

function ReadyGallery() { return useApp().ready ? <GalleryScreen /> : null; }
async function openGallery(count = 5, choices: Choice[] = [], language: Language = 'tk') {
  const catalog = singleRoomCatalog(count);
  let session = createSession(catalog, 'bathroom', 'gallery-test');
  for (const choice of choices) session = rateSession(session, choice, catalog.galleries.bathroom[session.ratings.length]);
  mockSnapshot = { catalog, draft: catalog, session, language, notices: [] };
  await render(<AppProvider><ReadyGallery /></AppProvider>);
  await screen.findByRole('progressbar');
}
const image = (n: number) => screen.getByTestId(`room-photo-${n}`, { includeHiddenElements: true });
const display = (n: number) => act(() => image(n).props.onDisplay());
const gesture = () => screen.getByTestId('photo-pan').props.gesture;
const counter = () => screen.getByRole('progressbar').props.accessibilityValue.now;
const undo = () => screen.getByRole('button', { name: 'Soňky saýlawy yza gaýtarmak' });
const release = (x: number, velocity = 850 * Math.sign(x), canceled = false) => act(() => {
  const pan = gesture();
  pan.onActivate();
  pan.onUpdate({ translationX: x });
  pan.onDeactivate({ translationX: x, velocityX: velocity, canceled });
});
async function settle() {
  const animation = mockAnimations.shift();
  expect(animation).toBeDefined();
  await act(() => animation!.finish(true));
}
function layerOf(photoNumber: number) {
  return screen.getAllByTestId('photo-pan', { includeHiddenElements: true })
    .find(node => within(node).queryByTestId(`room-photo-${photoNumber}`, { includeHiddenElements: true }))!;
}
function offsetOf(photoNumber: number) {
  return StyleSheet.flatten(layerOf(photoNumber).props.style).transform[0].translateX as number;
}
function opacityOf(photoNumber: number) {
  return StyleSheet.flatten(layerOf(photoNumber).props.style).opacity as number;
}
beforeEach(() => {
  mockSave.mockReset().mockResolvedValue(undefined);
  mockMount.mockClear();
  mockAnimations.length = 0;
  mockEntrance = undefined;
  mockReducedMotion = false;
});

test('a prepared image is promoted in place after both the swipe and save, and only one rating is written', async () => {
  let finishWrite!: () => void;
  mockSave.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
  await openGallery();
  expect(screen.queryByText('Skandinaw')).toBeNull();
  expect(screen.queryByText('Ýyly bitarap öwüşginler')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Haladym' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Maňa däl' })).toBeNull();
  expect(gesture().enabled).toBe(false);
  await release(130);
  expect(mockSave).not.toHaveBeenCalled();
  await display(1);
  await display(2);
  const prepared = image(2);
  const oldGesture = gesture();
  await release(130);
  await act(() => oldGesture.onDeactivate({ translationX: -120, velocityX: -900 }));
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0][0].ratings).toEqual([{ photoId: 'room-photo-1', choice: 'like' }]);
  await settle();
  expect(counter()).toBe(1);
  expect(gesture().enabled).toBe(false);
  await act(() => finishWrite());
  expect(counter()).toBe(2);
  expect(image(2)).toBe(prepared);
  expect(gesture().enabled).toBe(true);
  expect(screen.queryByLabelText('Surat açylýar')).toBeNull();
  expect(mockMount.mock.calls.flat()).toEqual(['room-photo-1', 'room-photo-2', 'room-photo-3']);
  await act(() => oldGesture.onDeactivate({ translationX: -120, velocityX: -900 }));
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test('a slow successor holds the outgoing photo until native display, even when the save finishes first', async () => {
  await openGallery();
  await display(1);
  await release(-160);
  expect(mockSave.mock.calls[0][0].ratings[0].choice).toBe('dislike');
  expect(mockAnimations).toHaveLength(0);
  expect(counter()).toBe(1);
  expect(screen.queryByLabelText('Surat açylýar')).toBeNull();
  expect(undo()).toBeDisabled();
  await display(2);
  expect(mockAnimations[0].target).toBeLessThan(0);
  await settle();
  expect(counter()).toBe(2);
  expect(gesture().enabled).toBe(true);
});

test('a failed successor can be retried independently and stale display events cannot enable the retry', async () => {
  await openGallery();
  await display(1);
  const staleDisplay = image(2).props.onDisplay;
  await act(() => image(2).props.onError());
  await release(140);
  await settle();
  expect(counter()).toBe(2);
  expect(gesture().enabled).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Suraty täzeden açmak' }));
  await act(() => staleDisplay());
  await release(120);
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(gesture().enabled).toBe(false);
  await display(2);
  expect(gesture().enabled).toBe(true);
  expect(mockMount.mock.calls.flat().filter(id => id === 'room-photo-1')).toHaveLength(1);
  expect(mockMount.mock.calls.flat().filter(id => id === 'room-photo-2')).toHaveLength(2);
});

test('a failed save returns the same image and permits a new rating after the return settles', async () => {
  let failWrite!: () => void;
  mockSave.mockImplementationOnce(() => new Promise<void>((_, reject) => { failWrite = () => reject(new Error('Disk full')); }));
  await openGallery();
  await display(1);
  await display(2);
  const original = image(1);
  await release(-120);
  await settle();
  await act(() => failWrite());
  expect(mockAnimations[0].target).toBe(0);
  await settle();
  expect(screen.getByText(errorText('STORAGE_ERROR', 'tk'))).toBeOnTheScreen();
  expect(counter()).toBe(1);
  expect(image(1)).toBe(original);
  await release(130);
  await settle();
  expect(counter()).toBe(2);
  expect(mockSave.mock.calls[1][0].ratings).toEqual([{ photoId: 'room-photo-1', choice: 'like' }]);
});

test.each(['like', 'dislike'] as const)('undo waits for the previous photo and brings a %s back from its original side', async choice => {
  await openGallery(4, [choice]);
  await display(2);
  const previous = image(1);
  await fireEvent.press(undo());
  expect(counter()).toBe(2);
  expect(undo()).toBeDisabled();
  expect(offsetOf(1) * (choice === 'like' ? 1 : -1)).toBeGreaterThan(0);
  expect(mockAnimations).toHaveLength(0);
  await display(1);
  await settle();
  expect(counter()).toBe(1);
  expect(image(1)).toBe(previous);
  expect(gesture().enabled).toBe(true);
  expect(undo()).toBeDisabled();
});

test('a failed undo leaves the current image available for another attempt', async () => {
  mockSave.mockRejectedValueOnce(new Error('Disk full'));
  await openGallery(4, ['dislike']);
  await display(1);
  await display(2);
  const original = image(2);
  await fireEvent.press(undo());
  expect(mockAnimations).toHaveLength(0);
  expect(counter()).toBe(2);
  expect(image(2)).toBe(original);
  expect(gesture().enabled).toBe(true);
  await fireEvent.press(undo());
  await settle();
  expect(counter()).toBe(1);
});

test('undo from results waits for display before animating and ignores a second undo press during entry', async () => {
  mockEntrance = 'dislike';
  await openGallery(3, ['like', 'dislike']);
  expect(router.setParams).toHaveBeenCalledWith({ entrance: '' });
  expect(offsetOf(3)).toBeLessThan(0);
  await fireEvent.press(undo());
  expect(mockSave).not.toHaveBeenCalled();
  await display(3);
  await settle();
  expect(offsetOf(3)).toBe(0);
  expect(undo()).toBeEnabled();
});

test('canceled drags return without saving and reduced motion handles consecutive swipes and undos', async () => {
  mockReducedMotion = true;
  await openGallery();
  await display(1);
  await display(2);
  await release(140, 800, true);
  await release(15);
  expect(mockSave).not.toHaveBeenCalled();
  await release(55, 950);
  await display(3);
  await release(-140);
  expect(counter()).toBe(3);
  await fireEvent.press(undo());
  expect(counter()).toBe(2);
  await fireEvent.press(undo());
  // The first image was evicted when photo 3 became current.
  await display(1);
  expect(counter()).toBe(1);
  expect(mockSave).toHaveBeenCalledTimes(4);
  expect(mockAnimations).toHaveLength(0);
});

test('the last photo stays visible until saved and the results open after its exit', async () => {
  let finishWrite!: () => void;
  mockSave.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
  await openGallery(1);
  await display(1);
  await release(120);
  expect(mockAnimations).toHaveLength(0);
  expect(router.replace).not.toHaveBeenCalled();
  await act(() => finishWrite());
  expect(mockAnimations).toHaveLength(1);
  expect(router.replace).not.toHaveBeenCalled();
  await settle();
  expect(router.replace).toHaveBeenCalledWith('/result');
});

test('at most three photo views stay mounted across swipes and undoing a displayed card reuses it without waiting for display', async () => {
  await openGallery(5);
  expect(screen.getAllByTestId('photo-pan', { includeHiddenElements: true })).toHaveLength(2);
  await display(1);
  await display(2);
  await release(130);
  await settle();
  expect(counter()).toBe(2);
  expect(screen.getAllByTestId('photo-pan', { includeHiddenElements: true })).toHaveLength(3);
  expect(opacityOf(1)).toBe(0);

  await display(3);
  await release(-130);
  await settle();
  expect(counter()).toBe(3);
  expect(screen.getAllByTestId('photo-pan', { includeHiddenElements: true })).toHaveLength(3);
  expect(screen.queryByTestId('room-photo-1', { includeHiddenElements: true })).toBeNull();
  expect(opacityOf(2)).toBe(0);

  const cached = image(2);
  await fireEvent.press(undo());
  expect(offsetOf(2)).toBeLessThan(0);
  expect(opacityOf(2)).toBe(1);
  expect(mockAnimations).toHaveLength(1);
  await settle();
  expect(counter()).toBe(2);
  expect(image(2)).toBe(cached);
  expect(mockMount.mock.calls.flat().filter(id => id === 'room-photo-2')).toHaveLength(1);
  expect(screen.getAllByTestId('photo-pan', { includeHiddenElements: true })).toHaveLength(3);
});

test('a failed save during a slow successor restores the outgoing card and counter', async () => {
  let failWrite!: () => void;
  mockSave.mockImplementationOnce(() => new Promise<void>((_, reject) => { failWrite = () => reject(new Error('Disk full')); }));
  await openGallery();
  await display(1);
  await release(130);
  expect(mockAnimations).toHaveLength(0);
  await act(() => failWrite());
  expect(mockAnimations).toHaveLength(1);
  expect(mockAnimations[0].target).toBe(0);
  await settle();
  expect(counter()).toBe(1);
  expect(screen.getByText(errorText('STORAGE_ERROR', 'tk'))).toBeOnTheScreen();
  await display(2);
  await release(-130);
  await settle();
  expect(counter()).toBe(2);
});

test.each([['ru', 5], ['tk', 5], ['ru', 24], ['tk', 24]] as const)('the first photo has neither opening hint in %s with %i photos', async (language, count) => {
  await openGallery(count, [], language);
  expect(screen.queryByText(/Результат после|Netije (soňky suratdan|20 saýlawdan) soň/)).toBeNull();
  expect(image(1).props.contentFit).toBe('contain');
  expect(image(2).props.contentFit).toBe('contain');
});

test.each([
  ['android', 320, 568, 12, false, 2],
  ['android', 568, 320, 12, true, 2],
  ['ios', 844, 390, 24, true, 1.8],
  ['ios', 768, 1024, 24, false, 1.8],
  ['android', 1024, 768, 24, false, 1.8],
  ['android', 1280, 800, 24, false, 1.8],
] as const)('gallery controls use the available space on %s at %i × %i', async (os, width, height, margin, compact, fontScale) => {
  const platform = jest.replaceProperty(Platform, 'OS', os);
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height, fontScale, scale: 2 });
  try {
    await openGallery(24, Array<Choice>(20).fill('like'));
    await display(21);
    const toolbar = screen.getByRole('header').parent!.parent!;
    expect(StyleSheet.flatten(toolbar.parent!.props.style)).toMatchObject({ gap: 8, paddingHorizontal: margin });
    expect(!!within(toolbar).queryByRole('button', { name: 'Soňky saýlawy yza gaýtarmak' })).toBe(compact);
    expect(!!within(toolbar).queryByRole('button', { name: 'Deslapky netijäni görmek' })).toBe(compact);
    const deck = screen.getByTestId('photo-pan').parent!.parent!;
    expect(StyleSheet.flatten(deck.props.style)).toMatchObject({ flex: 1, overflow: 'hidden' });
    expect(within(deck).queryByRole('progressbar')).toBeNull();
    expect(within(deck).queryAllByRole('button')).toHaveLength(0);
  } finally {
    dimensions.mockRestore();
    platform.restore();
  }
});
