import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { StaffAuthProvider, useStaffAuth } from '../src/features/staff/auth-context';
import { staffStatus, unlockStaff } from '../src/storage/staff-auth';

jest.mock('../src/storage/staff-auth', () => ({ staffStatus: jest.fn(), unlockStaff: jest.fn(), setupStaff: jest.fn(), recoverStaff: jest.fn() }));
let background: (state: AppStateStatus) => void;
beforeEach(() => {
  jest.mocked(staffStatus).mockResolvedValue({ configured: true, blockedUntil: 0 });
  jest.mocked(unlockStaff).mockResolvedValue(undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    background = listener;
    return { remove: jest.fn() };
  });
});

test('backgrounding locks an unlocked staff workspace', async () => {
  const { result } = await renderHook(() => useStaffAuth(), { wrapper: StaffAuthProvider });
  await act(async () => { await result.current.unlock('123456'); });
  expect(result.current.unlocked).toBe(true);
  expect(result.current.isUnlocked()).toBe(true);
  await act(async () => {
    background('background');
    // Async imports must see the lock immediately, before React rerenders the gate.
    expect(result.current.isUnlocked()).toBe(false);
  });
  expect(result.current.unlocked).toBe(false);
});

test('an unlock that completes after backgrounding cannot reopen staff access', async () => {
  let complete!: () => void;
  jest.mocked(unlockStaff).mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
  const { result } = await renderHook(() => useStaffAuth(), { wrapper: StaffAuthProvider });
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.unlock('123456'); });
  await act(async () => { background('background'); });
  await act(async () => { complete(); await pending; });
  expect(result.current.unlocked).toBe(false);
});
