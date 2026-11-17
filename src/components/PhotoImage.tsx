import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Language, Photo } from '../domain/types';
import { photoSource } from '../storage/images';
import { colors, tx } from './ui';

export function PhotoImage({ photo, thumbnail = false, language, label, style, fit = 'cover', onReady, onFailure }: {
  photo: Photo; thumbnail?: boolean; language: Language; label?: string; style?: StyleProp<ViewStyle>; fit?: ImageProps['contentFit']; onReady?: () => void; onFailure?: () => void;
}) {
  const sourceKey = photo.image.kind === 'bundled' ? `${photo.image.key}-${thumbnail}` : thumbnail ? photo.image.thumbnail : photo.image.file;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceKey;
  return <View style={[styles.container, style]}>
    {failed ? <View style={styles.fallback}><Text style={styles.error}>{tx(language, 'This photo could not be opened.', 'Не удалось открыть фотографию.')}</Text></View> : <Image source={photoSource(photo, thumbnail)} style={StyleSheet.absoluteFill} contentFit={fit} cachePolicy="none" recyclingKey={sourceKey} allowDownscaling transition={0} accessibilityLabel={label} accessible={!!label} onLoad={onReady} onError={() => { setFailedSource(sourceKey); onFailure?.(); }} />}
  </View>;
}
const styles = StyleSheet.create({ container: { backgroundColor: colors.sand, overflow: 'hidden' }, fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, error: { fontSize: 14, textAlign: 'center', color: colors.muted } });
