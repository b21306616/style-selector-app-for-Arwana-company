import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Chip, ErrorBanner, TextField, typography, spaceLabel, tx, useLayout } from '../../components/ui';
import { PhotoTile } from '../../components/PhotoTile';
import { IconButton } from '../../components/Icon';
import { Disclosure } from '../../components/Disclosure';
import { useApp } from '../../state/AppProvider';
import { SPACES, Space } from '../../domain/types';
import { messageForError } from '../../domain/errors';
import { StaffList, staffStyles as s } from '../../features/staff/shared';

export default function Galleries() {
  const { draft, language, saveDraft, busy } = useApp();
  const { contentWidth, columns } = useLayout();
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
  return <StaffList title={t('Galleries', 'Подборки')} key={columns} data={photos} numColumns={columns} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} keyExtractor={photo => photo.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} contentContainerStyle={{ paddingBottom: 24 }} header={<View style={s.section}>
      <View style={s.row}>{SPACES.map(value => <Chip key={value} label={spaceLabel(value, language)} selected={space === value} onPress={() => { setSpace(value); setSearch(''); }} />)}</View>
      <View style={s.row}><Text style={typography.small}>{deck.length} {t('selected', 'выбрано')} · {t('Draft', 'Черновик')}</Text><Chip label={t('Photo library', 'Библиотека')} selected={!selectedOnly} onPress={() => setSelectedOnly(false)} /><Chip label={t('Selected order', 'Порядок показа')} selected={selectedOnly} onPress={() => setSelectedOnly(true)} /></View>
      <TextField label={t('Search room or style', 'Поиск по комнате или стилю')} value={search} onChangeText={setSearch} />
      <Disclosure title={t('Selection help', 'Как выбрать фото')}><Text style={typography.small}>{t('Tap + to select, ✓ to remove. Use arrows in Selected order to reorder. Changes save to the draft. Whole House is independent; empty galleries are unavailable to clients.', 'Нажмите +, чтобы выбрать, ✓ — убрать. Меняйте порядок стрелками в «Порядке показа». Изменения сохраняются в черновик. «Весь дом» — отдельная подборка; пустые подборки недоступны клиентам.')}</Text></Disclosure>
      {error && <ErrorBanner message={error} />}
    </View>} ListEmptyComponent={<Text style={typography.body}>{t('No photos found. Import photos or change your filters.', 'Фото не найдены. Добавьте фотографии или измените фильтры.')}</Text>} renderItem={({ item }) => {
      const position = deck.indexOf(item.id);
      const style = draft.terms.find(term => term.id === item.styleId);
      return <View style={{ width: (contentWidth - (columns - 1) * 12) / columns, marginBottom: 12, gap: 4 }}>
        <PhotoTile photo={item} language={language} title={spaceLabel(item.room, language)} subtitle={style?.labels[language] ?? t('Needs tags', 'Нужны теги')} selected={position >= 0} badge={position >= 0 ? String(position + 1) : undefined}
          label={(position >= 0 ? t('Remove photo', 'Убрать фото') : t('Add photo', 'Добавить фото')) + ': ' + spaceLabel(item.room, language) + ', ' + (style?.labels[language] ?? t('Needs tags', 'Нужны теги')) + (position >= 0 ? ', ' + t('position', 'позиция') + ' ' + (position + 1) : '')}
          disabled={busy} onPress={() => void update(position >= 0 ? deck.filter(id => id !== item.id) : [...deck, item.id])} />
        {selectedOnly ? <View style={[s.row, { justifyContent: 'center' }]}><IconButton icon="up" label={t('Move photo earlier', 'Переместить фото раньше')} fallbackLabel={t('Earlier', 'Раньше')} disabled={busy || position <= 0} onPress={() => move(item.id, -1)} /><IconButton icon="down" label={t('Move photo later', 'Переместить фото позже')} fallbackLabel={t('Later', 'Позже')} disabled={busy || position === deck.length - 1} onPress={() => move(item.id, 1)} /></View> : null}
      </View>;
    }} />;
}
