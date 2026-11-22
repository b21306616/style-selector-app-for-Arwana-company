import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/Icon';
import { SwipePhoto } from '../components/SwipePhoto';
import { Button, EmptyState, ErrorBanner, Header, Screen, colors, errorText, spaceLabel, tx, typography } from '../components/ui';
import type { Choice } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function GalleryScreen() {
  const app = useApp();
  const { session, language, busy } = app;
  const lock = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState(false);
  const [retry, setRetry] = useState(0);
  const deck = session?.catalog.galleries[session.space] ?? [];
  const position = session?.ratings.length ?? 0;
  const photo = session?.catalog.photos.find(item => item.id === deck[position]);
  const nextPhoto = session?.catalog.photos.find(item => item.id === deck[position + 1]);
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
  return <Screen scroll={false} style={styles.screen}>
    <Header back={{ label: tx(language, 'Otaglar', 'Пространства'), onPress: () => router.replace('/') }} right={<Text style={typography.eyebrow}>ARWANA</Text>} />
    {!session ? <EmptyState title={tx(language, 'Otagy saýlaň', 'Выберите пространство')} description={tx(language, 'Interýerleri saýlap başlamak üçin otagy açyň.', 'Откройте комнату, чтобы начать выбор.')}><Button title={tx(language, 'Otagy saýlamak', 'Выбрать пространство')} onPress={() => router.replace('/')} /></EmptyState> : session.status === 'complete' ? <ActivityIndicator color={colors.green} /> : <>
      <View style={styles.progressHeader}><Text accessibilityRole="header" style={[typography.subheading, { flex: 1 }]}>{spaceLabel(session.space, language)}</Text><Text accessibilityLiveRegion="polite" style={styles.counter}>{position + 1}<Text style={typography.small}> / {deck.length}</Text></Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: deck.length, now: position }} accessibilityLabel={tx(language, 'Görülen suratlar', 'Просмотрено фотографий')} style={styles.progressTrack}><View style={[styles.progressFill, { width: ((position / Math.max(deck.length, 1)) * 100) + '%' }]} /></View>
      {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} /> : null}
      <View style={styles.stage}>
        {photo ? <SwipePhoto key={photo.id + '-' + retry} photo={photo} nextPhoto={nextPhoto} language={language} enabled={loadedId === photo.id && !busy && !failedImage} onChoice={choice => void vote(choice)} onReady={() => { setLoadedId(photo.id); setFailedImage(false); }} onFailure={() => setFailedImage(true)} label={spaceLabel(photo.room, language) + '. ' + tx(language, 'Interýer suraty', 'Фотография интерьера') + ' ' + (position + 1) + ' / ' + deck.length} /> : <EmptyState title={tx(language, 'Surat elýeterli däl', 'Фото недоступно')} description={tx(language, 'Otaglara dolanyň we işgärden bu toplumy barlamagy haýyş ediň.', 'Вернитесь к комнатам и попросите сотрудника проверить подборку.')} />}
        {photo && loadedId !== photo.id && !failedImage ? <ActivityIndicator accessibilityLabel={tx(language, 'Surat açylýar', 'Открываем фото')} color={colors.green} style={styles.spinner} /> : null}
        {failedImage ? <View style={styles.failure}><Text style={[typography.small, styles.failureText]}>{tx(language, 'Surat elýeterli däl. Saýlaw ýazga geçirilmedi.', 'Фото недоступно. Выбор не записан.')}</Text><Button title={tx(language, 'Suraty täzeden açmak', 'Открыть ещё раз')} variant="secondary" onPress={() => { setFailedImage(false); setRetry(value => value + 1); }} /></View> : null}
      </View>
      <View style={styles.footer}>
        <IconButton label={tx(language, 'Soňky saýlawy yza gaýtarmak', 'Отменить последний выбор')} fallbackLabel={tx(language, 'Yza gaýtarmak', 'Отменить')} icon="undo" disabled={busy || position === 0} onPress={() => void undo()} />
        {position >= 20 ? <Button title={tx(language, 'Deslapky netijäni görmek', 'Предварительный результат')} variant="secondary" onPress={() => router.replace('/result')} disabled={busy} /> : position === 0 ? <Text style={[typography.small, styles.hint]}>{deck.length > 20 ? tx(language, 'Netije 20 saýlawdan soň elýeterli', 'Результат после 20 оценок') : tx(language, 'Netije soňky suratdan soň', 'Результат после последнего фото')}</Text> : null}
      </View>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  screen: { gap: 8, paddingTop: 4, paddingBottom: 8 },
  progressHeader: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  counter: { fontSize: 20, fontWeight: '500', color: colors.green },
  progressTrack: { height: 3, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.green, borderRadius: 4 },
  stage: { flex: 1, minHeight: 160 },
  spinner: { position: 'absolute', alignSelf: 'center', top: '45%' },
  failure: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  failureText: { textAlign: 'center' },
  footer: { alignItems: 'center', gap: 8 },
  hint: { textAlign: 'center' },
});
