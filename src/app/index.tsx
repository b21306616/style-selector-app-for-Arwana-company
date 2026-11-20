import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PhotoTile } from '../components/PhotoTile';
import { Button, ErrorBanner, Header, Screen, colors, errorText, photoCount, spaceLabel, tx, typography, useLayout } from '../components/ui';
import { ROOMS, type Language, type Space } from '../domain/types';
import { useApp } from '../state/AppProvider';

export default function HomeScreen() {
  const app = useApp();
  const { language, catalog, session, busy } = app;
  const layout = useLayout();
  const [pending, setPending] = useState<Space | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async (space: Space) => {
    try { setFailure(null); await app.startSession(space); setPending(null); router.push('/gallery'); }
    catch (error) { setPending(null); setFailure(errorText(error, language)); }
  };
  const choose = (space: Space) => { if (session && session.ratings.length > 0) setPending(space); else void start(space); };
  const changeLanguage = async (next: Language) => { try { await app.setLanguage(next); } catch (error) { setFailure(errorText(error, language)); } };
  const heroId = catalog?.galleries.whole_house.find(id => catalog.photos.find(p => p.id === id)?.room === 'living_room') ?? catalog?.galleries.whole_house[0];
  const hero = catalog?.photos.find(photo => photo.id === heroId);
  const roomColumns = layout.columns === 1 ? 1 : 2;
  const roomsWidth = layout.wide ? (layout.contentWidth - 16) * 0.56 : layout.contentWidth;
  const total = catalog?.galleries.whole_house.length ?? 0;
  return <Screen>
    <Header right={<View style={styles.languages}>{(['ru', 'en'] as const).map(lang => <Pressable key={lang} accessibilityRole="button" accessibilityLabel={lang === 'ru' ? 'Русский' : 'English'} accessibilityState={{ selected: language === lang }} onPress={() => void changeLanguage(lang)} disabled={busy} style={[styles.language, language === lang && styles.languageActive]}><Text style={[styles.languageText, language === lang && { color: colors.green }]}>{lang.toUpperCase()}</Text></Pressable>)}</View>} />
    {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} onRetry={() => { setFailure(null); void app.refresh(); }} retryLabel={tx(language, 'Try again', 'Повторить')} /> : null}
    {app.notices.length ? <View style={{ gap: 12 }}>{app.notices.map(code => <ErrorBanner key={code} message={errorText(code, language)} />)}<Button title={tx(language, 'Got it', 'Понятно')} variant="ghost" onPress={app.dismissNotices} /></View> : null}
    {!app.ready ? <ActivityIndicator color={colors.green} size="large" /> : <>
      {session ? <View style={styles.resume}><Text style={[typography.small, { flexGrow: 1, flexShrink: 1 }]}>{spaceLabel(session.space, language)} · {session.ratings.length}/{session.catalog.galleries[session.space].length}</Text><Button title={session.status === 'complete' ? tx(language, 'View result', 'Результат') : tx(language, 'Continue', 'Продолжить')} onPress={() => router.push(session.status === 'complete' ? '/result' : '/gallery')} variant="ghost" /></View> : null}
      <Text accessibilityRole="header" style={typography.heading}>{tx(language, 'Choose a space', 'Выберите пространство')}</Text>
      <View style={[styles.spaces, layout.wide && styles.spacesWide]}>
        <PhotoTile photo={hero} thumbnail={false} language={language} title={spaceLabel('whole_house', language)} subtitle={total ? photoCount(total, language) : tx(language, 'Unavailable', 'Недоступно')} label={spaceLabel('whole_house', language) + ', ' + photoCount(total, language)} disabled={busy || !total} onPress={() => choose('whole_house')} style={layout.wide ? { width: (layout.contentWidth - 16) * 0.44, alignSelf: 'flex-start' } : undefined} imageStyle={{ aspectRatio: layout.wide ? 0.94 : 1.85 }} />
        <View style={[styles.grid, { width: roomsWidth }]}>{ROOMS.map(room => {
          const ids = catalog?.galleries[room] ?? [];
          const photo = catalog?.photos.find(item => item.id === ids[0]);
          return <PhotoTile key={room} photo={photo} language={language} title={spaceLabel(room, language)} subtitle={ids.length ? photoCount(ids.length, language) : tx(language, 'Unavailable', 'Недоступно')} label={spaceLabel(room, language) + ', ' + photoCount(ids.length, language)} disabled={busy || !ids.length} onPress={() => choose(room)} style={{ width: (roomsWidth - (roomColumns - 1) * 12) / roomColumns }} />;
        })}</View>
      </View>
      <View style={styles.footer}>{catalog?.sample ? <Text style={typography.small}>{tx(language, 'Sample interiors', 'Примеры интерьеров')}</Text> : null}<Button title={tx(language, 'Staff', 'Сотрудникам')} variant="ghost" onPress={() => router.push('/staff/dashboard')} /></View>
    </>}
    <ConfirmDialog visible={pending !== null} language={language} title={tx(language, 'Start a fresh selection?', 'Начать новый сеанс?')} description={tx(language, 'This clears the previous client’s choices and result. The photo catalog stays.', 'Выбор и результат предыдущего клиента будут удалены. Каталог фотографий сохранится.')} confirmLabel={tx(language, 'Start new session', 'Начать новый сеанс')} onConfirm={() => { if (pending) void start(pending); }} onCancel={() => setPending(null)} loading={busy} />
  </Screen>;
}
const styles = StyleSheet.create({
  languages: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 24, padding: 3 }, language: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, languageActive: { backgroundColor: colors.surface }, languageText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  resume: { backgroundColor: colors.greenSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, spaces: { gap: 16 }, spacesWide: { flexDirection: 'row', alignItems: 'flex-start' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});
