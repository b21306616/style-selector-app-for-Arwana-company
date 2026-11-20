import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Language } from '../domain/types';
import { AppModal } from './AppModal';
import { Button, colors, typography, tx } from './ui';

export function ConfirmDialog({ visible, title, description, confirmLabel, cancelLabel, onConfirm, onCancel, language, loading = false }: {
  visible: boolean; title: string; description: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; language: Language; loading?: boolean;
}) {
  const cancel = () => { if (!loading) onCancel(); };
  return <AppModal testID="confirmation-dialog" visible={visible} transparent animationType="fade" onRequestClose={cancel}>
    <SafeAreaView style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable accessible={false} onPress={cancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.panel}>
          <Text accessibilityRole="header" style={typography.heading}>{title}</Text><Text style={typography.body}>{description}</Text>
          <Button title={confirmLabel} onPress={onConfirm} loading={loading} />
          <Button title={cancelLabel ?? tx(language, 'Saýlamagy dowam etmek', 'Продолжить сеанс')} onPress={cancel} variant="ghost" disabled={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  </AppModal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: colors.overlay }, scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }, panel: { width: '100%', maxWidth: 440, padding: 20, gap: 16, borderRadius: 24, backgroundColor: colors.surface } });
