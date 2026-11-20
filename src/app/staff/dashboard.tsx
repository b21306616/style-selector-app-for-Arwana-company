import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, ErrorBanner, Header, Screen, tx, typography, spaceLabel, useLayout } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PhotoTile, PhotoStrip } from '../../components/PhotoTile';
import { useApp } from '../../state/AppProvider';
import { useStaffAuth } from '../../features/staff/auth-context';
import { staffStyles as s } from '../../features/staff/shared';
import { SPACES, type Photo } from '../../domain/types';
import { messageForError } from '../../domain/errors';

export default function StaffDashboard() {
  const { draft, catalog, language, busy, resetDraft } = useApp();
  const auth = useStaffAuth();
  const { contentWidth, columns, tablet } = useLayout();
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  if (!draft || !catalog) return null;
  const byId = new Map(draft.photos.map(photo => [photo.id, photo]));
  const navigationColumns = columns === 1 ? 1 : tablet ? 3 : 2;
  const links = [
    { route: '/staff/photos' as const, title: t('Suratlar', 'Фотографии'), count: String(draft.photos.length), photo: draft.photos[0] },
    { route: '/staff/galleries' as const, title: t('Toplumlar', 'Подборки'), count: '5', photo: byId.get(draft.galleries.whole_house[0]) },
    { route: '/staff/vocabulary' as const, title: t('Stiller we aýratynlyklar', 'Стили и особенности'), count: String(draft.terms.length), photo: draft.photos.find(photo => photo.styleId !== draft.photos[0]?.styleId) ?? draft.photos[0] },
  ];
  return <Screen>
    <Header right={<Button title={t('Çykmak', 'Выйти')} variant="ghost" onPress={() => { auth.lock(); router.replace('/'); }} />} />
    <View style={s.row}><Text accessibilityRole="header" style={typography.heading}>{t('Işgär otagy', 'Кабинет сотрудника')}</Text><Text style={typography.small}>{t('Garalamany redaktirlemek', 'Редактирование черновика')}</Text></View>
    {error && <ErrorBanner message={error} />}
    <View style={[s.row, { alignItems: 'stretch', gap: 12 }]}>{links.map(link => <PhotoTile key={link.route} photo={link.photo} language={language} title={link.title} badge={link.count} label={link.title} onPress={() => router.push(link.route)} style={{ width: (contentWidth - (navigationColumns - 1) * 12) / navigationColumns }} />)}</View>
    <Button title={t('Barlamak we çap etmek', 'Проверить и опубликовать')} onPress={() => router.push('/staff/preview')} />
    <Text accessibilityRole="header" style={typography.subheading}>{t('Toplumlara umumy syn', 'Обзор подборок')}</Text>
    {SPACES.map(space => <View key={space} style={s.card}>
      <Text style={typography.subheading}>{spaceLabel(space, language)}</Text>
      <PhotoStrip photos={draft.galleries[space].slice(0, 4).map(id => byId.get(id)).filter((photo): photo is Photo => !!photo)} language={language} />
      <View style={s.row}><Text style={typography.small}>{t('Çap edilen', 'Опубликовано')}: {catalog.galleries[space].length}</Text><Text style={typography.small}>{t('Garalama', 'Черновик')}: {draft.galleries[space].length}</Text></View>
    </View>)}
    <Button title={t('Garalamanyň üýtgeşmelerini ýatyrmak', 'Отменить изменения черновика')} variant="ghost" onPress={() => setReset(true)} disabled={busy} />
    <ConfirmDialog visible={reset} language={language} title={t('Bu garalamany ýatyrmak isleýärsiňizmi?', 'Отменить этот черновик?')} description={t('Çap edilen katalogy dikeltmek. Çap edilmedik suratlar we üýtgeşmeler garalamadan aýrylar.', 'Вернуть опубликованный каталог. Неопубликованные фотографии и изменения будут удалены из черновика.')} confirmLabel={t('Üýtgeşmeleri ýatyrmak', 'Отменить изменения')} cancelLabel={t('Redaktirlemegi dowam etmek', 'Продолжить редактирование')} loading={busy} onCancel={() => setReset(false)} onConfirm={() => { void resetDraft().then(() => setReset(false)).catch(e => { setError(messageForError(e, language)); setReset(false); }); }} />
  </Screen>;
}
