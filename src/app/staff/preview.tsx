import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, typography, photoRoomLabel, spaceLabel, tx } from '../../components/ui';
import { PhotoStrip } from '../../components/PhotoTile';
import { Disclosure } from '../../components/Disclosure';
import { useApp } from '../../state/AppProvider';
import { validateCatalog } from '../../domain/catalog';
import { messageForError } from '../../domain/errors';
import { catalogSpaces } from '../../domain/rooms';
import { photoFieldsForLanguage } from '../../domain/photo-metadata';
import { StaffScreen, staffStyles as s } from '../../features/staff/shared';

export default function Preview() {
  const { draft, language, publishDraft, busy } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  const issues = useMemo(() => validateCatalog(draft), [draft]);
  if (!draft) return null;
  const byId = new Map(draft.photos.map(photo => [photo.id, photo]));
  const subjectLabel = (id: string) => {
    const photo = byId.get(id);
    if (photo) return `${photoRoomLabel(photo, language, draft.rooms)} · ${t('surat', 'фото')} ${draft.photos.indexOf(photo) + 1}`;
    const term = draft.terms.find(item => item.id === id);
    if (term) return term.labels[language] || t('Atlandyrylmadyk termin', 'Термин без названия');
    if (catalogSpaces(draft).includes(id)) return spaceLabel(id, language, draft.rooms);
    return t('Katalog', 'Каталог');
  };
  return <StaffScreen title={published ? t('Toplumlar taýyn', 'Подборки готовы') : t('Barlamak we çap etmek', 'Проверить и опубликовать')}>
    <Text style={typography.small}>{t('Ähli toplumlar täze müşderiler üçin çap ediler. Häzirki seanslar asyl katalogy saklar.', 'Все подборки обновятся для новых клиентов. Текущие сеансы сохранят исходный каталог.')}</Text>
    {issues.length > 0 && <View style={s.card}><Text accessibilityRole="header" style={typography.subheading}>{t('Üns berilmeli', 'Требует внимания')}</Text>{issues.slice(0, 30).map((issue, index) => <Text key={issue.code + '-' + index} style={typography.small}>{issue.labels[language]} — {subjectLabel(issue.subject)}</Text>)}{issues.length > 30 && <Text style={typography.small}>+ {issues.length - 30}</Text>}<Button title={t('Suratlar hazynasyny açmak', 'Открыть библиотеку')} onPress={() => router.replace('/staff/photos')} variant="secondary" /></View>}
    {error && <ErrorBanner message={error} />}
    {published ? <Button title={t('Işgär otagyna dolanmak', 'Вернуться в кабинет')} onPress={() => router.replace('/staff/dashboard')} /> : <Button title={t('Bu toplumlary çap etmek', 'Опубликовать подборки')} disabled={issues.length > 0} loading={busy} onPress={() => { setError(null); void publishDraft().then(() => setPublished(true)).catch(e => setError(messageForError(e, language))); }} />}
    {catalogSpaces(draft).map(space => {
      const photos = draft.galleries[space].map(id => byId.get(id)).filter(photo => !!photo);
      const counts = new Map<string, number>();
      photos.forEach(photo => {
        const { styleId } = photoFieldsForLanguage(photo, language);
        counts.set(styleId, (counts.get(styleId) ?? 0) + 1);
      });
      const needsAttention = issues.some(issue => issue.subject === space || photos.some(photo => [photo.id, photo.styleId, ...photo.paletteIds, ...photo.materialIds, ...photo.detailIds].includes(issue.subject)));
      return <View key={space} style={s.card}>
        <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={typography.subheading}>{spaceLabel(space, language, draft.rooms)}</Text><Chip label={photos.length + ' ' + t('surat', 'фото')} /></View>
        <PhotoStrip photos={photos} language={language} />
        {needsAttention ? <Text style={typography.small}>{t('Üns berilmeli', 'Требует внимания')}</Text> : null}
        {photos.length === 0 ? <Text style={typography.small}>{t('Müşderilere elýeterli däl', 'Недоступна клиентам')}</Text> : <Disclosure title={t('Toplumyň düzümi', 'Состав подборки')}>
          <View style={s.row}>{[...counts].map(([id, count]) => <Chip key={id} label={(draft.terms.find(term => term.id === id)?.labels[language] ?? t('Stilsiz', 'Без стиля')) + ' · ' + count} />)}</View>
          <Text style={typography.small}>{photos.length > 20 ? t('20 saýlawdan soň deslapky netije.', 'Предварительный результат после 20 оценок.') : t('Soňky suratdan soň netije.', 'Результат после последнего фото.')}</Text>
        </Disclosure>}
      </View>;
    })}
  </StaffScreen>;
}
