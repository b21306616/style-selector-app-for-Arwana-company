import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton, UndoIconButton } from '../components/Icon';
import { SwipePhoto, type DeckMotion } from '../components/SwipePhoto';
import { Button, EmptyState, ErrorBanner, Header, Screen, colors, errorText, sessionLabel, spaceLabel, tx, typography, useLayout } from '../components/ui';
import type { Choice, Session } from '../domain/types';
import { useApp } from '../state/AppProvider';

interface Transition {
  motion: DeckMotion;
  saved: boolean;
  animated: boolean;
}

export default function GalleryScreen() {
  const { session, language } = useApp();
  const { entrance } = useLocalSearchParams<{ entrance?: string | string[] }>();
  const side = Array.isArray(entrance) ? entrance[0] : entrance;
  useEffect(() => {
    if (side === 'like' || side === 'dislike') router.setParams({ entrance: '' });
  }, [side]);

  return <Screen scroll={false} style={styles.screen}>
    {session ? <SessionGallery key={session.id} session={session} entrance={side === 'like' || side === 'dislike' ? side : null} /> : <>
      <Header back={{ label: tx(language, 'Otaglar', 'Пространства'), onPress: () => router.replace('/') }} />
      <EmptyState title={tx(language, 'Otagy saýlaň', 'Выберите пространство')} description={tx(language, 'Interýerleri saýlap başlamak üçin otagy açyň.', 'Откройте комнату, чтобы начать выбор.')}>
        <Button title={tx(language, 'Otagy saýlamak', 'Выбрать пространство')} onPress={() => router.replace('/')} />
      </EmptyState>
    </>}
  </Screen>;
}

function SessionGallery({ session, entrance }: { session: Session; entrance: Choice | null }) {
  const { language, busy, error, rate, undo } = useApp();
  const { width, height } = useLayout();
  const compact = width > height && height < 500;
  const deck = session.catalog.galleries[session.space];
  const photos = useMemo(() => new Map(session.catalog.photos.map(photo => [photo.id, photo])), [session.catalog.photos]);
  const [transition, setTransition] = useState<Transition | null>(() => entrance && session.status === 'active'
    ? { motion: { kind: 'entrance', from: session.ratings.length, choice: entrance, velocity: 0 }, saved: true, animated: false }
    : null);
  const pending = useRef(transition);
  const [failure, setFailure] = useState<string | null>(null);
  const setPending = useCallback((value: Transition | null) => {
    pending.current = value;
    setTransition(value);
  }, []);
  const finish = useCallback((motion: DeckMotion, part: 'saved' | 'animated') => {
    const current = pending.current;
    if (current?.motion !== motion || current[part]) return;
    const next = { ...current, [part]: true };
    setPending(next.saved && next.animated ? null : next);
  }, [setPending]);
  const animationFinished = useCallback((motion: DeckMotion) => finish(motion, 'animated'), [finish]);

  // Keep the visible card and counter together even when SQLite finishes first.
  const position = Math.min(transition?.motion.from ?? session.ratings.length, deck.length - 1);
  const photo = photos.get(deck[position]);
  const complete = session.status === 'complete' && !transition;
  const locked = busy || !!transition || complete;
  const visibleId = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    visibleId.current = locked ? undefined : photo?.id;
    return () => { visibleId.current = undefined; };
  }, [locked, photo?.id]);
  useEffect(() => { if (complete) router.replace('/result'); }, [complete]);

  const start = (kind: 'vote' | 'undo', choice: Choice, velocity: number) => {
    if (pending.current || busy || session.status !== 'active' || (kind === 'undo' && position <= 0)) return false;
    const motion: DeckMotion = { kind, from: position, choice, velocity };
    setPending({ motion, saved: false, animated: false });
    setFailure(null);
    const save = kind === 'vote' ? rate(choice) : undo();
    void save.then(() => finish(motion, 'saved'), reason => {
      if (pending.current?.motion !== motion) return;
      setFailure(errorText(reason, language));
      setPending(kind === 'vote' ? { motion: { ...motion, kind: 'restore' }, saved: true, animated: false } : null);
    });
    return true;
  };
  const controls = <View style={styles.actions}>
    <UndoIconButton label={tx(language, 'Soňky saýlawy yza gaýtarmak', 'Отменить последний выбор')} fallbackLabel={tx(language, 'Yza gaýtarmak', 'Отменить')}
      disabled={locked || position <= 0} onPress={() => {
        const choice = session.ratings[position - 1]?.choice;
        if (choice) start('undo', choice, 0);
      }} />
    {position >= 20 ? <Button title={tx(language, 'Deslapky netijäni görmek', 'Предварительный результат')} variant="secondary"
      disabled={locked} onPress={() => router.replace('/result')} style={styles.resultButton} /> : null}
  </View>;

  return <>
    <View style={styles.toolbar}>
      <View style={styles.heading}>
        <IconButton icon="back" label={tx(language, 'Otaglar', 'Пространства')} fallbackLabel={tx(language, 'Yza', 'Назад')} disabled={locked} onPress={() => router.replace('/')} />
        <Text accessibilityRole="header" numberOfLines={2} style={[typography.subheading, styles.room]}>{sessionLabel(session, language)}</Text>
        <Text accessibilityRole="progressbar" accessibilityLiveRegion="polite" accessibilityLabel={tx(language, 'Interýer suraty', 'Фотография интерьера')}
          accessibilityValue={{ min: 1, max: deck.length, now: position + 1 }} style={styles.counter}>
          {position + 1}<Text style={styles.total}> / {deck.length}</Text>
        </Text>
      </View>
      {compact ? controls : null}
    </View>
    {failure || error ? <ErrorBanner message={failure ?? errorText(error, language)} /> : null}
    {photo ? <SwipePhoto previousPhoto={photos.get(deck[position - 1])} photo={photo} nextPhoto={photos.get(deck[position + 1])}
      language={language} disabled={locked} complete={complete} motion={transition?.motion ?? null} saved={transition?.saved ?? false}
      onChoice={(id, choice, velocity) => id === visibleId.current && start('vote', choice, velocity)} onSettled={animationFinished}
      label={spaceLabel(photo.room, language, session.catalog.rooms) + '. ' + tx(language, 'Interýer suraty', 'Фотография интерьера') + ' ' + (position + 1) + ' / ' + deck.length} />
      : <EmptyState title={tx(language, 'Surat elýeterli däl', 'Фото недоступно')} description={tx(language, 'Otaglara dolanyň we işgärden bu toplumy barlamagy haýyş ediň.', 'Вернитесь к комнатам и попросите сотрудника проверить подборку.')} />}
    {!compact ? controls : null}
  </>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: '100%', gap: 8, paddingTop: 8, paddingBottom: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  heading: { flexGrow: 1, flexShrink: 1, flexBasis: 225, flexDirection: 'row', alignItems: 'center', gap: 8 },
  room: { flex: 1 },
  counter: { fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '600', color: colors.green },
  total: { fontWeight: '500', color: colors.muted },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%', gap: 8 },
  resultButton: { flexShrink: 1 },
});
