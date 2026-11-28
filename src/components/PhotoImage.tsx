import { Image, type ImageProps } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Language, Photo } from '../domain/types';
import { photoSource } from '../storage/images';
import { colors, tx } from './ui';

export function PhotoImage({ photo, thumbnail = false, language, label, style, fit = 'cover', onReady, onDisplay, onFailure }: {
  photo: Photo; thumbnail?: boolean; language: Language; label?: string; style?: StyleProp<ViewStyle>; fit?: ImageProps['contentFit']; onReady?: () => void; onDisplay?: () => void; onFailure?: () => void;
}) {
  const source = useMemo(() => photoSource(photo, thumbnail), [photo, thumbnail]);
  const sourceKey = photo.image.kind === 'bundled' ? `${photo.image.key}-${thumbnail}` : thumbnail ? photo.image.thumbnail : photo.image.file;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = !source || failedSource === sourceKey;
  useEffect(() => { if (!source) onFailure?.(); }, [source, onFailure]);
  return <View style={[styles.container, style]}>
    {failed ? <View style={styles.fallback}><Text style={styles.error}>{tx(language, 'Bu suraty açyp bolmady.', 'Не удалось открыть фотографию.')}</Text></View> : <Image source={source} style={StyleSheet.absoluteFill} contentFit={fit} cachePolicy="none" recyclingKey={sourceKey} allowDownscaling transition={0} loading="eager" accessibilityLabel={label} accessible={!!label} onLoad={onReady} onDisplay={onDisplay} onError={() => { setFailedSource(sourceKey); onFailure?.(); }} />}
  </View>;
}
const styles = StyleSheet.create({ container: { backgroundColor: colors.sand, overflow: 'hidden' }, fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, error: { fontSize: 14, textAlign: 'center', color: colors.muted } });
