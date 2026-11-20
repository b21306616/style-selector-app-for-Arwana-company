import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Choice, Language, Photo } from '../domain/types';
import { PhotoImage } from './PhotoImage';
import { colors, tx } from './ui';

export function SwipePhoto({ photo, language, height, enabled, onChoice, onReady, onFailure, label }: {
  photo: Photo; language: Language; height: number; enabled: boolean; onChoice: (choice: Choice) => void; onReady: () => void; onFailure: () => void; label: string;
}) {
  const x = useSharedValue(0);
  const committed = useSharedValue(false);
  const reduceMotion = useReducedMotion();
  const gesture = usePanGesture({
    enabled,
    activeOffsetX: [-16, 16], failOffsetY: [-24, 24], maxPointers: 1,
    onUpdate: (event) => { 'worklet'; if (!committed.value) x.value = Math.max(-180, Math.min(180, event.translationX)); },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled && !committed.value && (Math.abs(event.translationX) > 85 || (Math.abs(event.translationX) > 28 && Math.abs(event.velocityX) > 650))) {
        committed.value = true;
        scheduleOnRN(onChoice, event.translationX > 0 ? 'like' : 'dislike');
      }
      x.value = withTiming(0, { duration: reduceMotion ? 0 : 180 });
    },
    onFinalize: () => { 'worklet'; x.value = withTiming(0, { duration: reduceMotion ? 0 : 180 }); },
  });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 0 : x.value }, { rotate: reduceMotion ? '0deg' : `${x.value / 30}deg` }] }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, x.value / 80)) }));
  const dislikeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, -x.value / 80)) }));
  return <View style={[styles.stage, { height }]}>
    <View style={styles.backCard} />
    <GestureDetector gesture={gesture} touchAction="pan-y"><Animated.View style={[styles.card, animatedStyle]}>
      <PhotoImage photo={photo} language={language} fit="contain" style={styles.photo} label={label} onReady={onReady} onFailure={onFailure} />
      <Animated.View pointerEvents="none" style={[styles.badge, styles.like, likeStyle]}><Text style={styles.badgeText}>{tx(language, 'HALADYM', 'НРАВИТСЯ')}</Text></Animated.View>
      <Animated.View pointerEvents="none" style={[styles.badge, styles.dislike, dislikeStyle]}><Text style={styles.badgeText}>{tx(language, 'MAŇA DÄL', 'НЕ МОЁ')}</Text></Animated.View>
    </Animated.View></GestureDetector>
  </View>;
}
const styles = StyleSheet.create({
  stage: { width: '100%', paddingBottom: 10, paddingHorizontal: 6 }, backCard: { position: 'absolute', bottom: 0, top: 15, left: 16, right: 16, borderRadius: 24, backgroundColor: '#DADFCF' },
  card: { width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, photo: { flex: 1, backgroundColor: '#ECEAE2' },
  badge: { position: 'absolute', top: 22, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: colors.white }, like: { left: 20, backgroundColor: colors.green, transform: [{ rotate: '-8deg' }] }, dislike: { right: 20, backgroundColor: colors.danger, transform: [{ rotate: '8deg' }] }, badgeText: { fontSize: 14, letterSpacing: 1, fontWeight: '700', color: colors.white },
});
