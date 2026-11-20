import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, typography, spaceLabel, tx } from '../../components/ui';
import { PhotoStrip } from '../../components/PhotoTile';
import { Disclosure } from '../../components/Disclosure';
import { useApp } from '../../state/AppProvider';
import { validateCatalog } from '../../domain/catalog';
import { messageForError } from '../../domain/errors';
import { ROOMS, SPACES } from '../../domain/types';
import { StaffScreen, staffStyles as s } from '../../features/staff/shared';

export default function Preview() {
  const { draft, language, publishDraft, busy } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const t = (en: string, ru: string) => tx(language, en, ru);
  const issues = useMemo(() => validateCatalog(draft), [draft]);
  if (!draft) return null;
  const byId = new Map(draft.photos.map(photo => [photo.id, photo]));
  const subjectLabel = (id: string) => {
    const photo = byId.get(id);
    if (photo) return `${spaceLabel(photo.room, language)} · ${t('photo', 'фото')} ${draft.photos.indexOf(photo) + 1}`;
    const term = draft.terms.find(item => item.id === id);
    if (term) return term.labels[language] || t('Unnamed term', 'Термин без названия');
    if (SPACES.includes(id as (typeof SPACES)[number])) return spaceLabel(id as (typeof SPACES)[number], language);
    return t('Catalog', 'Каталог');
  };
  return <StaffScreen title={published ? t('Your galleries are ready', 'Подборки готовы') : t('Review & publish', 'Проверить и опубликовать')}>
    <Text style={typography.small}>{t('Publishes all galleries for new clients. Active sessions keep their original catalog.', 'Все подборки обновятся для новых клиентов. Текущие сеансы сохранят исходный каталог.')}</Text>
    {issues.length > 0 && <View style={s.card}><Text accessibilityRole="header" style={typography.subheading}>{t('Needs attention', 'Требует внимания')}</Text>{issues.slice(0, 30).map((issue, index) => <Text key={issue.code + '-' + index} style={typography.small}>{issue.labels[language]} — {subjectLabel(issue.subject)}</Text>)}{issues.length > 30 && <Text style={typography.small}>+ {issues.length - 30}</Text>}<Button title={t('Edit photo library', 'Открыть библиотеку')} onPress={() => router.replace('/staff/photos')} variant="secondary" /></View>}
    {error && <ErrorBanner message={error} />}
    {published ? <Button title={t('Back to workspace', 'Вернуться в кабинет')} onPress={() => router.replace('/staff/dashboard')} /> : <Button title={t('Publish these galleries', 'Опубликовать подборки')} disabled={issues.length > 0} loading={busy} onPress={() => { setError(null); void publishDraft().then(() => setPublished(true)).catch(e => setError(messageForError(e, language))); }} />}
    {SPACES.map(space => {
      const photos = draft.galleries[space].map(id => byId.get(id)).filter(photo => !!photo);
      const counts = new Map<string, number>();
      photos.forEach(photo => counts.set(photo.styleId, (counts.get(photo.styleId) ?? 0) + 1));
      const needsAttention = issues.some(issue => issue.subject === space || photos.some(photo => [photo.id, photo.styleId, ...photo.paletteIds, ...photo.materialIds, ...photo.detailIds].includes(issue.subject)));
      return <View key={space} style={s.card}>
        <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={typography.subheading}>{spaceLabel(space, language)}</Text><Chip label={photos.length + ' ' + t('photos', 'фото')} /></View>
        <PhotoStrip photos={photos} language={language} />
        {needsAttention ? <Text style={typography.small}>{t('Needs attention', 'Требует внимания')}</Text> : null}
        {photos.length === 0 ? <Text style={typography.small}>{t('Unavailable to clients', 'Недоступна клиентам')}</Text> : <Disclosure title={t('Style coverage', 'Состав подборки')}>
          <View style={s.row}>{[...counts].map(([id, count]) => <Chip key={id} label={(draft.terms.find(term => term.id === id)?.labels[language] ?? t('Untagged', 'Без стиля')) + ' · ' + count} />)}</View>
          {space === 'whole_house' && <Text style={typography.small}>{ROOMS.map(room => spaceLabel(room, language) + ': ' + photos.filter(photo => photo.room === room).length).join(' · ')}</Text>}
          <Text style={typography.small}>{photos.length > 20 ? t('Preliminary result after 20 choices.', 'Предварительный результат после 20 оценок.') : t('Result after the last photo.', 'Результат после последнего фото.')}</Text>
        </Disclosure>}
      </View>;
    })}
  </StaffScreen>;
}
