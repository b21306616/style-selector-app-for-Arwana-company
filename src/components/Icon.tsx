import { useFonts } from 'expo-font';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import regular from 'expo-symbols/androidWeights/regular';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../ui/theme';

const symbols = {
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  next: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  heart: { ios: 'heart', android: 'favorite', web: 'favorite' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  up: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  down: { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  expand: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  collapse: { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
} satisfies Record<string, SymbolViewProps['name']>;
export type IconName = keyof typeof symbols;
const IconsReady = createContext(Platform.OS === 'ios');
const fonts = Platform.OS === 'ios' ? {} : { [regular.name]: regular.font };

/** Load the local symbol font once. Text remains usable if loading fails. */
export function IconProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts(fonts);
  return <IconsReady.Provider value={Platform.OS === 'ios' || (loaded && !error)}>{children}</IconsReady.Provider>;
}

export function Icon({ name, color = colors.green, size = 24, fallback = '' }: { name: IconName; color?: string; size?: number; fallback?: string }) {
  const ready = useContext(IconsReady);
  const { fontScale } = useWindowDimensions();
  // Android SymbolView renders a scaling Text inside a fixed-size View. Keep the
  // glyph inside that View at enlarged text sizes; fallback labels still scale.
  const symbolSize = Platform.OS === 'android' ? size / fontScale : size;
  return ready ? <SymbolView name={symbols[name]} tintColor={color} size={symbolSize} style={{ width: size, height: size }} accessible={false} fallback={<Text style={{ color }}>{fallback}</Text>} />
    : <Text accessible={false} style={{ color, fontSize: 13, textAlign: 'center', flexShrink: 1 }}>{fallback}</Text>;
}

export function IconButton({ icon, label, fallbackLabel = label, onPress, disabled = false, loading = false, selected, prominent = false, style }: {
  icon: IconName; label: string; fallbackLabel?: string; onPress: () => void; disabled?: boolean; loading?: boolean; selected?: boolean; prominent?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const ready = useContext(IconsReady);
  const color = prominent ? colors.white : colors.green;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading, selected }} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [styles.button, prominent && styles.prominent, !ready && styles.textButton, (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}>
    {loading ? <ActivityIndicator color={color} /> : <Icon name={icon} color={color} size={prominent ? 30 : 24} fallback={fallbackLabel} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, padding: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  textButton: { maxWidth: 180 }, prominent: { backgroundColor: colors.green, borderColor: colors.green }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
});
