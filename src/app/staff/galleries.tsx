import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, TextField, typography, spaceLabel, tx } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { useApp } from '../../state/AppProvider';
import { SPACES, Space } from '../../domain/types';
import { messageForError } from '../../domain/errors';
import { StaffList, staffStyles as s } from '../../features/staff/shared';

export default function Galleries() {
  const { draft, language, saveDraft, busy } = useApp();
  const [space, setSpace] = useState<Space>('whole_house');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ru: string) => tx(language, en, ru);
  const photos = useMemo(() => {
    if (!draft) return [];
    const byId = new Map(draft.photos.map(photo => [photo.id, photo]));
    const list = selectedOnly ? draft.galleries[space].map(id => byId.get(id)!).filter(Boolean) : draft.photos.filter(photo => space === 'whole_house' || photo.room === space);
    const terms = new Map(draft.terms.map(term => [term.id, `${term.labels.en} ${term.labels.ru}`]));
    const query = search.trim().toLocaleLowerCase();
    return list.filter(photo => !query || `${photo.id} ${spaceLabel(photo.room, language)} ${terms.get(photo.styleId) ?? ''}`.toLocaleLowerCase().includes(query));
  }, [draft, space, selectedOnly, search, language]);
  if (!draft) return null;
  const deck = draft.galleries[space];
  async function update(ids: string[]) {
    if (!draft || busy) return;
    setError(null);
    try { await saveDraft({ ...draft, galleries: { ...draft.galleries, [space]: ids } }); }
    catch (e) { setError(messageForError(e, language)); }
  }
  function move(id: string, delta: number) {
    const index = deck.indexOf(id); const target = index + delta;
    if (target < 0 || target >= deck.length) return;
    const next = [...deck]; [next[index], next[target]] = [next[target], next[index]];
    void update(next);
  }
  return <StaffList title={t('Curate galleries', 'Подборки для клиентов')} data={photos} keyExtractor={photo => photo.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} contentContainerStyle={{ paddingBottom: 24 }} header={<View style={s.section}>
      <View style={s.row}>{SPACES.map(value => <Chip key={value} label={spaceLabel(value, language)} selected={space === value} onPress={() => { setSpace(value); setSearch(''); }} />)}</View>
      <Text style={typography.body}>{deck.length} {t('photos selected. Changes save to your draft immediately.', 'фото выбрано. Изменения сразу сохраняются в черновик.')}</Text>
      <Text style={typography.small}>{t('Choose “Selected order” to arrange the sequence. Whole House is an independent selection and may include any room. An empty gallery is unavailable to clients.', 'Выберите «Порядок показа», чтобы упорядочить фотографии. «Весь дом» — независимая подборка из любых комнат. Пустая подборка будет недоступна клиентам.')}</Text>
      <View style={s.row}><Chip label={t('Photo library', 'Библиотека')} selected={!selectedOnly} onPress={() => setSelectedOnly(false)} /><Chip label={t('Selected order', 'Порядок показа')} selected={selectedOnly} onPress={() => setSelectedOnly(true)} /></View>
      <TextField label={t('Search room or style', 'Поиск по комнате или стилю')} value={search} onChangeText={setSearch} />
      {error && <ErrorBanner message={error} />}
    </View>} ListEmptyComponent={<Text style={typography.body}>{t('No photos here yet. Import photos or select them from the library.', 'Здесь пока нет фотографий. Добавьте их или выберите из библиотеки.')}</Text>} renderItem={({ item }) => {
      const position = deck.indexOf(item.id);
      const style = draft.terms.find(term => term.id === item.styleId);
      return <View style={[s.line, { flexWrap: 'wrap' }]}>
        <PhotoImage photo={item} thumbnail language={language} style={s.thumbnail} />
        <View style={{ flex: 1, minWidth: 100, gap: 4 }}><Text style={typography.small}>{spaceLabel(item.room, language)}</Text><Text style={s.label}>{style?.labels[language] ?? t('Needs tags', 'Нужны теги')}</Text>{position >= 0 && <Text style={typography.small}>{t('Position', 'Позиция')} {position + 1}</Text>}</View>
        <View style={s.row}>{selectedOnly && <><Button title="↑" accessibilityLabel={t('Move photo earlier', 'Переместить фото раньше')} variant="secondary" disabled={busy || position <= 0} onPress={() => move(item.id, -1)} /><Button title="↓" accessibilityLabel={t('Move photo later', 'Переместить фото позже')} variant="secondary" disabled={busy || position === deck.length - 1} onPress={() => move(item.id, 1)} /></>}
          <Button title={position >= 0 ? t('Remove', 'Убрать') : t('Add', 'Добавить')} variant={position >= 0 ? 'secondary' : 'primary'} disabled={busy} onPress={() => void update(position >= 0 ? deck.filter(id => id !== item.id) : [...deck, item.id])} />
        </View>
      </View>;
    }} />;
}
