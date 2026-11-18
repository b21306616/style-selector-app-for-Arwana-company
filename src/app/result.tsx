import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PhotoImage } from '../components/PhotoImage';
import { Button, Chip, EmptyState, ErrorBanner, Header, Screen, colors, errorText, photoCount, spaceLabel, tx, typography, useLayout } from '../components/ui';
import { summarizeSession } from '../domain/scoring';
import type { Photo } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function ResultScreen() {
  const app = useApp();
  const { session, language, busy } = app;
  const layout = useLayout();
  const [confirmNew, setConfirmNew] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const summary = useMemo(() => session ? summarizeSession(session) : null, [session]);
  const likedPhotos = useMemo(() => {
    const byId = new Map(session?.catalog.photos.map(photo => [photo.id, photo]) ?? []);
    return (summary?.likedIds ?? []).map(id => byId.get(id)).filter((photo): photo is Photo => !!photo);
  }, [session, summary]);
  const terms = new Map(session?.catalog.terms.map(term => [term.id, term.labels[language]]) ?? []);
  const complete = session?.status === 'complete';
  const columns = layout.fontScale >= 1.6 ? 1 : layout.wide ? 3 : 2;
  const clear = async () => {
    try { await app.clearSession(); setConfirmNew(false); router.replace('/'); }
    catch (error) { setConfirmNew(false); setFailure(errorText(error, language)); }
  };
  const lastChoice = async () => {
    try { await app.undo(); router.replace('/gallery'); }
    catch (error) { setFailure(errorText(error, language)); }
  };
  if (!session || !summary || (!complete && session.ratings.length < 20)) return <Screen>
    <Header back={{ label: tx(language, 'Spaces', 'Пространства'), onPress: () => router.replace('/') }} />
    <EmptyState title={tx(language, 'A little more inspiration', 'Ещё немного вдохновения')} description={tx(language, 'Choose more interiors to discover your style.', 'Выберите ещё несколько интерьеров, чтобы узнать свой стиль.')}><Button title={session ? tx(language, 'Continue choosing', 'Продолжить выбор') : tx(language, 'Choose a space', 'Выбрать пространство')} onPress={() => router.replace(session ? '/gallery' : '/')} /></EmptyState>
  </Screen>;
  const styleTitle = summary.kind === 'inconclusive' ? tx(language, 'Your story is still unfolding.', 'Ваш стиль ещё раскрывается.') : summary.kind === 'varied' ? tx(language, 'A style all your own.', 'Ваш собственный взгляд.') : summary.styles.map(style => terms.get(style.styleId) ?? '').join(' + ');
  const description = summary.kind === 'inconclusive'
    ? tx(language, 'There aren’t enough shared preferences for a clear style yet. Your liked photos are a useful starting point for a conversation.', 'Пока недостаточно общих предпочтений, чтобы выделить стиль. Понравившиеся фотографии помогут начать разговор с дизайнером.')
    : summary.kind === 'varied'
      ? tx(language, 'Your choices span several styles. The details you keep returning to bring your preferences together.', 'Вам близки несколько направлений. Детали, которые вы выбираете снова и снова, объединяют ваши предпочтения.')
      : tx(language, 'You lean toward these interiors. Think of this as a direction to explore, shaped by the photos you chose.', 'Вам близки такие интерьеры. Это направление для вдохновения, основанное на выбранных вами фотографиях.');
  const featureCategories = [
    { kind: 'palette' as const, label: tx(language, 'Palette', 'Палитра'), number: '01' },
    { kind: 'material' as const, label: tx(language, 'Materials', 'Материалы'), number: '02' },
    { kind: 'detail' as const, label: tx(language, 'Details', 'Детали'), number: '03' },
  ].filter(category => summary.features[category.kind].length > 0);
  const viewing = selected !== null ? likedPhotos[selected] : undefined;
  return <Screen scroll={false} style={{ gap: 10 }}>
    <Header back={{ label: tx(language, 'Spaces', 'Пространства'), onPress: () => router.replace('/') }} right={<Text style={typography.eyebrow}>ARWANA</Text>} />
    <FlatList key={columns} data={likedPhotos} numColumns={columns} keyExtractor={item => item.id} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} showsVerticalScrollIndicator={false} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5}
      ListHeaderComponent={<View style={styles.headerContent}>
        {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} /> : null}
        <View style={styles.resultIntro}><Chip label={complete ? tx(language, 'Your style direction', 'Ваше направление') : tx(language, 'A first impression', 'Первые впечатления')} selected /><Text style={typography.small}>{spaceLabel(session.space, language)} · {session.ratings.length} / {session.catalog.galleries[session.space].length} {tx(language, 'reviewed', 'просмотрено')}</Text></View>
        <View style={[styles.resultCard, layout.wide && styles.resultCardWide]}>
          {likedPhotos[0] ? <PhotoImage key={likedPhotos[0].id} photo={likedPhotos[0]} language={language} style={[styles.resultImage, layout.wide && styles.resultImageWide]} label={tx(language, 'One of your liked interiors', 'Один из понравившихся интерьеров')} /> : null}
          <View style={styles.resultCopy}><Text style={[typography.eyebrow, { color: '#C8D4BF' }]}>{tx(language, 'Inspired by your choices', 'Вдохновлено вашим выбором')}</Text><Text accessibilityRole="header" style={styles.resultTitle}>{styleTitle}</Text><Text style={styles.resultDescription}>{description}</Text>{summary.kind === 'varied' ? <View style={styles.wrap}>{summary.styles.map(style => <View key={style.styleId} style={styles.stylePill}><Text style={styles.stylePillText}>{terms.get(style.styleId)}</Text></View>)}</View> : null}</View>
        </View>
        <View style={[styles.stats, layout.wide && styles.statsWide]}><View style={styles.stat}><Text style={styles.statValue}>{summary.likedIds.length}</Text><Text style={typography.small}>{tx(language, 'interiors you liked', 'интерьеров понравилось')}</Text></View><View style={styles.stat}><Text style={styles.statValue}>{summary.reviewed}</Text><Text style={typography.small}>{tx(language, 'photos explored', 'фотографий просмотрено')}</Text></View>{!complete ? <Button title={tx(language, 'Continue choosing', 'Продолжить выбор')} icon="→" onPress={() => router.replace('/gallery')} style={styles.continue} /> : null}</View>
        {featureCategories.length ? <View style={styles.featureSection}><View style={{ gap: 6 }}><Text accessibilityRole="header" style={typography.heading}>{tx(language, 'The details that connect', 'Детали, которые объединяют')}</Text><Text style={typography.body}>{tx(language, 'Common in your liked images.', 'Общие черты понравившихся фотографий.')}</Text></View><View style={[styles.features, layout.wide && styles.featuresWide]}>{featureCategories.map(category => <View key={category.kind} style={styles.featureCard}><View style={styles.featureHeading}><Text style={typography.eyebrow}>{category.number}</Text><Text style={typography.subheading}>{category.label}</Text></View>{summary.features[category.kind].map(feature => <View key={feature.termId} style={styles.featureItem}><Text style={[typography.body, { color: colors.ink, flex: 1 }]}>{terms.get(feature.termId)}</Text><Text style={typography.small}>{feature.count} / {summary.likedIds.length}</Text></View>)}</View>)}</View></View> : null}
        <View style={styles.collectionHeading}><View style={{ gap: 6 }}><Text accessibilityRole="header" style={typography.heading}>{tx(language, 'Your inspiration collection', 'Ваша коллекция вдохновения')}</Text><Text style={typography.small}>{tx(language, 'Tap a photo to see the whole interior.', 'Нажмите на фото, чтобы рассмотреть интерьер.')}</Text></View><Text style={typography.small}>{photoCount(likedPhotos.length, language)}</Text></View>
      </View>}
      renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`${tx(language, 'Open liked photo', 'Открыть понравившееся фото')} ${index + 1}: ${spaceLabel(item.room, language)}`} onPress={() => setSelected(index)} style={({ pressed }) => [styles.likedCard, { maxWidth: (layout.contentWidth - (columns - 1) * 12) / columns }, pressed && { opacity: 0.75 }]}><PhotoImage photo={item} thumbnail language={language} style={styles.likedImage} /><View style={styles.likedCaption}><Text style={[typography.small, { color: colors.ink, flex: 1 }]}>{spaceLabel(item.room, language)}</Text><Text accessible={false} style={styles.likedHeart}>♡</Text></View></Pressable>}
      ListEmptyComponent={<View style={styles.noLikes}><Text style={typography.body}>{tx(language, 'You haven’t liked any photos in this selection. That is useful feedback too — a staff member can help you explore a different collection.', 'В этой подборке пока нет понравившихся фотографий. Это тоже полезный результат — сотрудник поможет подобрать другую коллекцию.')}</Text></View>}
      ListFooterComponent={<View style={styles.footer}><Text style={[typography.small, { maxWidth: 560 }]}>{tx(language, 'This summary describes your choices in this collection. There are many more ways to make a space your own.', 'Этот результат описывает ваш выбор в данной коллекции. Способов создать свой интерьер гораздо больше.')}</Text><View style={styles.footerActions}>{complete && session.ratings.length > 0 ? <Button title={tx(language, 'Revisit last choice', 'Изменить последний выбор')} variant="secondary" icon="↶" onPress={() => void lastChoice()} disabled={busy} /> : null}<Button title={tx(language, 'Start with a new client', 'Новый клиент')} onPress={() => setConfirmNew(true)} disabled={busy} /></View><Text style={typography.small}>{tx(language, 'Saved on this device until the next client session.', 'Сохранено на этом устройстве до начала нового сеанса.')}</Text></View>}
    />
    <AppModal visible={viewing !== undefined} animationType="fade" onRequestClose={() => setSelected(null)}><SafeAreaView style={styles.viewer}>
      <View style={styles.viewerHeader}><Text style={styles.viewerTitle}>{viewing ? spaceLabel(viewing.room, language) : ''}</Text><Button title={tx(language, 'Close', 'Закрыть')} variant="secondary" icon="×" onPress={() => setSelected(null)} /></View>
      {viewing ? <PhotoImage key={viewing.id} photo={viewing} language={language} fit="contain" style={styles.fullImage} label={`${spaceLabel(viewing.room, language)}, ${terms.get(viewing.styleId) ?? ''}`} /> : null}
      <View style={styles.viewerFooter}><Button title={tx(language, 'Previous', 'Назад')} icon="←" variant="secondary" disabled={selected === 0} onPress={() => setSelected(value => value === null ? null : Math.max(0, value - 1))} /><Text style={styles.viewerCount}>{(selected ?? 0) + 1} / {likedPhotos.length}</Text><Button title={tx(language, 'Next', 'Далее')} icon="→" variant="secondary" disabled={selected === likedPhotos.length - 1} onPress={() => setSelected(value => value === null ? null : Math.min(likedPhotos.length - 1, value + 1))} /></View>
    </SafeAreaView></AppModal>
    <ConfirmDialog visible={confirmNew} language={language} title={tx(language, 'Ready for the next client?', 'Готовы к следующему клиенту?')} description={tx(language, 'This selection and result will be cleared. The photo catalog will stay on the device.', 'Эта подборка и результат будут удалены. Каталог фотографий останется на устройстве.')} confirmLabel={tx(language, 'Clear and start fresh', 'Начать новый сеанс')} onConfirm={() => void clear()} onCancel={() => setConfirmNew(false)} loading={busy} />
  </Screen>;
}
const styles = StyleSheet.create({
  headerContent: { gap: 24, paddingTop: 12, paddingBottom: 18 }, resultIntro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, resultCard: { backgroundColor: colors.green, borderRadius: 24, overflow: 'hidden' }, resultCardWide: { flexDirection: 'row' }, resultImage: { width: '100%', height: 240 }, resultImageWide: { width: '44%', height: '100%', minHeight: 320 }, resultCopy: { flex: 1, padding: 28, gap: 16, justifyContent: 'center' }, resultTitle: { fontSize: 34, lineHeight: 41, fontWeight: '500', letterSpacing: -0.9, color: colors.white }, resultDescription: { fontSize: 15, lineHeight: 24, color: '#DEE6D8' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stylePill: { borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: '#FFFFFF15', borderWidth: 1, borderColor: '#FFFFFF30' }, stylePillText: { fontSize: 12, lineHeight: 18, color: colors.white },
  stats: { flexDirection: 'row', gap: 24, alignItems: 'center', flexWrap: 'wrap', paddingVertical: 8 }, statsWide: { gap: 40 }, stat: { gap: 4 }, statValue: { fontSize: 30, fontWeight: '400', color: colors.green }, continue: { marginLeft: 'auto' }, featureSection: { gap: 20 }, features: { gap: 12 }, featuresWide: { flexDirection: 'row' }, featureCard: { flex: 1, padding: 20, gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20 }, featureHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, featureItem: { flexDirection: 'row', gap: 12, alignItems: 'center' }, collectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', paddingTop: 8 },
  likedCard: { flex: 1, marginBottom: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, likedImage: { width: '100%', aspectRatio: 1.25 }, likedCaption: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 }, likedHeart: { fontSize: 22, color: colors.green }, noLikes: { backgroundColor: colors.sand, padding: 24, borderRadius: 20 }, footer: { gap: 20, paddingTop: 22, paddingBottom: 8 }, footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  viewer: { flex: 1, backgroundColor: '#18241E' }, viewerHeader: { padding: 20, gap: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }, viewerTitle: { fontSize: 18, color: colors.white }, fullImage: { flex: 1, backgroundColor: '#18241E' }, viewerFooter: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }, viewerCount: { fontSize: 14, color: colors.white },
});
