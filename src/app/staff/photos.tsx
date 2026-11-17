import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, Header, Screen, TextField, colors, typography, spaceLabel, tx, useLayout } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AppModal } from '../../components/AppModal';
import { useApp } from '../../state/AppProvider';
import { Photo, ROOMS, Room, SPACES } from '../../domain/types';
import { importPhotos } from '../../storage/images';
import { messageForError } from '../../domain/errors';
import { StaffList, kindLabel, staffStyles as s } from '../../features/staff/shared';

export default function StaffPhotos() {
  const { draft, language, saveDraft, busy } = useApp();
  const { contentWidth, tablet, fontScale } = useLayout();
  const [room, setRoom] = useState<Room | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Photo | null>(null);
  const [discard, setDiscard] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ru: string) => tx(language, en, ru);
  const columns = fontScale >= 1.5 || contentWidth < 300 ? 1 : tablet ? Math.max(2, Math.floor(contentWidth / 230)) : 2;
  const items = useMemo(() => {
    if (!draft) return [];
    const termMap = new Map(draft.terms.map(term => [term.id, `${term.labels.en} ${term.labels.ru}`]));
    const query = search.trim().toLocaleLowerCase();
    return draft.photos.filter(photo => (room === 'all' || photo.room === room) && (!query || [spaceLabel(photo.room, language), photo.id, ...[photo.styleId, ...photo.paletteIds, ...photo.materialIds, ...photo.detailIds].map(id => termMap.get(id) ?? '')].join(' ').toLocaleLowerCase().includes(query)));
  }, [draft, room, search, language]);
  if (!draft) return null;
  const dirty = editing && JSON.stringify(editing) !== JSON.stringify(draft.photos.find(photo => photo.id === editing.id));
  function close() { if (dirty) setDiscard(true); else { setEditing(null); setError(null); } }
  async function save() {
    if (!draft || !editing) return;
    setError(null);
    try {
      const original = draft.photos.find(photo => photo.id === editing.id)!;
      const galleries = { ...draft.galleries };
      if (original.room !== editing.room) galleries[original.room] = galleries[original.room].filter(id => id !== editing.id);
      await saveDraft({ ...draft, photos: draft.photos.map(photo => photo.id === editing.id ? editing : photo), galleries });
      setEditing(null);
    } catch (e) { setError(messageForError(e, language)); }
  }
  async function remove() {
    if (!draft || !editing) return;
    try {
      const galleries = { ...draft.galleries };
      for (const space of SPACES) galleries[space] = galleries[space].filter(id => id !== editing.id);
      await saveDraft({ ...draft, photos: draft.photos.filter(photo => photo.id !== editing.id), galleries });
      setEditing(null); setDeleting(false);
    } catch (e) { setError(messageForError(e, language)); setDeleting(false); }
  }
  async function addPhotos() {
    if (!draft || importing || busy) return;
    setError(null); setImporting(true); setProgress('');
    try {
      const imported = await importPhotos(room === 'all' ? 'bathroom' : room, (done, total) => setProgress(`${done} / ${total}`));
      if (imported.length) {
        await saveDraft(current => ({ ...current, photos: [...current.photos, ...imported] }));
        setEditing(imported[0]);
      }
    } catch (e) { setError(messageForError(e, language)); }
    finally { setImporting(false); setProgress(''); }
  }
  return <>
    <StaffList title={t('Photo library', 'Библиотека фотографий')} key={columns} data={items} numColumns={columns} keyExtractor={photo => photo.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} contentContainerStyle={{ gap: 16, paddingBottom: 24 }} header={<View style={s.section}>
        <Text style={typography.body}>{t('Add photographs, then describe their room, style, and features. Select them for clients in Galleries.', 'Добавьте фотографии, укажите комнату, стиль и особенности. Выбор для клиентов — в разделе «Подборки».')}</Text>
        <Button title={importing ? `${t('Preparing photos', 'Подготовка фотографий')} ${progress}` : t('＋ Import photos', '＋ Добавить фотографии')} onPress={() => void addPhotos()} loading={importing} disabled={busy} />
        <TextField label={t('Search photos', 'Поиск фотографий')} value={search} onChangeText={setSearch} placeholder={t('Room, style, or feature', 'Комната, стиль или особенность')} />
        <View style={s.row}><Chip label={t('All rooms', 'Все комнаты')} selected={room === 'all'} onPress={() => setRoom('all')} />{ROOMS.map(value => <Chip key={value} label={spaceLabel(value, language)} selected={room === value} onPress={() => setRoom(value)} />)}</View>
        {error && !editing && <ErrorBanner message={error} />}
      </View>} ListEmptyComponent={<Text style={typography.body}>{t('No matching photos. Import some to begin.', 'Подходящих фотографий нет. Добавьте первые изображения.')}</Text>} renderItem={({ item }) => {
        const style = draft.terms.find(term => term.id === item.styleId);
        const complete = style && item.paletteIds.length && item.materialIds.length && item.detailIds.length;
        return <Pressable accessibilityRole="button" accessibilityLabel={`${spaceLabel(item.room, language)}, ${style?.labels[language] ?? t('Needs tags', 'Нужны теги')}`} onPress={() => { setEditing({ ...item, paletteIds: [...item.paletteIds], materialIds: [...item.materialIds], detailIds: [...item.detailIds] }); setError(null); }} style={{ width: (contentWidth - (columns - 1) * 12) / columns, gap: 8 }}>
          <PhotoImage photo={item} thumbnail language={language} style={{ aspectRatio: 1.3, borderRadius: 16 }} />
          <Text style={[typography.small, { color: colors.ink }]}>{spaceLabel(item.room, language)}</Text><Text style={typography.small}>{complete ? style.labels[language] : t('Add style & feature tags', 'Укажите стиль и особенности')}</Text>
        </Pressable>;
      }} />
    <AppModal visible={!!editing} animationType="slide" onRequestClose={close}>
      {editing && <Screen><Header back={{ label: t('Photo library', 'Библиотека'), onPress: close }} />
        <Text style={typography.heading}>{t('Describe this interior', 'Опишите этот интерьер')}</Text>
        <PhotoImage key={editing.id} photo={editing} language={language} fit="contain" style={{ height: tablet ? 340 : 230, borderRadius: 18 }} />
        <View style={s.section}><Text style={s.label}>{t('Room', 'Комната')}</Text><View style={s.row}>{ROOMS.map(value => <Chip key={value} label={spaceLabel(value, language)} selected={editing.room === value} onPress={() => setEditing({ ...editing, room: value })} />)}</View></View>
        <View style={s.section}><Text style={s.label}>{kindLabel('style', language)}</Text><View style={s.row}>{draft.terms.filter(term => term.kind === 'style').map(term => <Chip key={term.id} label={term.labels[language]} selected={editing.styleId === term.id} onPress={() => setEditing({ ...editing, styleId: term.id })} />)}</View></View>
        {(['palette', 'material', 'detail'] as const).map(kind => {
          const field = kind === 'palette' ? 'paletteIds' : kind === 'material' ? 'materialIds' : 'detailIds';
          return <View key={kind} style={s.section}><Text style={s.label}>{kindLabel(kind, language)}</Text><View style={s.row}>{draft.terms.filter(term => term.kind === kind).map(term => <Chip key={term.id} label={term.labels[language]} selected={editing[field].includes(term.id)} onPress={() => setEditing({ ...editing, [field]: editing[field].includes(term.id) ? editing[field].filter(id => id !== term.id) : [...editing[field], term.id] })} />)}</View></View>;
        })}
        <Text style={typography.small}>{t('Choose one style and at least one feature in every category before publishing. Changing rooms removes this photo from its previous room gallery.', 'Перед публикацией выберите один стиль и хотя бы один тег каждой категории. При смене комнаты фото удалится из прежней комнатной подборки.')}</Text>
        {error && <ErrorBanner message={error} />}
        <Button title={t('Save photo', 'Сохранить фотографию')} onPress={() => void save()} loading={busy} />
        <Button title={t('Remove from draft', 'Удалить из черновика')} onPress={() => setDeleting(true)} variant="ghost" disabled={busy} />
        <ConfirmDialog visible={discard} language={language} title={t('Discard unsaved edits?', 'Отменить несохранённые изменения?')} description={t('This photo will keep its last saved details.', 'У фотографии останутся последние сохранённые данные.')} confirmLabel={t('Discard edits', 'Отменить изменения')} cancelLabel={t('Keep editing', 'Продолжить редактирование')} onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setEditing(null); setError(null); }} />
        <ConfirmDialog visible={deleting} language={language} loading={busy} title={t('Remove this photo?', 'Удалить фотографию?')} description={t('It will be removed from every draft gallery. Published galleries and active clients remain available until a new catalog is published.', 'Фото будет удалено из всех подборок черновика. Опубликованные подборки и текущие сеансы сохранятся.')} confirmLabel={t('Remove photo', 'Удалить фотографию')} cancelLabel={t('Cancel', 'Отмена')} onCancel={() => setDeleting(false)} onConfirm={() => void remove()} />
      </Screen>}
    </AppModal>
  </>;
}
