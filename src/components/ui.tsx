import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, useLayout } from '../ui/theme';
import { IconButton } from './Icon';
export { colors, typography, useLayout } from '../ui/theme';
export { tx, spaceLabel, photoRoomLabel, optionLabel, photoCount, errorText } from '../ui/copy';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const { padding } = useLayout();
  const content = [styles.content, { paddingHorizontal: padding }, style];
  return <KeyboardAvoidingView behavior="padding" style={styles.safe}>
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[content, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  </KeyboardAvoidingView>;
}
export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, accessibilityLabel }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; loading?: boolean; icon?: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const dark = variant === 'primary' || variant === 'danger';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [styles.button, variant === 'primary' && styles.primary, variant === 'secondary' && styles.secondary, variant === 'danger' && styles.danger, variant === 'ghost' && styles.ghost, (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}>
    {loading ? <ActivityIndicator color={dark ? colors.white : colors.green} /> : icon ? <Text accessible={false} style={[styles.buttonIcon, dark && styles.lightText]}>{icon}</Text> : null}
    <Text style={[styles.buttonText, dark && styles.lightText]}>{title}</Text>
  </Pressable>;
}
export function TextField({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} {...props} /></View>;
}
export function Chip({ label, selected = false, onPress, style, disabled = false }: { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return onPress ? <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.chip, styles.chipTouch, selected && styles.chipSelected, disabled && styles.disabled, pressed && styles.pressed, style]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>
    : <View style={[styles.chip, selected && styles.chipSelected, style]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></View>;
}
export function Header({ title = 'ARWANA', subtitle, back, right }: { title?: string; subtitle?: string; back?: { label: string; onPress: () => void }; right?: ReactNode }) {
  return <View style={styles.header}>
    <View style={styles.headerLeft}>{back ? <IconButton icon="back" label={back.label} onPress={back.onPress} /> : <><Text accessibilityRole={title === 'ARWANA' ? undefined : 'header'} style={title === 'ARWANA' ? styles.wordmark : typography.subheading}>{title}</Text>{subtitle ? <Text style={styles.brandCaption}>{subtitle}</Text> : null}</>}</View>
    {right ? <View style={styles.headerRight}>{right}</View> : null}
  </View>;
}
export function ErrorBanner({ message, onRetry, retryLabel = 'Gaýtalamak / Повторить' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return <View style={styles.error} accessibilityRole="alert"><Text style={[typography.small, { color: colors.danger }]}>{message}</Text>{onRetry ? <Button title={retryLabel} variant="secondary" onPress={onRetry} /> : null}</View>;
}
export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <View style={styles.empty}><Text style={typography.heading}>{title}</Text><Text style={[typography.body, { textAlign: 'center' }]}>{description}</Text>{children}</View>;
}
export const uiStyles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 24, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  stack: { gap: 16 },
  section: { gap: 16, marginBottom: 24 },
});
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 1248, alignSelf: 'center', paddingTop: 8, paddingBottom: 16, gap: 16 },
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'transparent' },
  primary: { backgroundColor: colors.green }, secondary: { backgroundColor: colors.surface, borderColor: colors.border }, danger: { backgroundColor: colors.danger }, ghost: { backgroundColor: 'transparent', paddingHorizontal: 8 },
  buttonText: { fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center', color: colors.ink, flexShrink: 1 }, buttonIcon: { fontSize: 22, color: colors.ink }, lightText: { color: colors.white }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  field: { gap: 8 }, label: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.ink }, input: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.ink, backgroundColor: colors.surface, fontSize: 16 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.sand, borderWidth: 1, borderColor: 'transparent' }, chipTouch: { minHeight: 48, justifyContent: 'center' }, chipSelected: { backgroundColor: colors.greenSoft, borderColor: '#B9CBB8' }, chipText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '500' }, chipTextSelected: { color: colors.green },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }, headerLeft: { flexShrink: 1 }, headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, wordmark: { fontSize: 25, fontWeight: '600', letterSpacing: 6, color: colors.ink }, brandCaption: { fontSize: 9, lineHeight: 16, letterSpacing: 2.3, color: colors.muted, marginTop: 2 }, back: { paddingLeft: 0 },
  error: { padding: 16, borderRadius: 14, gap: 12, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#E8C2B8' }, empty: { alignItems: 'center', paddingVertical: 40, gap: 16 },
});
