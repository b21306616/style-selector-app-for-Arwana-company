import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, clamp, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Choice, Language, Photo } from '../domain/types';
import { PhotoImage } from './PhotoImage';
import { Button, colors, tx, typography } from './ui';

export interface DeckMotion {
  kind: 'vote' | 'undo' | 'entrance' | 'restore';
  from: number;
  choice: Choice;
  velocity: number;
}

interface SwipePhotoProps {
  previousPhoto?: Photo;
  photo: Photo;
  nextPhoto?: Photo;
  language: Language;
  label: string;
  disabled: boolean;
  complete: boolean;
  motion: DeckMotion | null;
  saved: boolean;
  onChoice: (id: string, choice: Choice, velocity: number) => boolean;
  onSettled: (motion: DeckMotion) => void;
}

type LoadStatus = 'loading' | 'ready' | 'failed';
interface CardImage { photo: Photo; status: LoadStatus; attempt: number }
const newImage = (photo: Photo): CardImage => ({ photo, status: 'loading', attempt: 0 });
const spring = { mass: 0.65, stiffness: 340, damping: 28, overshootClamping: true, energyThreshold: 0.000001 };

export function SwipePhoto({ previousPhoto, photo, nextPhoto, language, label, disabled, complete, motion, saved, onChoice, onSettled }: SwipePhotoProps) {
  const windowSize = useWindowDimensions();
  const [size, setSize] = useState({ width: windowSize.width, height: windowSize.height });
  const photos = useMemo(() => [previousPhoto, photo, nextPhoto].filter((item): item is Photo => !!item), [previousPhoto, photo, nextPhoto]);
  const [images, setImages] = useState(() => ({ photos, cards: photos.map(newImage) }));
  if (images.photos !== photos) {
    // Reconcile before drawing. A promoted card keeps both its native view and its display status.
    setImages({ photos, cards: photos.map(item => images.cards.find(card => card.photo === item) ?? newImage(item)) });
  }
  const updateImage = useCallback((image: CardImage, status: LoadStatus) => {
    setImages(current => {
      if (image.status === status || !current.cards.includes(image)) return current;
      return { ...current, cards: current.cards.map(card => card === image
        ? { ...card, status, attempt: card.attempt + (status === 'loading' ? 1 : 0) } : card) };
    });
  }, []);
  const next = images.cards.find(card => card.photo === nextPhoto);
  const nextReady = next ? next.status !== 'loading' : saved;

  return <View style={styles.stage} onLayout={({ nativeEvent: { layout } }) => {
    const { width, height } = layout;
    if (width > 0 && height > 0) setSize(current => current.width === width && current.height === height ? current : { width, height });
  }}>
    {images.cards.map(image => {
      const current = image.photo === photo;
      const previous = image.photo === previousPhoto;
      const handlesMotion = motion?.kind === 'undo' ? previous : current;
      const canAnimate = motion?.kind === 'vote' ? nextReady : image.status !== 'loading' && (motion?.kind !== 'undo' || saved);
      return <SwipeCard key={image.photo.id} image={image} current={current} previous={previous}
        label={current ? label : undefined} language={language} enabled={current && !disabled && image.status === 'ready'}
        complete={complete} motion={handlesMotion ? motion : null} nextReady={nextReady} canAnimate={canAnimate}
        width={size.width} distance={size.width + size.height * 0.06 + 4} onChoice={onChoice} onSettled={onSettled} updateImage={updateImage} />;
    })}
  </View>;
}

interface SwipeCardProps extends Pick<SwipePhotoProps, 'language' | 'complete' | 'motion' | 'onChoice' | 'onSettled'> {
  image: CardImage;
  current: boolean;
  previous: boolean;
  label?: string;
  enabled: boolean;
  nextReady: boolean;
  canAnimate: boolean;
  width: number;
  distance: number;
  updateImage: (image: CardImage, status: LoadStatus) => void;
}

