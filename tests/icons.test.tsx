import { afterEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';
import { IconButton, IconProvider } from '../src/components/Icon';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-symbols', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { SymbolView: () => React.createElement(View, { testID: 'native-symbol' }) };
});
afterEach(() => { jest.restoreAllMocks(); });

test('Android icon actions retain usable text when the local font fails', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(useFonts).mockReturnValue([false, new Error('font failed')]);
  const onPress = jest.fn();
  await render(<IconProvider><IconButton icon="undo" label="Undo last choice" fallbackLabel="Undo" onPress={onPress} /></IconProvider>);
  expect(screen.getByText('Undo')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Undo last choice' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('loaded icons retain their accessible name and disabled state', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(useFonts).mockReturnValue([true, null]);
  const onPress = jest.fn();
  await render(<IconProvider><IconButton icon="heart" label="Love it" onPress={onPress} disabled /></IconProvider>);
  expect(screen.queryByText('Love it')).not.toBeOnTheScreen();
  expect(screen.getByTestId('native-symbol')).toBeOnTheScreen();
  const button = screen.getByRole('button', { name: 'Love it' });
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
});
