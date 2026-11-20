import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Language, Photo } from '../domain/types';
import { colors, typography } from '../ui/theme';
import { tx } from '../ui/copy';
import { Icon } from './Icon';
import { PhotoImage } from './PhotoImage';

export function PhotoTile({ photo, language, title, subtitle, label, badge, selected, disabled = false, thumbnail = true, onPress, style, imageStyle }: {
  photo?: Photo; language: Language; title?: string; subtitle?: string; label: string; badge?: string; selected?: boolean; disabled?: boolean; thumbnail?: boolean; onPress: () => void; style?: StyleProp<ViewStyle>; imageStyle?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.tile, selected && styles.selected, disabled && { opacity: 0.55 }, pressed && { opacity: 0.75 }, style]}>
    <View>
      {photo ? <PhotoImage photo={photo} language={language} thumbnail={thumbnail} style={[styles.image, imageStyle]} /> : <View style={[styles.image, styles.placeholder, imageStyle]}><Text style={typography.small}>{tx(language, 'No photos', 'Нет фото')}</Text></View>}
      {badge || selected !== undefined ? <View pointerEvents="none" style={[styles.badge, selected && styles.selectedBadge]}>
        {selected !== undefined ? <Icon name={selected ? 'check' : 'add'} size={20} color={selected ? colors.white : colors.green} fallback={selected ? '✓' : '+'} /> : null}
        {badge ? <Text style={[styles.badgeText, selected && { color: colors.white }]}>{badge}</Text> : null}
      </View> : null}
    </View>
    {title || subtitle ? <View style={styles.caption}>{title ? <Text style={styles.title}>{title}</Text> : null}{subtitle ? <Text style={typography.small}>{subtitle}</Text> : null}</View> : null}
  </Pressable>;
}

export function PhotoStrip({ photos, language }: { photos: Photo[]; language: Language }) {
  return <View style={styles.strip}>{photos.length ? photos.slice(0, 4).map(photo => <PhotoImage key={photo.id} photo={photo} thumbnail language={language} style={styles.stripPhoto} />) : <View style={[styles.stripPhoto, styles.placeholder]}><Text style={typography.small}>{tx(language, 'No photos selected', 'Фотографии не выбраны')}</Text></View>}</View>;
}

const styles = StyleSheet.create({
  tile: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: colors.green }, image: { width: '100%', aspectRatio: 1.5 }, placeholder: { backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', padding: 12 },
  caption: { paddingHorizontal: 12, paddingVertical: 10, gap: 3 }, title: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  badge: { position: 'absolute', top: 8, right: 8, minHeight: 32, minWidth: 32, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedBadge: { backgroundColor: colors.green }, badgeText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.ink },
  strip: { flexDirection: 'row', gap: 6, overflow: 'hidden', borderRadius: 12 }, stripPhoto: { flex: 1, aspectRatio: 1.25, maxHeight: 160 },
});
