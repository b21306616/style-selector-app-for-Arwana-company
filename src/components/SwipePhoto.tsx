import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Choice, Language, Photo } from '../domain/types';
import { PhotoImage } from './PhotoImage';
import { colors, tx } from './ui';

export interface SwipePhotoProps {
  photo: Photo;
  nextPhoto?: Photo;
  language: Language;
  height: number;
  enabled: boolean;
  onChoice: (choice: Choice) => void;
  onReady: () => void;
  onFailure: () => void;
  label: string;
}

export interface SwipePhotoHandle {
  swipe: (choice: Choice) => boolean;
}

export const SwipePhoto = forwardRef<SwipePhotoHandle, SwipePhotoProps>(function SwipePhoto(
  { photo, nextPhoto, language, height, enabled, onChoice, onReady, onFailure, label },
  ref
) {
  const { width: windowWidth } = useWindowDimensions();
  const exitDistance = Math.max(windowWidth * 1.3, 520);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const isCommitted = useSharedValue(false);
  const reduceMotion = useReducedMotion();

  const gesture = usePanGesture({
    enabled,
    activeOffsetX: [-12, 12],
    failOffsetY: [-36, 36],
    maxPointers: 1,
    onUpdate: (event) => {
      'worklet';
      if (!isCommitted.value) {
        x.value = event.translationX;
        y.value = event.translationY * 0.18;
      }
    },
    onDeactivate: (event) => {
      'worklet';
      if (isCommitted.value) return;
      const isQuickFlick = Math.abs(event.translationX) > 28 && Math.abs(event.velocityX) > 600;
      const isPastThreshold = Math.abs(event.translationX) > 85;

      if (!event.canceled && (isPastThreshold || isQuickFlick)) {
        isCommitted.value = true;
        const choice: Choice = event.translationX > 0 ? 'like' : 'dislike';
        const targetX = choice === 'like' ? exitDistance : -exitDistance;
        const targetY = Math.max(-150, Math.min(150, event.translationY * 0.35 + (event.velocityY * 0.04)));

        if (reduceMotion) {
          x.value = targetX;
          scheduleOnRN(onChoice, choice);
        } else {
          y.value = withTiming(targetY, { duration: 240, easing: Easing.out(Easing.quad) });
          x.value = withTiming(
            targetX,
            { duration: 240, easing: Easing.out(Easing.quad) },
            (finished) => {
              'worklet';
              if (finished) {
                scheduleOnRN(onChoice, choice);
              }
            }
          );
        }
      } else {
        if (reduceMotion) {
          x.value = 0;
          y.value = 0;
        } else {
          x.value = withSpring(0, { damping: 18, stiffness: 220 });
          y.value = withSpring(0, { damping: 18, stiffness: 220 });
        }
      }
    },
    onFinalize: () => {
      'worklet';
      if (!isCommitted.value) {
        if (reduceMotion) {
          x.value = 0;
          y.value = 0;
        } else {
          x.value = withSpring(0, { damping: 18, stiffness: 220 });
          y.value = withSpring(0, { damping: 18, stiffness: 220 });
        }
      }
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      swipe: (choice: Choice) => {
        if (isCommitted.value || !enabled) return false;
        isCommitted.value = true;
        const targetX = choice === 'like' ? exitDistance : -exitDistance;
        if (reduceMotion) {
          x.value = targetX;
          scheduleOnRN(onChoice, choice);
        } else {
          y.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
          x.value = withTiming(
            targetX,
            { duration: 240, easing: Easing.out(Easing.quad) },
            (finished) => {
              'worklet';
              if (finished) {
                scheduleOnRN(onChoice, choice);
              }
            }
          );
        }
        return true;
      },
    }),
    [enabled, exitDistance, isCommitted, onChoice, reduceMotion, x, y]
  );

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotateDeg = reduceMotion ? 0 : x.value / 25;
    const opacity = interpolate(
      Math.abs(x.value),
      [0, exitDistance * 0.45, exitDistance * 0.85],
      [1, 1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: reduceMotion ? 0 : x.value },
        { translateY: reduceMotion ? 0 : y.value },
        { rotate: `${rotateDeg}deg` },
      ],
      opacity,
    };
  });

  const likeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(x.value, [10, 80], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(x.value, [10, 120], [0.85, 1.05], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ rotate: '-8deg' }, { scale }],
    };
  });

  const dislikeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(-x.value, [10, 80], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(-x.value, [10, 120], [0.85, 1.05], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ rotate: '8deg' }, { scale }],
    };
  });

  const backCardAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const progress = interpolate(Math.abs(x.value), [0, 140], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(progress, [0, 1], [0.94, 1.0]);
    const translateY = interpolate(progress, [0, 1], [12, 0]);
    const opacity = interpolate(progress, [0, 1], [0.85, 1.0]);
    return {
      transform: [{ scale }, { translateY }],
      opacity,
    };
  });

  const backOverlayStyle = useAnimatedStyle(() => {
    const progress = interpolate(Math.abs(x.value), [0, 140], [0, 1], Extrapolation.CLAMP);
    return {
      backgroundColor: 'rgba(0, 0, 0, 0.08)',
      opacity: 1 - progress,
    };
  });

  return (
    <View style={[styles.stage, { height }]}>
      <Animated.View style={[styles.backCard, backCardAnimatedStyle]}>
        {nextPhoto ? (
          <PhotoImage
            photo={nextPhoto}
            language={language}
            fit="contain"
            style={styles.photo}
          />
        ) : (
          <View style={styles.emptyBackCard} />
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backOverlayStyle]} />
      </Animated.View>
      <GestureDetector gesture={gesture} touchAction="pan-y">
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          <PhotoImage
            photo={photo}
            language={language}
            fit="contain"
            style={styles.photo}
            label={label}
            onReady={onReady}
            onFailure={onFailure}
          />
          <Animated.View pointerEvents="none" style={[styles.badge, styles.like, likeStyle]}>
            <Text style={styles.badgeText}>{tx(language, 'HALADYM', 'НРАВИТСЯ')}</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.badge, styles.dislike, dislikeStyle]}>
            <Text style={styles.badgeText}>{tx(language, 'MAŇA DÄL', 'НЕ МОЁ')}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: { width: '100%', paddingBottom: 10, paddingHorizontal: 6 },
  backCard: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    bottom: 10,
    borderRadius: 22,
    backgroundColor: '#DADFCF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyBackCard: {
    flex: 1,
    backgroundColor: '#DADFCF',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: { flex: 1, backgroundColor: '#ECEAE2' },
  badge: {
    position: 'absolute',
    top: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  like: { left: 20, backgroundColor: colors.green, transform: [{ rotate: '-8deg' }] },
  dislike: { right: 20, backgroundColor: colors.danger, transform: [{ rotate: '8deg' }] },
  badgeText: { fontSize: 14, letterSpacing: 1, fontWeight: '700', color: colors.white },
});
