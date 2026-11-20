import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/Icon';
import { SwipePhoto, type SwipePhotoHandle } from '../components/SwipePhoto';
import { Button, EmptyState, ErrorBanner, Header, Screen, colors, errorText, spaceLabel, tx, typography, useLayout } from '../components/ui';
import type { Choice } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function GalleryScreen() {
  const app = useApp();
  const { session, language, busy } = app;
  const layout = useLayout();
  const lock = useRef(false);
  const animating = useRef(false);
  const swipeRef = useRef<SwipePhotoHandle>(null);
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
    if (lock.current || busy || !photo || loadedId !== photo.id || failedImage) {
      animating.current = false;
      return;
    }
    lock.current = true; setFailure(null);
    try { await app.rate(choice); setLoadedId(null); }
    catch (error) { setFailure(errorText(error, language)); setRetry(value => value + 1); }
    finally { lock.current = false; animating.current = false; }
  };
  const handleVote = (choice: Choice) => {
    if (animating.current || lock.current || busy || !photo || loadedId !== photo.id || failedImage) return;
    if (swipeRef.current?.swipe(choice)) {
      animating.current = true;
      return;
    }
    void vote(choice);
  };
  const undo = async () => {
    if (animating.current || lock.current || busy) return;
    lock.current = true;
    try { setFailure(null); await app.undo(); setLoadedId(null); setFailedImage(false); setRetry(value => value + 1); }
    catch (error) { setFailure(errorText(error, language)); }
    finally { lock.current = false; animating.current = false; }
  };
  const split = layout.wide || (layout.width >= 740 && layout.width > layout.height && layout.fontScale < 1.5);
  const imageWidth = split ? layout.contentWidth - 196 : layout.contentWidth;
  const naturalHeight = (imageWidth - 12) * ((photo?.height ?? 2) / (photo?.width ?? 3)) + 10;
  const imageHeight = Math.max(160, Math.min(naturalHeight, layout.height - (split ? 160 : 280)));
  return <Screen>
    <Header back={{ label: tx(language, 'Otaglar', 'Пространства'), onPress: () => router.replace('/') }} right={<Text style={typography.eyebrow}>ARWANA</Text>} />
    {!session ? <EmptyState title={tx(language, 'Otagy saýlaň', 'Выберите пространство')} description={tx(language, 'Interýerleri saýlap başlamak üçin otagy açyň.', 'Откройте комнату, чтобы начать выбор.')}><Button title={tx(language, 'Otagy saýlamak', 'Выбрать пространство')} onPress={() => router.replace('/')} /></EmptyState> : session.status === 'complete' ? <ActivityIndicator color={colors.green} /> : <>
      <View style={styles.progressHeader}><Text accessibilityRole="header" style={[typography.subheading, { flex: 1 }]}>{spaceLabel(session.space, language)}</Text><Text accessibilityLiveRegion="polite" style={styles.counter}>{position + 1}<Text style={typography.small}> / {deck.length}</Text></Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: deck.length, now: position }} accessibilityLabel={tx(language, 'Görülen suratlar', 'Просмотрено фотографий')} style={styles.progressTrack}><View style={[styles.progressFill, { width: ((position / Math.max(deck.length, 1)) * 100) + '%' }]} /></View>
      {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} /> : null}
      <View style={[styles.main, split && styles.mainWide]}>
        <View style={styles.imageColumn}>
          {photo ? <SwipePhoto ref={swipeRef} key={photo.id + '-' + retry} photo={photo} nextPhoto={nextPhoto} language={language} height={imageHeight} enabled={loadedId === photo.id && !busy && !failedImage} onChoice={choice => void vote(choice)} onReady={() => { setLoadedId(photo.id); setFailedImage(false); }} onFailure={() => setFailedImage(true)} label={spaceLabel(photo.room, language) + '. ' + tx(language, 'Interýer suraty', 'Фотография интерьера') + ' ' + (position + 1) + ' / ' + deck.length} /> : <EmptyState title={tx(language, 'Surat elýeterli däl', 'Фото недоступно')} description={tx(language, 'Otaglara dolanyň we işgärden bu toplumy barlamagy haýyş ediň.', 'Вернитесь к комнатам и попросите сотрудника проверить подборку.')} />}
          {photo && loadedId !== photo.id && !failedImage ? <ActivityIndicator accessibilityLabel={tx(language, 'Surat açylýar', 'Открываем фото')} color={colors.green} /> : null}
          {failedImage ? <View style={{ gap: 8 }}><Text style={typography.small}>{tx(language, 'Surat elýeterli däl. Saýlaw ýazga geçirilmedi.', 'Фото недоступно. Выбор не записан.')}</Text><Button title={tx(language, 'Suraty täzeden açmak', 'Открыть ещё раз')} variant="secondary" onPress={() => { setFailedImage(false); setRetry(value => value + 1); }} /></View> : null}
        </View>
        <View style={[styles.controls, split && styles.controlsWide]}>
          <View style={styles.voteRow}>
            <IconButton label={tx(language, 'Maňa däl', 'Не моё')} icon="close" disabled={busy || !photo || loadedId !== photo.id || failedImage} onPress={() => handleVote('dislike')} style={styles.voteButton} />
            <IconButton label={tx(language, 'Haladym', 'Нравится')} icon="heart" prominent disabled={busy || !photo || loadedId !== photo.id || failedImage} onPress={() => handleVote('like')} style={styles.voteButton} />
          </View>
          {position === 0 ? <Text style={[typography.small, styles.hint]}>{tx(language, 'Çepe süýşür — maňa däl · saga — haladym', 'Свайп влево — не моё · вправо — нравится')}</Text> : null}
          <View style={{ alignItems: 'center' }}><IconButton label={tx(language, 'Soňky saýlawy yza gaýtarmak', 'Отменить последний выбор')} fallbackLabel={tx(language, 'Yza gaýtarmak', 'Отменить')} icon="undo" disabled={busy || position === 0} onPress={() => void undo()} /></View>
          {position >= 20 ? <Button title={tx(language, 'Deslapky netijäni görmek', 'Предварительный результат')} variant="secondary" onPress={() => router.replace('/result')} disabled={busy} /> : position === 0 ? <Text style={[typography.small, styles.hint]}>{deck.length > 20 ? tx(language, 'Netije 20 saýlawdan soň elýeterli', 'Результат после 20 оценок') : tx(language, 'Netije soňky suratdan soň', 'Результат после последнего фото')}</Text> : null}
        </View>
      </View>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', gap: 16, alignItems: 'center' }, counter: { fontSize: 20, fontWeight: '500', color: colors.green }, progressTrack: { height: 3, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginTop: -8 }, progressFill: { height: 3, backgroundColor: colors.green, borderRadius: 4 }, main: { gap: 16 }, mainWide: { flexDirection: 'row', gap: 16, alignItems: 'center' }, imageColumn: { flex: 1, gap: 8 }, controls: { gap: 12 }, controlsWide: { width: 180, flexShrink: 0 }, voteRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }, voteButton: { minWidth: 72, minHeight: 72, borderRadius: 36 }, hint: { textAlign: 'center' },
});
