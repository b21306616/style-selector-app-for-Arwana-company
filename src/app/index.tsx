import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PhotoTile } from '../components/PhotoTile';
import { Button, ErrorBanner, Header, Screen, colors, errorText, optionLabel, photoCount, sessionLabel, tx, typography, useLayout } from '../components/ui';
import type { Language, Room } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function HomeScreen() {
  const app = useApp();
  const { language, catalog, session, busy } = app;
  const layout = useLayout();
  const [pending, setPending] = useState<Room | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async (room: Room) => {
    try { setFailure(null); await app.startSession(room); setPending(null); router.push('/gallery'); }
    catch (error) { setPending(null); setFailure(errorText(error, language)); }
  };
  const choose = (room: Room) => { if (session && session.ratings.length > 0) setPending(room); else void start(room); };
  const changeLanguage = async (next: Language) => { try { await app.setLanguage(next); } catch (error) { setFailure(errorText(error, language)); } };
  const photos = useMemo(() => new Map(catalog?.photos.map(photo => [photo.id, photo])), [catalog?.photos]);
  const tileWidth = Math.floor((layout.contentWidth - (layout.columns - 1) * 12) / layout.columns);
  return <Screen>
    <Header right={<View style={styles.languages}>{(['ru', 'tk'] as const).map(lang => <Pressable key={lang} accessibilityRole="button" accessibilityLabel={lang === 'ru' ? 'Русский' : 'Türkmençe'} accessibilityState={{ selected: language === lang }} onPress={() => void changeLanguage(lang)} disabled={busy} style={[styles.language, language === lang && styles.languageActive]}><Text style={[styles.languageText, language === lang && { color: colors.green }]}>{lang.toUpperCase()}</Text></Pressable>)}</View>} />
    {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} onRetry={() => { setFailure(null); void app.refresh(); }} retryLabel={tx(language, 'Gaýtadan synanyşyň', 'Повторить')} /> : null}
    {app.notices.length ? <View style={{ gap: 12 }}>{app.notices.map(code => <ErrorBanner key={code} message={errorText(code, language)} />)}<Button title={tx(language, 'Düşnükli', 'Понятно')} variant="ghost" onPress={app.dismissNotices} /></View> : null}
    {!app.ready ? <ActivityIndicator color={colors.green} size="large" /> : <>
      {session ? <View style={styles.resume}><Text style={[typography.small, { flexGrow: 1, flexShrink: 1 }]}>{sessionLabel(session, language)} · {session.ratings.length}/{session.catalog.galleries[session.space].length}</Text><Button title={session.status === 'complete' ? tx(language, 'Netije', 'Результат') : tx(language, 'Dowam etmek', 'Продолжить')} onPress={() => router.push(session.status === 'complete' ? '/result' : '/gallery')} variant="ghost" /></View> : null}
      <Text accessibilityRole="header" style={typography.heading}>{tx(language, 'Otagy saýlaň', 'Выберите пространство')}</Text>
      {catalog?.rooms.length ? <View style={styles.grid}>{catalog.rooms.map(room => {
        const ids = catalog.galleries[room.id] ?? [];
        const name = optionLabel(room.labels, language);
        const count = photoCount(ids.length, language);
        return <PhotoTile key={room.id} photo={photos.get(ids[0])} language={language} title={name}
          subtitle={ids.length ? count : tx(language, 'Elýeterli däl', 'Недоступно')} label={name + ', ' + count}
          disabled={busy || !ids.length} onPress={() => choose(room.id)} style={{ width: tileWidth }} />;
      })}</View> : <Text style={typography.body}>{tx(language, 'Entäk çap edilen otag ýok.', 'Пока нет опубликованных комнат.')}</Text>}
      <View style={styles.footer}>{catalog?.sample ? <Text style={typography.small}>{tx(language, 'Interýer nusgalary', 'Примеры интерьеров')}</Text> : null}<Button title={tx(language, 'Işgärler', 'Сотрудникам')} variant="ghost" style={{ marginLeft: 'auto' }} onPress={() => router.push('/staff/dashboard')} /></View>
    </>}
    <ConfirmDialog visible={pending !== null} language={language} title={tx(language, 'Täze saýlawy başlamak isleýärsiňizmi?', 'Начать новый сеанс?')} description={tx(language, 'Öňki müşderiniň saýlawlary we netijesi aýrylar. Suratlar katalogy saklanar.', 'Выбор и результат предыдущего клиента будут удалены. Каталог фотографий сохранится.')} confirmLabel={tx(language, 'Täze saýlawy başlamak', 'Начать новый сеанс')} onConfirm={() => { if (pending) void start(pending); }} onCancel={() => setPending(null)} loading={busy} />
  </Screen>;
}
const styles = StyleSheet.create({
  languages: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 24, padding: 3 }, language: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, languageActive: { backgroundColor: colors.surface }, languageText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  resume: { backgroundColor: colors.greenSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
