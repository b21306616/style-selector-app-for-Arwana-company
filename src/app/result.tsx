import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconButton, UndoIconButton } from '../components/Icon';
import { PhotoTile } from '../components/PhotoTile';
import { PhotoImage } from '../components/PhotoImage';
import { Button, Chip, EmptyState, ErrorBanner, Header, Screen, colors, errorText, photoCount, sessionLabel, spaceLabel, tx, typography, useLayout } from '../components/ui';
import { summarizeSession } from '../domain/scoring';
import type { Photo, Session } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function ResultScreen() {
  const app = useApp();
  const { language } = app;
  const [returningFrom, setReturningFrom] = useState<Session | null>(null);
  const undoPending = useRef(false);
  const session = returningFrom ?? app.session;
  const busy = app.busy || !!returningFrom;
  const layout = useLayout();
  const [confirmNew, setConfirmNew] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const summary = useMemo(() => session ? summarizeSession(session) : null, [session]);
  const likedPhotos = useMemo(() => {
    const byId = new Map(session?.catalog.photos.map(photo => [photo.id, photo]) ?? []);
    return (summary?.likedIds ?? []).map(id => byId.get(id)).filter((photo): photo is Photo => !!photo);
  }, [session, summary]);
  const terms = new Map(session?.catalog.terms.map(term => [term.id, term.labels[language]]) ?? []);
  const complete = session?.status === 'complete';
  const columns = layout.columns;
  const clear = async () => {
    try { await app.clearSession(); setConfirmNew(false); router.replace('/'); }
    catch (error) { setConfirmNew(false); setFailure(errorText(error, language)); }
  };
  const lastChoice = async () => {
    const choice = session?.ratings.at(-1)?.choice;
    if (!choice || !session || busy || undoPending.current) return;
    undoPending.current = true;
    // The completed result stays visible while the gallery opens with the restored card.
    setReturningFrom(session);
    try { await app.undo(); router.replace({ pathname: '/gallery', params: { entrance: choice } }); }
    catch (error) { undoPending.current = false; setReturningFrom(null); setFailure(errorText(error, language)); }
  };
  if (!session || !summary || (!complete && session.ratings.length < 20)) return <Screen>
    <Header back={{ label: tx(language, 'Otaglar', 'Пространства'), onPress: () => router.replace('/') }} />
    <EmptyState title={tx(language, 'Ýene biraz ylham', 'Ещё немного вдохновения')} description={tx(language, 'Öz stiliňizi anyklamak üçin ýene birnäçe interýer saýlaň.', 'Выберите ещё несколько интерьеров, чтобы узнать свой стиль.')}><Button title={session ? tx(language, 'Saýlamagy dowam etmek', 'Продолжить выбор') : tx(language, 'Otagy saýlamak', 'Выбрать пространство')} onPress={() => router.replace(session ? '/gallery' : '/')} /></EmptyState>
  </Screen>;
  const styleTitle = summary.kind === 'inconclusive' ? tx(language, 'Stil entek anyklanmady', 'Стиль пока не определён') : summary.kind === 'varied' ? tx(language, 'Stilleriň garyndysy', 'Сочетание стилей') : summary.styles.map(style => terms.get(style.styleId) ?? '').join(' + ');
  const description = summary.kind === 'inconclusive'
    ? tx(language, 'Entek umumy islegler ýeterlik däl. Halan suratlaryňyzy dizaýner bilen ara alyp maslahatlaşyň.', 'Пока недостаточно общих предпочтений. Обсудите понравившиеся фотографии с дизайнером.')
    : tx(language, 'Bu toplumda eden saýlawlaryňyza esaslanan ugur.', 'Направление на основе вашего выбора в этой коллекции.');
  const featureCategories = [
    { kind: 'palette' as const, label: tx(language, 'Palitra', 'Палитра') },
    { kind: 'material' as const, label: tx(language, 'Materiallar', 'Материалы') },
    { kind: 'detail' as const, label: tx(language, 'Aýratynlyklar', 'Детали') },
  ].filter(category => summary.features[category.kind].length > 0);
  const viewing = selected !== null ? likedPhotos[selected] : undefined;
  const scrollActions = layout.fontScale >= 1.5 || layout.height < 500;
  const actions = <View style={styles.actions}>
    {!complete ? <Button title={tx(language, 'Saýlamagy dowam etmek', 'Продолжить выбор')} onPress={() => router.replace('/gallery')} disabled={busy} style={{ flexGrow: 1 }} /> : session.ratings.length > 0 ? <UndoIconButton label={tx(language, 'Soňky saýlawy üýtgetmek', 'Изменить последний выбор')} fallbackLabel={tx(language, 'Yza gaýtarmak', 'Отменить')} onPress={() => void lastChoice()} disabled={busy} /> : null}
    <Button title={tx(language, 'Täze müşderi', 'Новый клиент')} accessibilityLabel={tx(language, 'Täze müşderi bilen başlamak', 'Новый клиент')} variant="secondary" onPress={() => setConfirmNew(true)} disabled={busy} style={{ flexGrow: 1 }} />
  </View>;
  return <Screen scroll={false} style={{ gap: 10 }}>
    <Header back={{ label: tx(language, 'Otaglar', 'Пространства'), onPress: () => router.replace('/') }} right={<Text style={typography.eyebrow}>ARWANA</Text>} />
    <FlatList key={columns} data={likedPhotos} numColumns={columns} keyExtractor={item => item.id} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} showsVerticalScrollIndicator={false} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
      ListHeaderComponent={<View style={styles.headerContent}>
        {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} /> : null}
        <View style={styles.row}><Chip label={complete ? tx(language, 'Siziň stiliňiz', 'Ваш стиль') : tx(language, 'Deslapky netije', 'Предварительный результат')} selected /><Text style={typography.small}>{session.ratings.length}/{session.catalog.galleries[session.space].length} {tx(language, 'görüldi', 'просмотрено')}</Text></View>
        <Text accessibilityRole="header" style={layout.fontScale >= 1.5 ? typography.subheading : typography.heading}>{styleTitle}</Text>
        <View style={styles.row}><Text style={[typography.small, { flex: 1 }]}>{photoCount(likedPhotos.length, language)} · {sessionLabel(session, language)}</Text><Button title={tx(language, 'Jikme-jik', 'Подробнее')} variant="ghost" onPress={() => setDetailsOpen(true)} /></View>
      </View>}
      renderItem={({ item, index }) => <PhotoTile photo={item} language={language} title={spaceLabel(item.room, language, session.catalog.rooms)} label={tx(language, 'Halanan suraty açmak', 'Открыть понравившееся фото') + ' ' + (index + 1) + ': ' + spaceLabel(item.room, language, session.catalog.rooms)} onPress={() => setSelected(index)} style={{ width: (layout.contentWidth - (columns - 1) * 12) / columns, marginBottom: 12 }} imageStyle={{ aspectRatio: 1.15 }} />}
      ListEmptyComponent={<View style={styles.empty}><Text style={typography.body}>{tx(language, 'Halanan surat ýok. Işgär bilen başga toplumy synap görüň.', 'Нет понравившихся фото. Попробуйте другую подборку с сотрудником.')}</Text></View>}
      ListFooterComponent={<View style={{ gap: 12 }}>{scrollActions ? actions : null}<Text style={typography.small}>{tx(language, 'Täze müşderä çenli bu enjamda saklanýar.', 'Сохранено на устройстве до нового клиента.')}</Text></View>}
    />
    {!scrollActions ? actions : null}
    <AppModal visible={detailsOpen} animationType="slide" onRequestClose={() => setDetailsOpen(false)}>
      <Screen>
        <Header title={tx(language, 'Jikme-jik', 'Подробнее')} right={<IconButton icon="close" label={tx(language, 'Jikme-jikligi ýapmak', 'Закрыть подробности')} fallbackLabel={tx(language, 'Ýapmak', 'Закрыть')} onPress={() => setDetailsOpen(false)} />} />
        <Text accessibilityRole="header" style={layout.fontScale >= 1.5 ? typography.subheading : typography.heading}>{styleTitle}</Text>
        <Text style={typography.body}>{description}</Text>
        {summary.kind === 'varied' ? <View style={styles.row}>{summary.styles.map(style => <Chip key={style.styleId} label={terms.get(style.styleId) ?? ''} />)}</View> : null}
        <Text style={typography.small}>{summary.reviewed} {tx(language, 'görüldi', 'просмотрено')} · {summary.likedIds.length} {tx(language, 'halandy', 'понравилось')}</Text>
        {featureCategories.map(category => <View key={category.kind} style={styles.detailCard}>
          <Text accessibilityRole="header" style={typography.subheading}>{category.label}</Text>
          {summary.features[category.kind].map(feature => <View key={feature.termId} style={styles.row}><Text style={[typography.body, { flex: 1, color: colors.ink }]}>{terms.get(feature.termId)}</Text><Text style={typography.small}>{feature.count}/{summary.likedIds.length}</Text></View>)}
        </View>)}
        {featureCategories.length ? <Text style={typography.small}>{tx(language, 'Sanlar bu aýratynlygyň halanan suratlaryňyzda näçe gezek duş gelýändigini görkezýär.', 'Числа показывают, как часто признак встречается в понравившихся фото.')}</Text> : <Text style={typography.small}>{tx(language, 'Umumy aýratynlyklar entek kesgitlenmedi.', 'Общие признаки пока не определены.')}</Text>}
      </Screen>
    </AppModal>
    <AppModal visible={viewing !== undefined} animationType="fade" onRequestClose={() => setSelected(null)}><SafeAreaView style={styles.viewer}>
      <View style={styles.viewerHeader}><Text style={styles.viewerTitle}>{viewing ? spaceLabel(viewing.room, language, session.catalog.rooms) : ''}</Text><IconButton label={tx(language, 'Ýapmak', 'Закрыть')} icon="close" onPress={() => setSelected(null)} /></View>
      {viewing ? <PhotoImage key={viewing.id} photo={viewing} language={language} fit="contain" style={styles.fullImage} label={spaceLabel(viewing.room, language, session.catalog.rooms) + ', ' + (terms.get(viewing.styleId) ?? '')} /> : null}
      <View style={styles.viewerFooter}><IconButton label={tx(language, 'Öňki', 'Назад')} icon="back" disabled={selected === 0} onPress={() => setSelected(value => value === null ? null : Math.max(0, value - 1))} /><Text style={styles.viewerCount}>{(selected ?? 0) + 1} / {likedPhotos.length}</Text><IconButton label={tx(language, 'Indiki', 'Далее')} icon="next" disabled={selected === likedPhotos.length - 1} onPress={() => setSelected(value => value === null ? null : Math.min(likedPhotos.length - 1, value + 1))} /></View>
    </SafeAreaView></AppModal>
    <ConfirmDialog visible={confirmNew} language={language} title={tx(language, 'Indiki müşderä taýynmy?', 'Готовы к следующему клиенту?')} description={tx(language, 'Häzirki saýlawlar we netije aýrylar. Suratlar katalogy saklanar.', 'Текущий выбор и результат будут удалены. Каталог фотографий сохранится.')} confirmLabel={tx(language, 'Täze saýlawy başlamak', 'Начать новый сеанс')} onConfirm={() => void clear()} onCancel={() => setConfirmNew(false)} loading={busy} />
  </Screen>;
}
const styles = StyleSheet.create({
  headerContent: { gap: 8, paddingBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }, actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, detailCard: { padding: 18, gap: 12, backgroundColor: colors.surface, borderRadius: 18 }, empty: { backgroundColor: colors.sand, padding: 20, borderRadius: 18, marginBottom: 16 },
  viewer: { flex: 1, backgroundColor: '#18241E' }, viewerHeader: { padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, viewerTitle: { fontSize: 18, color: colors.white, flex: 1 }, fullImage: { flex: 1, backgroundColor: '#18241E' }, viewerFooter: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, viewerCount: { fontSize: 14, color: colors.white },
});
