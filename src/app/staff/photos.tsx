import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, Header, Screen, TextField, typography, photoRoomLabel, spaceLabel, tx, useLayout } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { PhotoTile } from '../../components/PhotoTile';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AppModal } from '../../components/AppModal';
import { useApp } from '../../state/AppProvider';
import { Photo, Room } from '../../domain/types';
import { catalogSpaces, hasRoom } from '../../domain/rooms';
import { editPhotoField, photoFieldsForLanguage, photoTermSearchText } from '../../domain/photo-metadata';
import { importPhotos } from '../../storage/images';
import { messageForError } from '../../domain/errors';
import { StaffList, staffStyles as s } from '../../features/staff/shared';
import { PhotoMetadataFields } from '../../features/staff/EntryFields';

export default function StaffPhotos() {
  const { draft, language, saveDraft, busy } = useApp();
  const { contentWidth, tablet, wide, columns } = useLayout();
  const [requestedRoom, setRoom] = useState<Room | 'all'>('all');
  const room = draft && hasRoom(draft, requestedRoom) ? requestedRoom : 'all';
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Photo | null>(null);
  const [discard, setDiscard] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  const terms = useMemo(() => new Map(draft?.terms.map(term => [term.id, term])), [draft?.terms]);
  const items = useMemo(() => {
    if (!draft) return [];
    const query = search.trim().toLocaleLowerCase();
    return draft.photos.filter(photo => (room === 'all' || photo.room === room) && (!query ||
      [photoRoomLabel(photo, language, draft.rooms), photo.id, photoTermSearchText(photo, terms, 'all')].join(' ').toLocaleLowerCase().includes(query)));
  }, [draft, room, search, language, terms]);
  if (!draft) return null;
  const dirty = editing && JSON.stringify(editing) !== JSON.stringify(draft.photos.find(photo => photo.id === editing.id));
  function close() { if (dirty) setDiscard(true); else { setEditing(null); setError(null); } }
  async function save() {
    if (!draft || !editing) return;
    if (!hasRoom(draft, editing.room)) { setError(t('Otagy saýlaň.', 'Выберите комнату.')); return; }
    setError(null);
    try {
      const original = draft.photos.find(photo => photo.id === editing.id)!;
      const galleries = { ...draft.galleries };
      if (original.room !== editing.room && galleries[original.room]) galleries[original.room] = galleries[original.room].filter(id => id !== editing.id);
      await saveDraft({ ...draft, photos: draft.photos.map(photo => photo.id === editing.id ? editing : photo), galleries });
      setEditing(null);
    } catch (e) { setError(messageForError(e, language)); }
  }
  async function remove() {
    if (!draft || !editing) return;
    try {
      const galleries = { ...draft.galleries };
      for (const space of catalogSpaces(draft)) galleries[space] = galleries[space].filter(id => id !== editing.id);
      await saveDraft({ ...draft, photos: draft.photos.filter(photo => photo.id !== editing.id), galleries });
      setEditing(null); setDeleting(false);
    } catch (e) { setError(messageForError(e, language)); setDeleting(false); }
  }
  async function addPhotos() {
    if (!draft || importing || busy || !draft.rooms.length) return;
    setError(null); setImporting(true); setProgress('');
    try {
      const imported = await importPhotos(hasRoom(draft, room) ? room : draft.rooms[0].id, (done, total) => setProgress(`${done} / ${total}`));
      if (imported.length) {
        await saveDraft(current => ({ ...current, photos: [...current.photos, ...imported] }));
        setEditing(imported[0]);
      }
    } catch (e) { setError(messageForError(e, language)); }
    finally { setImporting(false); setProgress(''); }
  }
  return <>
    <StaffList title={t('Suratlar', 'Библиотека фотографий')} key={columns} data={items} numColumns={columns} keyExtractor={photo => photo.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} contentContainerStyle={{ gap: 16, paddingBottom: 24 }} header={<View style={s.section}>
        <Button title={importing ? `${t('Suratlar taýýarlanýar', 'Подготовка фотографий')} ${progress}` : t('＋ Surat goşmak', '＋ Добавить фотографии')} onPress={() => void addPhotos()} loading={importing} disabled={busy || !draft.rooms.length} />
        {!draft.rooms.length && <Text style={typography.small}>{t('Ilki garalama formasynda otag goşuň.', 'Сначала добавьте комнату в форме черновика.')}</Text>}
        <TextField label={t('Surat gözlegi', 'Поиск фотографий')} value={search} onChangeText={setSearch} placeholder={t('Otag, stil ýa-da aýratynlyk', 'Комната, стиль или особенность')} />
        <View style={s.row}><Chip label={t('Ähli otaglar', 'Все комнаты')} selected={room === 'all'} onPress={() => setRoom('all')} />{draft.rooms.map(({ id: value }) => <Chip key={value} label={spaceLabel(value, language, draft.rooms)} selected={room === value} onPress={() => setRoom(value)} />)}</View>
        {error && !editing && <ErrorBanner message={error} />}
      </View>} ListEmptyComponent={<Text style={typography.body}>{t('Gabat gelýän surat ýok. Başlamak üçin birnäçe surat goşuň.', 'Подходящих фотографий нет. Добавьте первые изображения.')}</Text>} renderItem={({ item }) => {
        const fields = photoFieldsForLanguage(item, language);
        const style = terms.get(fields.styleId)?.labels[language];
        const complete = fields.room && style && fields.paletteIds.length && fields.materialIds.length && fields.detailIds.length;
        const roomName = photoRoomLabel(item, language, draft.rooms);
        return <PhotoTile photo={item} language={language} title={roomName} subtitle={style} badge={complete ? undefined : t('Tegler gerek', 'Нужны теги')} label={roomName + ', ' + (style || t('Tegler gerek', 'Нужны теги'))}
          onPress={() => { setEditing({ ...item, paletteIds: [...item.paletteIds], materialIds: [...item.materialIds], detailIds: [...item.detailIds] }); setError(null); }}
          style={{ width: (contentWidth - (columns - 1) * 12) / columns }} />;
      }} />
    <AppModal visible={!!editing} animationType="slide" onRequestClose={close}>
      {editing && <Screen><Header back={{ label: t('Suratlar', 'Библиотека'), onPress: close }} />
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <PhotoImage key={editing.id} photo={editing} language={language} fit="contain" style={{ width: wide ? '46%' : '100%', height: Math.min(tablet ? 400 : 300, contentWidth * editing.height / editing.width), borderRadius: 18 }} />
        <View style={{ flex: 1, width: wide ? undefined : '100%', gap: 16 }}>
        <PhotoMetadataFields value={photoFieldsForLanguage(editing, language)} terms={draft.terms} rooms={draft.rooms} language={language}
          onChange={(value, field) => setEditing(editPhotoField(editing, field, value, language))} disabled={busy} />
        <Text style={typography.small}>{t('Talap edilýär: bir stil we her kategoriýadan azyndan bir teg. Otagy üýtgetmek bu suraty öňki otag toplumyndan aýyrýar.', 'Нужен один стиль и хотя бы один тег каждой категории. При смене комнаты фото удалится из прежней комнатной подборки.')}</Text>
        {error && <ErrorBanner message={error} />}
        <Button title={t('Suraty ýatda sakla', 'Сохранить фотографию')} onPress={() => void save()} loading={busy} />
        <Button title={t('Garalamadan aýyrmak', 'Удалить из черновика')} onPress={() => setDeleting(true)} variant="ghost" disabled={busy} />
        </View></View>
        <ConfirmDialog visible={discard} language={language} title={t('Ýatda saklanmadyk üýtgeşmeleri ýatyrmak isleýärsiňizmi?', 'Отменить несохранённые изменения?')} description={t('Bu surat soňky ýatda saklanan maglumatlaryny saklar.', 'У фотографии останутся последние сохранённые данные.')} confirmLabel={t('Üýtgeşmeleri ýatyrmak', 'Отменить изменения')} cancelLabel={t('Redaktirlemegi dowam etmek', 'Продолжить редактирование')} onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setEditing(null); setError(null); }} />
        <ConfirmDialog visible={deleting} language={language} loading={busy} title={t('Bu suraty aýyrmak isleýärsiňizmi?', 'Удалить фотографию?')} description={t('Ol garalamanyň ähli toplumlaryndan aýrylar. Çap edilen toplumlar we işjeň müşderiler täze katalog çap edilýänçä elýeterli bolar.', 'Фото будет удалено из всех подборок черновика. Опубликованные подборки и текущие сеансы сохранятся.')} confirmLabel={t('Suraty aýyrmak', 'Удалить фотографию')} cancelLabel={t('Ýatyrmak', 'Отмена')} onCancel={() => setDeleting(false)} onConfirm={() => void remove()} />
      </Screen>}
    </AppModal>
  </>;
}
