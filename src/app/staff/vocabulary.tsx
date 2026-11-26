import * as Crypto from 'expo-crypto';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, Header, Screen, TextField, typography, optionLabel, tx, useLayout } from '../../components/ui';
import { PhotoTile } from '../../components/PhotoTile';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AppModal } from '../../components/AppModal';
import { useApp } from '../../state/AppProvider';
import { Term, TermKind } from '../../domain/types';
import { termIsReferenced } from '../../domain/catalog';
import { messageForError } from '../../domain/errors';
import { StaffList, kindLabel, staffStyles as s } from '../../features/staff/shared';
import { TermLabelFields } from '../../features/staff/EntryFields';

export default function Vocabulary() {
  const { draft, language, saveDraft, busy } = useApp();
  const { columns, contentWidth } = useLayout();
  const [kind, setKind] = useState<TermKind>('style');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Term | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  const terms = useMemo(() => draft?.terms.filter(term => term.kind === kind && `${term.labels.tk} ${term.labels.ru}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [], [draft, kind, search]);
  if (!draft) return null;
  const original = editing ? draft.terms.find(term => term.id === editing.id) : undefined;
  const referenced = editing ? termIsReferenced(draft, editing.id) : false;
  function close() { if (editing && JSON.stringify(editing) !== JSON.stringify(original)) setDiscard(true); else { setEditing(null); setError(null); } }
  async function save() {
    if (!editing || !draft) return;
    const next = { ...editing, labels: { tk: editing.labels.tk.trim(), ru: editing.labels.ru.trim() } };
    if (!next.labels.tk || !next.labels.ru) return;
    if (draft.terms.some(term => term.id !== next.id && term.kind === next.kind && (term.labels.tk.toLocaleLowerCase() === next.labels.tk.toLocaleLowerCase() || term.labels.ru.toLocaleLowerCase() === next.labels.ru.toLocaleLowerCase()))) {
      setError(t('Bu kategoriýada şeýle atly termin eýýäm bar.', 'Термин с таким названием уже есть в этой категории.')); return;
    }
    try { await saveDraft({ ...draft, terms: original ? draft.terms.map(term => term.id === next.id ? next : term) : [...draft.terms, next] }); setEditing(null); setError(null); }
    catch (e) { setError(messageForError(e, language)); }
  }
  async function remove() {
    if (!editing || !draft || referenced) return;
    try { await saveDraft({ ...draft, terms: draft.terms.filter(term => term.id !== editing.id) }); setEditing(null); setDeleting(false); }
    catch (e) { setError(messageForError(e, language)); setDeleting(false); }
  }
  return <>
    <StaffList title={t('Stiller we aýratynlyklar', 'Стили и особенности')} key={columns} data={terms} numColumns={columns} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} keyExtractor={term => term.id} initialNumToRender={16} windowSize={5} contentContainerStyle={{ paddingBottom: 24 }} header={<View style={s.section}>
        <View style={s.row}>{(['style', 'palette', 'material', 'detail'] as const).map(value => <Chip key={value} label={kindLabel(value, language)} selected={kind === value} onPress={() => setKind(value)} />)}</View>
        <TextField label={t('Sözlük boýunça gözleg', 'Поиск по словарю')} value={search} onChangeText={setSearch} />
        <Button title={t('＋ Termin goşmak', '＋ Добавить термин')} onPress={() => { setEditing({ id: Crypto.randomUUID(), kind, labels: { tk: '', ru: '' } }); setError(null); }} />
      </View>} ListEmptyComponent={<Text style={typography.body}>{t('Gabat gelýän termin ýok.', 'Подходящих терминов нет.')}</Text>} renderItem={({ item }) => {
        const example = draft.photos.find(photo => item.kind === 'style' ? photo.styleId === item.id : item.kind === 'palette' ? photo.paletteIds.includes(item.id) : item.kind === 'material' ? photo.materialIds.includes(item.id) : photo.detailIds.includes(item.id));
        const name = optionLabel(item.labels, language);
        return <PhotoTile photo={example} language={language} title={name} label={name} onPress={() => { setEditing({ ...item, labels: { ...item.labels } }); setError(null); }} style={{ width: (contentWidth - (columns - 1) * 12) / columns, marginBottom: 12 }} />;
      }} />
    <AppModal visible={!!editing} animationType="slide" onRequestClose={close}>{editing && <Screen>
      <Header back={{ label: t('Sözlük', 'Словарь'), onPress: close }} />
      <Text style={typography.heading}>{original ? t('Termini redaktirlemek', 'Редактировать термин') : t('Täze termin', 'Новый термин')}</Text><Chip label={kindLabel(editing.kind, language)} />
      <TermLabelFields labels={editing.labels} onChange={labels => setEditing({ ...editing, labels })} disabled={busy} />
      {error && <ErrorBanner message={error} />}
      <Button title={t('Termini ýatda sakla', 'Сохранить термин')} onPress={() => void save()} loading={busy} disabled={!editing.labels.tk.trim() || !editing.labels.ru.trim()} />
      {referenced && <Text style={typography.small}>{t('Bu termin suratlarda ulanylýar. Öçürmezden ozal ony suratlarda çalyşyň.', 'Термин используется фотографиями библиотеки. Замените его у этих фотографий перед удалением.')}</Text>}
      {original && <Button title={t('Termini öçürmek', 'Удалить термин')} variant="ghost" disabled={referenced || busy} onPress={() => setDeleting(true)} />}
      <ConfirmDialog visible={deleting} language={language} loading={busy} title={t('Bu termini öçürmek isleýärsiňizmi?', 'Удалить термин?')} description={t('Ol garalamanyň sözlüginden aýrylar.', 'Термин будет удалён из словаря черновика.')} confirmLabel={t('Termini öçürmek', 'Удалить термин')} cancelLabel={t('Ýatyrmak', 'Отмена')} onCancel={() => setDeleting(false)} onConfirm={() => void remove()} />
      <ConfirmDialog visible={discard} language={language} title={t('Ýatda saklanmadyk üýtgeşmeleri ýatyrmak isleýärsiňizmi?', 'Отменить несохранённые изменения?')} description={t('Soňky ýatda saklanan sözlük galar.', 'Останется последний сохранённый словарь.')} confirmLabel={t('Üýtgeşmeleri ýatyrmak', 'Отменить изменения')} cancelLabel={t('Redaktirlemegi dowam etmek', 'Продолжить редактирование')} onCancel={() => setDiscard(false)} onConfirm={() => { setEditing(null); setDiscard(false); }} />
    </Screen>}</AppModal>
  </>;
}
