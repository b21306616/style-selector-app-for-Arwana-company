import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StaffGate } from '../../features/staff/StaffGate';
import { useStaffAuth } from '../../features/staff/auth-context';
import { StaffWorkspaceProvider } from '../../features/staff/workspace-context';
import { StaffWorkspaceGuard } from '../../features/staff/StaffWorkspaceGuard';

export const unstable_settings = { anchor: 'dashboard' };

export default function StaffLayout() {
  const { lock } = useStaffAuth();
  useFocusEffect(useCallback(() => () => lock(), [lock]));
  return <StaffWorkspaceProvider><StaffWorkspaceGuard /><StaffGate><Stack screenOptions={{ headerShown: false }} /></StaffGate></StaffWorkspaceProvider>;
}
