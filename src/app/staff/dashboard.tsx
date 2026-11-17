import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, ErrorBanner, Header, Screen, tx, typography, spaceLabel, colors, useLayout } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useApp } from '../../state/AppProvider';
import { useStaffAuth } from '../../features/staff/auth-context';
import { staffStyles as s } from '../../features/staff/shared';
import { SPACES } from '../../domain/types';
import { messageForError } from '../../domain/errors';

export default function StaffDashboard() {
  const { draft, catalog, language, busy, resetDraft } = useApp();
  const auth = useStaffAuth();
  const { tablet } = useLayout();
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ru: string) => tx(language, en, ru);
  if (!draft || !catalog) return null;
  const links = [
    { route: '/staff/photos' as const, index: '01', title: t('Photo library', 'Библиотека фотографий'), body: t('Import interiors and describe what makes them special.', 'Добавляйте интерьеры и отмечайте их особенности.'), count: String(draft.photos.length) },
    { route: '/staff/vocabulary' as const, index: '02', title: t('Styles & features', 'Стили и особенности'), body: t('A shared vocabulary, in Russian and English.', 'Общий словарь на русском и английском.'), count: String(draft.terms.length) },
    { route: '/staff/galleries' as const, index: '03', title: t('Curate galleries', 'Подборки для клиентов'), body: t('Choose the photos and the order your clients see.', 'Выберите фотографии и порядок их показа.'), count: '5' },
  ];
  return <Screen>
    <Header right={<Button title={t('Lock & leave', 'Закрыть кабинет')} variant="secondary" onPress={() => { auth.lock(); router.replace('/'); }} />} />
    <View style={{ gap: 10 }}><Text style={typography.eyebrow}>{t('YOUR SHOWROOM, YOUR CURATION', 'ВАШ ШОУРУМ, ВАШ ВЫБОР')}</Text><Text style={typography.title}>{t('The staff workspace', 'Кабинет сотрудника')}</Text><Text style={typography.body}>{t('Changes are saved as a draft. Publish when your galleries are ready for the next client.', 'Изменения сохраняются в черновик. Опубликуйте подборки, когда они будут готовы для нового клиента.')}</Text></View>
    {error && <ErrorBanner message={error} />}
    <View style={[s.row, { alignItems: 'stretch' }]}>{links.map(link => <Pressable key={link.route} accessibilityRole="button" onPress={() => router.push(link.route)} style={({ pressed }) => [s.card, { flexGrow: 1, flexBasis: tablet ? 250 : '100%', opacity: pressed ? 0.7 : 1 }]}>
      <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={typography.eyebrow}>{link.index}</Text><Text style={[typography.heading, { color: colors.green }]}>{link.count}</Text></View>
      <Text style={typography.subheading}>{link.title}</Text><Text style={typography.body}>{link.body}</Text><Text style={[typography.small, { color: colors.green }]}>{t('Open →', 'Открыть →')}</Text>
    </Pressable>)}</View>
    <View style={s.card}><Text style={typography.subheading}>{t('Published galleries', 'Опубликованные подборки')}</Text>{SPACES.map(space => <View key={space} style={[s.row, { justifyContent: 'space-between' }]}><Text style={typography.body}>{spaceLabel(space, language)}</Text><Text style={typography.small}>{catalog.galleries[space].length} → {draft.galleries[space].length}</Text></View>)}<Text style={typography.small}>{t('Published count → draft count. Active client selections keep their original catalog.', 'Опубликовано → в черновике. Текущие сеансы клиентов сохранят исходный каталог.')}</Text></View>
    <Button title={t('Review & publish', 'Проверить и опубликовать')} onPress={() => router.push('/staff/preview')} />
    <Button title={t('Discard draft changes', 'Отменить изменения черновика')} variant="ghost" onPress={() => setReset(true)} disabled={busy} />
    <ConfirmDialog visible={reset} language={language} title={t('Discard this draft?', 'Отменить этот черновик?')} description={t('The draft will return to the published catalog. Unpublished photo imports and edits will leave the draft.', 'Черновик вернётся к опубликованному каталогу. Неопубликованные фотографии и изменения будут удалены из черновика.')} confirmLabel={t('Discard changes', 'Отменить изменения')} cancelLabel={t('Keep editing', 'Продолжить редактирование')} loading={busy} onCancel={() => setReset(false)} onConfirm={() => { void resetDraft().then(() => setReset(false)).catch(e => { setError(messageForError(e, language)); setReset(false); }); }} />
  </Screen>;
}
