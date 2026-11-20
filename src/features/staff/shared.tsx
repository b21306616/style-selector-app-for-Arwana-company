import { PropsWithChildren, type ReactNode } from 'react';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View, type FlatListProps } from 'react-native';
import { Header, Screen, tx, typography, colors } from '../../components/ui';
import { useApp } from '../../state/AppProvider';
import { Language, TermKind } from '../../domain/types';

export function kindLabel(kind: TermKind, language: Language) {
  const labels: Record<TermKind, [string, string]> = { style: ['Style', 'Стиль'], palette: ['Palette', 'Палитра'], material: ['Materials', 'Материалы'], detail: ['Details', 'Детали'] };
  return labels[kind][language === 'ru' ? 1 : 0];
}
export function StaffScreen({ children, title, description, scroll = true }: PropsWithChildren<{ title: string; description?: string; scroll?: boolean }>) {
  return <Screen scroll={scroll}>
    <StaffHeader title={title} description={description} />
    {children}
  </Screen>;
}

function StaffHeader({ title, description }: { title: string; description?: string }) {
  const { language } = useApp();
  return <View style={{ gap: 10 }}>
    <Header back={{ label: tx(language, 'Staff workspace', 'Кабинет сотрудника'), onPress: () => router.replace('/staff/dashboard') }} />
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={typography.heading}>{title}</Text>{description && <Text style={typography.body}>{description}</Text>}</View>
  </View>;
}

/** Scroll the heading with the form so short screens still have room for input. */
export function StaffList<T>({ title, header, ...props }: Omit<FlatListProps<T>, 'ListHeaderComponent'> & { title: string; header: ReactNode }) {
  return <Screen scroll={false}>
    <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} {...props} style={[{ flex: 1 }, props.style]}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}><StaffHeader title={title} />{header}</View>} />
  </Screen>;
}
export const staffStyles = StyleSheet.create({
  section: { gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
  label: { ...typography.small, fontWeight: '600', color: colors.ink },
  thumbnail: { width: 96, height: 80, borderRadius: 10 },
  line: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
});
