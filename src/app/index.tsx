import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PhotoImage } from '../components/PhotoImage';
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
  const twoColumns = layout.width >= 420 && layout.fontScale < 1.5;
  return <Screen>
    <Header subtitle={tx(language, 'INTERIOR STORIES', 'ИНТЕРЬЕРНЫЕ ИСТОРИИ')} right={<View style={styles.languages}>{(['ru', 'en'] as const).map(lang => <Pressable key={lang} accessibilityRole="button" accessibilityLabel={lang === 'ru' ? 'Русский' : 'English'} accessibilityState={{ selected: language === lang }} onPress={() => void changeLanguage(lang)} disabled={busy} style={[styles.language, language === lang && styles.languageActive]}><Text style={[styles.languageText, language === lang && styles.languageTextActive]}>{lang.toUpperCase()}</Text></Pressable>)}</View>} />
    {failure || app.error ? <ErrorBanner message={failure ?? errorText(app.error, language)} onRetry={() => { setFailure(null); void app.refresh(); }} retryLabel={tx(language, 'Try again', 'Повторить')} /> : null}
    {app.notices.length ? <View style={{ gap: 12 }}>{app.notices.map(code => <ErrorBanner key={code} message={errorText(code, language)} />)}<Button title={tx(language, 'Got it', 'Понятно')} variant="ghost" onPress={app.dismissNotices} /></View> : null}
    {!app.ready ? <ActivityIndicator color={colors.green} size="large" style={{ padding: 40 }} /> : <>
      <View style={[styles.intro, layout.wide && styles.introWide]}>
        <View style={styles.introText}><Text style={typography.eyebrow}>{tx(language, 'A little inspiration. A clearer direction.', 'Немного вдохновения. Больше ясности.')}</Text>
          <Text accessibilityRole="header" style={[typography.title, layout.tablet && styles.largeTitle]}>{tx(language, 'A home that feels\nlike you.', 'Дом, в котором\nвы — это вы.')}</Text>
          <Text style={[typography.body, styles.introDescription]}>{tx(language, 'Follow your instinct. Choose the interiors you love, and discover what brings them together.', 'Доверьтесь ощущениям. Выбирайте интерьеры, которые нравятся, и узнайте, что их объединяет.')}</Text>
        </View>
        <View style={styles.guide}><Text style={typography.eyebrow}>{tx(language, 'Made simple', 'Всё просто')}</Text>{[
          tx(language, 'Choose your space', 'Выберите пространство'), tx(language, 'Like what feels right', 'Отметьте, что вам нравится'), tx(language, 'Discover your style', 'Узнайте свой стиль'),
        ].map((text, index) => <View key={text} style={styles.guideRow}><Text style={styles.guideNumber}>0{index + 1}</Text><Text style={styles.guideText}>{text}</Text></View>)}</View>
      </View>
      {session ? <View style={[styles.resume, layout.wide && styles.resumeWide]}><View style={{ flex: 1, gap: 5 }}><Text style={typography.subheading}>{tx(language, 'Your selections are waiting', 'Ваши предпочтения сохранены')}</Text><Text style={typography.small}>{spaceLabel(session.space, language)} · {session.ratings.length} / {session.catalog.galleries[session.space].length}</Text></View><Button title={session.status === 'complete' ? tx(language, 'View result', 'Смотреть результат') : tx(language, 'Continue', 'Продолжить')} onPress={() => router.push(session.status === 'complete' ? '/result' : '/gallery')} variant="secondary" icon="↗" /></View> : null}
      <View style={styles.sectionHeading}><Text accessibilityRole="header" style={typography.heading}>{tx(language, 'Where shall we begin?', 'С чего начнём?')}</Text><Text style={typography.small}>{tx(language, 'One room, or the whole story.', 'Одна комната или весь дом.')}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${spaceLabel('whole_house', language)}, ${photoCount(catalog?.galleries.whole_house.length ?? 0, language)}`} accessibilityState={{ disabled: busy || !catalog?.galleries.whole_house.length }} disabled={busy || !catalog?.galleries.whole_house.length} onPress={() => choose('whole_house')} style={({ pressed }) => [styles.hero, layout.tablet && styles.heroWide, pressed && { opacity: 0.88 }]}>
        {hero ? <PhotoImage key={hero.id} photo={hero} language={language} style={[styles.heroImage, layout.tablet && styles.heroImageWide]} /> : <View style={styles.heroImage} />}
        <View style={styles.heroCopy}><Text style={[typography.eyebrow, { color: '#C8D4BF' }]}>{tx(language, 'The complete picture', 'Целостный образ')}</Text><Text style={styles.heroTitle}>{spaceLabel('whole_house', language)}</Text><Text style={styles.heroDescription}>{tx(language, 'Find the thread that connects every room.', 'Найдите то, что объединяет каждую комнату.')}</Text><View style={styles.heroFooter}><Text style={styles.heroCount}>{catalog?.galleries.whole_house.length ? photoCount(catalog.galleries.whole_house.length, language) : tx(language, 'Coming soon', 'Скоро')}</Text><Text accessible={false} style={styles.heroArrow}>↗</Text></View></View>
      </Pressable>
      <View style={styles.grid}>{ROOMS.map((room, index) => {
        const ids = catalog?.galleries[room] ?? [];
        const photo = catalog?.photos.find(item => item.id === ids[0]);
        return <Pressable key={room} accessibilityRole="button" accessibilityLabel={`${spaceLabel(room, language)}, ${photoCount(ids.length, language)}`} accessibilityState={{ disabled: busy || !ids.length }} disabled={busy || !ids.length} onPress={() => choose(room)} style={({ pressed }) => [styles.roomCard, { width: twoColumns ? (layout.contentWidth - 18) / 2 : '100%' }, pressed && { opacity: 0.8 }]}>
          {photo ? <PhotoImage key={photo.id} photo={photo} thumbnail language={language} style={[styles.roomImage, { height: layout.tablet ? 220 : 180 }]} /> : <View style={[styles.roomImage, { height: 180 }]} />}
          <View style={styles.roomCopy}><Text style={styles.roomNumber}>0{index + 1}</Text><View style={{ flex: 1, gap: 4 }}><Text style={typography.subheading}>{spaceLabel(room, language)}</Text><Text style={typography.small}>{ids.length ? photoCount(ids.length, language) : tx(language, 'Not available yet', 'Пока недоступно')}</Text></View><Text accessible={false} style={styles.roomArrow}>↗</Text></View>
        </Pressable>;
      })}</View>
      <View style={styles.footer}><Button title={tx(language, 'Staff', 'Сотрудникам')} variant="ghost" onPress={() => router.push('/staff/dashboard')} /></View>
    </>}
    <ConfirmDialog visible={pending !== null} language={language} title={tx(language, 'Start a fresh selection?', 'Начать новый сеанс?')} description={tx(language, 'The previous client’s choices and result will be cleared. Your photo collection stays unchanged.', 'Предпочтения и результат предыдущего клиента будут удалены. Коллекция фотографий сохранится.')} confirmLabel={tx(language, 'Start new session', 'Начать новый сеанс')} onConfirm={() => { if (pending) void start(pending); }} onCancel={() => setPending(null)} loading={busy} />
  </Screen>;
}
const styles = StyleSheet.create({
  languages: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 24, padding: 3 }, language: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, languageActive: { backgroundColor: colors.surface }, languageText: { fontSize: 12, fontWeight: '600', color: colors.muted }, languageTextActive: { color: colors.green },
  intro: { gap: 28, paddingVertical: 12 }, introWide: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 28 }, introText: { flex: 1, gap: 16 }, largeTitle: { fontSize: 52, lineHeight: 59, letterSpacing: -2 }, introDescription: { maxWidth: 500 },
  guide: { gap: 15, padding: 24, borderRadius: 20, backgroundColor: '#ECEEE3', minWidth: 260 }, guideRow: { flexDirection: 'row', gap: 14, alignItems: 'center' }, guideNumber: { color: colors.green, fontSize: 12, fontWeight: '700', letterSpacing: 1 }, guideText: { fontSize: 14, color: colors.ink, flexShrink: 1 },
  resume: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 20, gap: 16 }, resumeWide: { flexDirection: 'row', alignItems: 'center' }, sectionHeading: { gap: 5 }, hero: { overflow: 'hidden', borderRadius: 24, backgroundColor: colors.green }, heroWide: { flexDirection: 'row' }, heroImage: { width: '100%', height: 235 }, heroImageWide: { width: '54%', height: '100%', minHeight: 280 }, heroCopy: { flex: 1, padding: 28, gap: 12, justifyContent: 'center' }, heroTitle: { color: colors.white, fontSize: 32, fontWeight: '500', letterSpacing: -1 }, heroDescription: { color: '#D7E0D4', fontSize: 15, lineHeight: 23, maxWidth: 280 }, heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, heroCount: { color: colors.white, fontSize: 13 }, heroArrow: { color: colors.white, fontSize: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 18 }, roomCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, roomImage: { width: '100%', backgroundColor: colors.sand }, roomCopy: { padding: 18, flexDirection: 'row', gap: 12, alignItems: 'center' }, roomNumber: { fontSize: 11, color: colors.muted, alignSelf: 'flex-start', paddingTop: 5 }, roomArrow: { color: colors.green, fontSize: 23 }, footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 16, paddingTop: 10 },
});
