import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { IconButton, UndoIconButton } from '../components/Icon';
import { SwipePhoto } from '../components/SwipePhoto';
import { Button, EmptyState, ErrorBanner, Header, Screen, colors, errorText, spaceLabel, tx, typography } from '../components/ui';
import type { Choice } from '../domain/types';
import { useApp } from '../state/AppProvider';

const veil = 'rgba(255,254,250,0.55)';

export default function GalleryScreen() {
  const app = useApp();
  const { session, language, busy } = app;
  const lock = useRef(false);
  const routeEntrance = useLocalSearchParams<{ entrance?: string | string[] }>().entrance;
  const initialEntrance = Array.isArray(routeEntrance) ? routeEntrance[0] : routeEntrance;
  const pendingEntrance = useRef<Choice | null>(initialEntrance === 'like' || initialEntrance === 'dislike' ? initialEntrance : null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState(false);
  const [retry, setRetry] = useState(0);
  const deck = session?.catalog.galleries[session.space] ?? [];
  const position = session?.ratings.length ?? 0;
  const photo = session?.catalog.photos.find(item => item.id === deck[position]);
  const nextPhoto = session?.catalog.photos.find(item => item.id === deck[position + 1]);
  useEffect(() => { if (session?.status === 'complete') router.replace('/result'); }, [session?.status]);
  useEffect(() => {
    const entrance = Array.isArray(routeEntrance) ? routeEntrance[0] : routeEntrance;
    if (entrance === 'like' || entrance === 'dislike') router.setParams({ entrance: '' });
  }, [routeEntrance]);
  const vote = async (choice: Choice) => {
    if (lock.current || busy || !photo || loadedId !== photo.id || failedImage) return;
    lock.current = true; setFailure(null);
    try { await app.rate(choice); setLoadedId(null); }
    catch (error) { setFailure(errorText(error, language)); setRetry(value => value + 1); }
    finally { lock.current = false; }
  };
  const undo = async () => {
    if (lock.current || busy) return;
    const choice = session?.ratings.at(-1)?.choice;
    if (!choice) return;
    lock.current = true;
    pendingEntrance.current = choice;
    try { await app.undo(); setFailure(null); setLoadedId(null); setFailedImage(false); }
    catch (error) { pendingEntrance.current = null; setFailure(errorText(error, language)); }
    finally { lock.current = false; }
  };
  const back = { label: tx(language, 'Otaglar', 'Пространства'), onPress: () => router.replace('/') };
  return <Screen scroll={false} style={styles.screen}>
    {!session ? <View style={styles.fallback}>
      <Header back={back} />
      <EmptyState title={tx(language, 'Otagy saýlaň', 'Выберите пространство')} description={tx(language, 'Interýerleri saýlap başlamak üçin otagy açyň.', 'Откройте комнату, чтобы начать выбор.')}><Button title={tx(language, 'Otagy saýlamak', 'Выбрать пространство')} onPress={() => router.replace('/')} /></EmptyState>
    </View> : session.status === 'complete' ? <ActivityIndicator color={colors.green} style={styles.waiting} /> : <View style={styles.stage}>
      {photo ? <SwipePhoto key={photo.id + '-' + retry} photo={photo} nextPhoto={nextPhoto} language={language} enabled={loadedId === photo.id && !busy && !failedImage} entrance={pendingEntrance.current} onEntranceSettled={() => { pendingEntrance.current = null; }} onChoice={choice => void vote(choice)} onReady={() => { setLoadedId(photo.id); setFailedImage(false); }} onFailure={() => setFailedImage(true)} label={spaceLabel(photo.room, language) + '. ' + tx(language, 'Interýer suraty', 'Фотография интерьера') + ' ' + (position + 1) + ' / ' + deck.length} /> : <EmptyState title={tx(language, 'Surat elýeterli däl', 'Фото недоступно')} description={tx(language, 'Otaglara dolanyň we işgärden bu toplumy barlamagy haýyş ediň.', 'Вернитесь к комнатам и попросите сотрудника проверить подборку.')} />}
      {photo && loadedId !== photo.id && !failedImage ? <ActivityIndicator accessibilityLabel={tx(language, 'Surat açylýar', 'Открываем фото')} color={colors.green} style={styles.spinner} /> : null}
      {failedImage ? <View style={styles.failure}><Text style={[typography.small, styles.failureText]}>{tx(language, 'Surat elýeterli däl. Saýlaw ýazga geçirilmedi.', 'Фото недоступно. Выбор не записан.')}</Text><Button title={tx(language, 'Suraty täzeden açmak', 'Открыть ещё раз')} variant="secondary" onPress={() => { setFailedImage(false); setRetry(value => value + 1); }} /></View> : null}
      {failure || app.error ? <View pointerEvents="box-none" style={styles.errorOverlay}><ErrorBanner message={failure ?? errorText(app.error, language)} /></View> : null}
      <View pointerEvents="box-none" style={styles.topOverlay}>
        <IconButton icon="back" label={back.label} onPress={back.onPress} style={styles.pill} />
        <Text accessibilityRole="header" style={styles.room} numberOfLines={1}>{spaceLabel(session.space, language)}</Text>
      </View>
      <View pointerEvents="box-none" style={styles.bottomOverlay}>
        <View pointerEvents="box-none" style={styles.controlRow}>
          <UndoIconButton label={tx(language, 'Soňky saýlawy yza gaýtarmak', 'Отменить последний выбор')} fallbackLabel={tx(language, 'Yza gaýtarmak', 'Отменить')} disabled={busy || position === 0} onPress={() => void undo()} style={styles.pill} />
          <Text accessibilityRole="progressbar" accessibilityLiveRegion="polite" accessibilityLabel={tx(language, 'Görülen suratlar', 'Просмотрено фотографий')} accessibilityValue={{ min: 0, max: deck.length, now: position }} style={styles.counter}>{position + 1}<Text style={styles.counterTotal}> / {deck.length}</Text></Text>
          {position >= 20 ? <Button title={tx(language, 'Deslapky netijäni görmek', 'Предварительный результат')} variant="secondary" onPress={() => router.replace('/result')} disabled={busy} style={styles.action} /> : null}
        </View>
        {position === 0 ? <Text style={styles.hint}>{deck.length > 20 ? tx(language, 'Netije 20 saýlawdan soň elýeterli', 'Результат после 20 оценок') : tx(language, 'Netije soňky suratdan soň', 'Результат после последнего фото')}</Text> : null}
      </View>
    </View>}
  </Screen>;
}
const styles = StyleSheet.create({
  screen: { gap: 0, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, maxWidth: '100%', alignSelf: 'stretch' },
  fallback: { flex: 1, paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  waiting: { marginTop: 24 },
  stage: { flex: 1, minHeight: 160 },
  spinner: { position: 'absolute', alignSelf: 'center', top: '45%' },
  failure: { position: 'absolute', left: 12, right: 12, bottom: 112, gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  failureText: { textAlign: 'center' },
  errorOverlay: { position: 'absolute', top: 72, left: 12, right: 12 },
  topOverlay: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomOverlay: { position: 'absolute', left: 8, right: 8, bottom: 8, gap: 8, alignItems: 'flex-start' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { backgroundColor: veil, borderWidth: 0 },
  room: { flexShrink: 1, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: veil, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  counter: { overflow: 'hidden', minHeight: 48, paddingHorizontal: 14, borderRadius: 24, backgroundColor: veil, fontSize: 16, lineHeight: 48, fontWeight: '600', color: colors.ink },
  counterTotal: { fontSize: 13, lineHeight: 48, fontWeight: '500', color: colors.muted },
  action: { backgroundColor: veil, borderWidth: 0 },
  hint: { overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: veil, fontSize: 13, lineHeight: 19, color: colors.muted },
});