function SwipeCard({ image, current, previous, label, language, enabled, complete, motion, nextReady, canAnimate, width, distance, onChoice, onSettled, updateImage }: SwipeCardProps) {
  const reduceMotion = useReducedMotion() === true;
  const x = useSharedValue(0);
  const entry = useSharedValue(0);
  const committed = useSharedValue(false);
  const dragStart = useSharedValue({ offset: 0, waiting: false });
  const returning = motion?.kind === 'undo' || motion?.kind === 'entrance';
  const origin = motion?.choice === 'like' ? distance : -distance;

  useLayoutEffect(() => {
    if (!motion) {
      committed.set(false);
      entry.set(0);
      if (!complete) x.set(0);
    }
  }, [motion, current, complete, committed, entry, x]);

  useEffect(() => {
    if (!motion || !canAnimate) return;
    const value = returning ? entry : x;
    const target = returning ? 1 : motion.kind === 'vote' ? origin : 0;
    const done = () => onSettled(motion);
    if (reduceMotion) {
      value.set(target);
      done();
      return;
    }
    const velocity = motion.kind === 'vote' ? clamp(motion.velocity * Math.sign(origin), 0, 2600) * Math.sign(origin) : 0;
    value.set(withSpring(target, { ...spring, velocity }, finished => {
      'worklet';
      if (finished) scheduleOnRN(done);
    }));
    return () => cancelAnimation(value);
  }, [motion, canAnimate, returning, entry, x, origin, reduceMotion, onSettled]);

  const requestVote = (choice: Choice, velocity: number) => {
    if (!enabled || !onChoice(image.photo.id, choice, velocity)) {
      committed.set(false);
      x.set(reduceMotion ? 0 : withSpring(0, spring));
    }
  };
  const threshold = clamp(width * 0.23, 56, 100);
  const gesture = usePanGesture({
    enabled, activeOffsetX: [-12, 12], failOffsetY: [-36, 36], maxPointers: 1,
    onActivate: () => {
      'worklet';
      if (committed.get()) return;
      cancelAnimation(x);
      dragStart.set({ offset: x.get(), waiting: !nextReady });
    },
    onUpdate: event => {
      'worklet';
      if (committed.get() || reduceMotion) return;
      // Keep the same resistance under the finger if decoding finishes during a drag.
      const start = dragStart.get();
      const limit = width * 0.45;
      const travel = start.waiting ? limit * Math.tanh(event.translationX / Math.max(limit, 1)) : event.translationX;
      x.set(start.offset + travel);
    },
    onDeactivate: event => {
      'worklet';
      if (committed.get()) return;
      const { translationX, velocityX } = event;
      const flick = Math.abs(translationX) > 28 && Math.sign(translationX) * velocityX > 600;
      if (!event.canceled && (Math.abs(translationX) > threshold || flick)) {
        committed.set(true);
        scheduleOnRN(requestVote, translationX > 0 ? 'like' : 'dislike', velocityX);
      } else {
        x.set(reduceMotion ? 0 : withSpring(0, { ...spring, velocity: event.canceled ? 0 : velocityX }));
      }
    },
  });
  const hidden = !returning && !current && previous;
  const movement = useAnimatedStyle(() => {
    const offset = returning ? origin * (1 - entry.get()) : current ? x.get() : 0;
    const tilt = reduceMotion ? 0 : clamp(offset / Math.max(width, 1) * 6, -6, 6);
    return { opacity: hidden ? 0 : 1, transform: [{ translateX: offset }, { rotate: `${tilt}deg` }] };
  });
  const likeBadge = useAnimatedStyle(() => ({ opacity: clamp((x.get() - 12) / 58, 0, 1) }));
  const dislikeBadge = useAnimatedStyle(() => ({ opacity: clamp((-x.get() - 12) / 58, 0, 1) }));
  return <View pointerEvents={current ? 'box-none' : 'none'} accessibilityElementsHidden={!current} importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
    style={[StyleSheet.absoluteFill, returning ? styles.returning : current ? styles.active : previous ? styles.parked : styles.upcoming]}>
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <Animated.View style={[styles.card, movement]}>
        {image.status === 'failed' ? <View style={styles.failure}>
          <Text style={[typography.small, styles.failureText]}>{tx(language, 'Surat elýeterli däl. Saýlaw ýazga geçirilmedi.', 'Фото недоступно. Выбор не записан.')}</Text>
          <Button title={tx(language, 'Suraty täzeden açmak', 'Открыть ещё раз')} variant="secondary" disabled={!current || !!motion} onPress={() => updateImage(image, 'loading')} />
        </View> : <PhotoImage key={image.attempt} photo={image.photo} language={language} label={label} fit="contain" style={styles.photo}
          onDisplay={() => updateImage(image, 'ready')} onFailure={() => updateImage(image, 'failed')} />}
        {current && !returning && image.status === 'ready' && !reduceMotion ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.badge, styles.like, likeBadge]}><Text style={styles.badgeText}>{tx(language, 'HALADYM', 'НРАВИТСЯ')}</Text></Animated.View>
          <Animated.View style={[styles.badge, styles.dislike, dislikeBadge]}><Text style={styles.badgeText}>{tx(language, 'MAŇA DÄL', 'НЕ МОЁ')}</Text></Animated.View>
        </View> : null}
      </Animated.View>
    </GestureDetector>
    {current && image.status === 'loading' ? <View pointerEvents="none" style={styles.spinner}>
      <ActivityIndicator accessibilityLabel={tx(language, 'Surat açylýar', 'Открываем фото')} color={colors.green} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.background },
  card: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, justifyContent: 'center' },
  active: { zIndex: 2 }, returning: { zIndex: 3 }, upcoming: { zIndex: 1 }, parked: { zIndex: 0 },
  photo: { flex: 1, backgroundColor: colors.background },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  failure: { alignItems: 'center', gap: 8, padding: 8 }, failureText: { textAlign: 'center' },
  badge: { position: 'absolute', top: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  like: { left: 12, backgroundColor: colors.green }, dislike: { right: 12, backgroundColor: colors.danger },
  badgeText: { color: colors.white, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
