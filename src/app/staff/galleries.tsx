import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Chip, ErrorBanner, TextField, typography, photoRoomLabel, spaceLabel, tx, useLayout } from '../../components/ui';
import { PhotoTile } from '../../components/PhotoTile';
import { IconButton } from '../../components/Icon';
import { Disclosure } from '../../components/Disclosure';
import { useApp } from '../../state/AppProvider';
import type { Room } from '../../domain/types';
import { catalogSpaces } from '../../domain/rooms';
import { photoFieldsForLanguage, photoTermSearchText } from '../../domain/photo-metadata';
import { messageForError } from '../../domain/errors';
import { StaffList, StaffScreen, staffStyles as s } from '../../features/staff/shared';

export default function Galleries() {
  const { draft, language, saveDraft, busy } = useApp();
  const { contentWidth, columns } = useLayout();
  const [requestedSpace, setSpace] = useState<Room>();
  const space = draft?.rooms.find(room => room.id === requestedSpace)?.id ?? draft?.rooms[0]?.id;
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  const terms = useMemo(() => new Map(draft?.terms.map(term => [term.id, term])), [draft?.terms]);
  const photos = useMemo(() => {
    if (!draft || !space) return [];
    const byId = new Map(draft.photos.map(photo => [photo.id, photo]));
    const list = selectedOnly ? draft.galleries[space].map(id => byId.get(id)!).filter(Boolean) : draft.photos.filter(photo => photo.room === space);
    const query = search.trim().toLocaleLowerCase();
    return list.filter(photo => !query || `${photo.id} ${photoRoomLabel(photo, language, draft.rooms)} ${photoTermSearchText(photo, terms, 'style')}`.toLocaleLowerCase().includes(query));
  }, [draft, space, selectedOnly, search, language, terms]);
  if (!draft) return null;
  if (!space) return <StaffScreen title={t('Toplumlar', 'Подборки')}>
    <Text style={typography.body}>{t('Ilki garalama formasynda otag goşuň.', 'Сначала добавьте комнату в форме черновика.')}</Text>
  </StaffScreen>;
  const deck = draft.galleries[space];
  async function update(ids: string[]) {
    if (!draft || !space || busy) return;
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
  return <StaffList title={t('Toplumlar', 'Подборки')} key={columns} data={photos} numColumns={columns} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} keyExtractor={photo => photo.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} contentContainerStyle={{ paddingBottom: 24 }} header={<View style={s.section}>
      <View style={s.row}>{catalogSpaces(draft).map(value => <Chip key={value} label={spaceLabel(value, language, draft.rooms)} selected={space === value} onPress={() => { setSpace(value); setSearch(''); }} />)}</View>
      <View style={s.row}><Text style={typography.small}>{deck.length} {t('saýlandy', 'выбрано')} · {t('Garalama', 'Черновик')}</Text><Chip label={t('Suratlar', 'Библиотека')} selected={!selectedOnly} onPress={() => setSelectedOnly(false)} /><Chip label={t('Görkeziliş tertibi', 'Порядок показа')} selected={selectedOnly} onPress={() => setSelectedOnly(true)} /></View>
      <TextField label={t('Otag ýa-da stil boýunça gözleg', 'Поиск по комнате или стилю')} value={search} onChangeText={setSearch} />
      <Disclosure title={t('Surat saýlamak kömegi', 'Как выбрать фото')}><Text style={typography.small}>{t('Suraty goşmak üçin +, aýyrmak üçin ✓ basyň. Görkeziliş tertibini peýkamlar bilen üýtgediň.', 'Нажмите +, чтобы добавить фото, или ✓, чтобы убрать. В «Порядке показа» перемещайте фото стрелками.')}</Text></Disclosure>
      {error && <ErrorBanner message={error} />}
    </View>} ListEmptyComponent={<Text style={typography.body}>{t('Suratlar tapylmady. Surat goşuň ýa-da süzgüçleri üýtgediň.', 'Фото не найдены. Добавьте фотографии или измените фильтры.')}</Text>} renderItem={({ item }) => {
      const position = deck.indexOf(item.id);
      const roomName = photoRoomLabel(item, language, draft.rooms);
      const styleName = terms.get(photoFieldsForLanguage(item, language).styleId)?.labels[language] || t('Tegler gerek', 'Нужны теги');
      return <View style={{ width: (contentWidth - (columns - 1) * 12) / columns, marginBottom: 12, gap: 4 }}>
        <PhotoTile photo={item} language={language} title={roomName} subtitle={styleName} selected={position >= 0} badge={position >= 0 ? String(position + 1) : undefined}
          label={(position >= 0 ? t('Suraty aýyrmak', 'Убрать фото') : t('Surat goşmak', 'Добавить фото')) + ': ' + roomName + ', ' + styleName + (position >= 0 ? ', ' + t('orun', 'позиция') + ' ' + (position + 1) : '')}
          disabled={busy} onPress={() => void update(position >= 0 ? deck.filter(id => id !== item.id) : [...deck, item.id])} />
        {selectedOnly ? <View style={[s.row, { justifyContent: 'center' }]}><IconButton icon="up" label={t('Suraty öňe süýşürmek', 'Переместить фото раньше')} fallbackLabel={t('Öňe', 'Раньше')} disabled={busy || position <= 0} onPress={() => move(item.id, -1)} /><IconButton icon="down" label={t('Suraty yza süýşürmek', 'Переместить фото позже')} fallbackLabel={t('Yza', 'Позже')} disabled={busy || position === deck.length - 1} onPress={() => move(item.id, 1)} /></View> : null}
      </View>;
    }} />;
}
