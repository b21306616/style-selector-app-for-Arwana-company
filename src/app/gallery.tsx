import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SwipePhoto } from '../components/SwipePhoto';
import { Button, EmptyState, ErrorBanner, Header, Screen, colors, errorText, spaceLabel, tx, typography, useLayout } from '../components/ui';
import type { Choice } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function GalleryScreen() {
  const app = useApp();
  const { session, language, busy } = app;
  const layout = useLayout();
  const lock = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState(false);
  const [retry, setRetry] = useState(0);
  const deck = session?.catalog.galleries[session.space] ?? [];
  const position = session?.ratings.length ?? 0;
  const photo = session?.catalog.photos.find(item => item.id === deck[position]);
  useEffect(() => { if (session?.status === 'complete') router.replace('/result'); }, [session?.status]);
  const vote = async (choice: Choice) => {
    if (lock.current || busy || !photo || loadedId !== photo.id || failedImage) return;
    lock.current = true; setFailure(null);
    try { await app.rate(choice); setLoadedId(null); }
    catch (error) { setFailure(errorText(error, language)); setRetry(value => value + 1); }
    finally { lock.current = false; }
  };
  const undo = async () => {
    if (lock.current || busy) return;
    lock.current = true;
    try { setFailure(null); await app.undo(); setLoadedId(null); setFailedImage(false); setRetry(value => value + 1); }
    catch (error) { setFailure(errorText(error, language)); }
    finally { lock.current = false; }
  };
  const split = layout.wide || (layout.width >= 740 && layout.width > layout.height && layout.fontScale < 1.5);
  const imageHeight = split ? Math.max(280, Math.min(650, layout.height - 170)) : Math.max(240, Math.min(520, layout.height * 0.48));
  return <Screen>
    <Header back={{ label: tx(language, 'Spaces', 'Пространства'), onPress: () => router.replace('/') }} right={<Text style={typography.eyebrow}>ARWANA</Text>} />
    {!session ? <EmptyState title={tx(language, 'Your next inspiration', 'Ваше новое вдохновение')} description={tx(language, 'Choose a space to start your selection.', 'Выберите пространство, чтобы начать подборку.')}><Button title={tx(language, 'Choose a space', 'Выбрать пространство')} onPress={() => router.replace('/')} /></EmptyState> : session.status === 'complete' ? <ActivityIndicator color={colors.green} /> : <>
      <View style={styles.progressHeader}><View style={{ flex: 1, gap: 5 }}><Text style={typography.eyebrow}>{tx(language, 'Discover what feels like home', 'Найдите свой образ дома')}</Text><Text accessibilityRole="header" style={typography.heading}>{spaceLabel(session.space, language)}</Text></View><Text accessibilityLiveRegion="polite" style={styles.counter}>{position + 1}<Text style={styles.counterTotal}> / {deck.length}</Text></Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: deck.length, now: position }} accessibilityLabel={tx(language, 'Photos reviewed', 'Просмотрено фотографий')} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(position / Math.max(deck.length, 1)) * 100}%` }]} /></View>
      {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} /> : null}
      <View style={[styles.main, split && styles.mainWide]}>
        <View style={styles.imageColumn}>
          {photo ? <SwipePhoto key={`${photo.id}-${retry}`} photo={photo} language={language} height={imageHeight} enabled={loadedId === photo.id && !busy && !failedImage} onChoice={choice => void vote(choice)} onReady={() => { setLoadedId(photo.id); setFailedImage(false); }} onFailure={() => setFailedImage(true)} label={`${spaceLabel(photo.room, language)}. ${tx(language, 'Interior photo', 'Фотография интерьера')} ${position + 1} / ${deck.length}`} /> : <EmptyState title={tx(language, 'Photo unavailable', 'Фото недоступно')} description={tx(language, 'Return to spaces and ask a staff member to check this gallery.', 'Вернитесь к выбору пространства и попросите сотрудника проверить галерею.')} />}
          {photo && loadedId !== photo.id && !failedImage ? <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={typography.small}>{tx(language, 'Opening photo…', 'Открываем фотографию…')}</Text></View> : null}
          {failedImage ? <View style={styles.imageFailure}><Text style={typography.small}>{tx(language, 'No choice has been recorded. Try opening this image again.', 'Ваш выбор не записан. Попробуйте открыть фото ещё раз.')}</Text><Button title={tx(language, 'Reload photo', 'Открыть ещё раз')} variant="secondary" onPress={() => { setFailedImage(false); setRetry(value => value + 1); }} /></View> : null}
        </View>
        <View style={[styles.controls, split && styles.controlsWide]}>
          <View style={{ gap: 8 }}><Text style={typography.heading}>{tx(language, 'Could this be your space?', 'Это могло бы быть вашим домом?')}</Text><Text style={typography.body}>{tx(language, 'No right or wrong answers. Just go with your first feeling.', 'Здесь нет правильных ответов. Доверьтесь первому ощущению.')}</Text></View>
          <View style={styles.voteRow}>
            <Button title={tx(language, 'Not for me', 'Не моё')} icon="×" variant="secondary" disabled={busy || loadedId !== photo?.id || failedImage} onPress={() => void vote('dislike')} style={styles.voteButton} />
            <Button title={tx(language, 'Love it', 'Нравится')} icon="♡" disabled={busy || loadedId !== photo?.id || failedImage} onPress={() => void vote('like')} style={styles.voteButton} />
          </View>
          <Text style={[typography.small, styles.hint]}>{tx(language, 'Swipe left to pass · right to like', 'Свайп влево — не моё · вправо — нравится')}</Text>
          <Button title={tx(language, 'Undo last choice', 'Отменить последний выбор')} icon="↶" variant="ghost" disabled={busy || position === 0} onPress={() => void undo()} />
          {position >= 20 ? <View style={styles.early}><Text style={typography.small}>{tx(language, 'Ready for a first impression? You can keep choosing afterwards.', 'Готовы узнать первые впечатления? После результата можно продолжить.')}</Text><Button title={tx(language, 'See preliminary result', 'Предварительный результат')} variant="secondary" onPress={() => router.replace('/result')} disabled={busy} /></View> : <Text style={[typography.small, styles.hint]}>{deck.length > 20 ? tx(language, 'A first result is available after 20 choices.', 'Первый результат будет доступен после 20 оценок.') : tx(language, 'Your result appears after the last photo.', 'Результат появится после последней фотографии.')}</Text>}
        </View>
      </View>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', gap: 20, alignItems: 'center' }, counter: { fontSize: 25, fontWeight: '500', color: colors.green }, counterTotal: { fontSize: 16, color: colors.muted }, progressTrack: { height: 4, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginTop: -12 }, progressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 4 }, main: { gap: 25 }, mainWide: { flexDirection: 'row', gap: 32, alignItems: 'center' }, imageColumn: { flex: 1, gap: 12 }, controls: { gap: 18 }, controlsWide: { width: 310, flexShrink: 0 }, voteRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }, voteButton: { flex: 1, minWidth: 120, minHeight: 58 }, hint: { textAlign: 'center' }, early: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20, gap: 12 }, loading: { flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center' }, imageFailure: { gap: 10, paddingHorizontal: 8 },
});
