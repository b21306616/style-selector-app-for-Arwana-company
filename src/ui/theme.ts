import { useContext } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export const colors = {
  background: '#F5F3EC', surface: '#FFFEFA', ink: '#26342F', muted: '#68716A',
  green: '#365D4B', greenSoft: '#E4EBDD', border: '#DDDCD2', sand: '#E9E3D6',
  white: '#FFFFFF', danger: '#9E4D3F', dangerSoft: '#F7E8E2', overlay: '#17251FE6',
};
export const typography = StyleSheet.create({
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: colors.green },
  title: { fontSize: 36, lineHeight: 43, fontWeight: '500', letterSpacing: -1.3, color: colors.ink },
  heading: { fontSize: 25, lineHeight: 32, fontWeight: '500', letterSpacing: -0.6, color: colors.ink },
  subheading: { fontSize: 18, lineHeight: 25, fontWeight: '600', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  small: { fontSize: 13, lineHeight: 19, color: colors.muted },
});
export function useLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const padding = width >= 600 ? 32 : 20;
  return { width, height, fontScale, padding, contentWidth: Math.min(width - (insets?.left ?? 0) - (insets?.right ?? 0) - padding * 2, 1200), tablet: width >= 600, wide: width >= 900 && fontScale < 1.5 };
}
