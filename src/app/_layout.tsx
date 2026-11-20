import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/AppProvider';
import { StaffAuthProvider } from '../features/staff/auth-context';
import { Button, colors, typography } from '../components/ui';
import { messageForError } from '../domain/errors';
import { IconProvider } from '../components/Icon';

function AppContent() {
  const { ready, error, refresh, language } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 24, backgroundColor: colors.background }}>
    <Text style={[typography.heading, { letterSpacing: 5 }]}>ARWANA</Text>
    {error ? <><Text style={[typography.body, { textAlign: 'center' }]}>{messageForError(error, language)}</Text><Button title="Повторить / Gaýtalamak" onPress={() => void refresh()} /></> : <ActivityIndicator color={colors.green} />}
  </View>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider><IconProvider><AppProvider><StaffAuthProvider>
        <StatusBar style="dark" />
        <AppContent />
      </StaffAuthProvider></AppProvider></IconProvider></SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
