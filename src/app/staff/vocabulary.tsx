import * as Crypto from 'expo-crypto';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, Header, Screen, TextField, colors, typography, tx } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AppModal } from '../../components/AppModal';
import { useApp } from '../../state/AppProvider';
import { Term, TermKind } from '../../domain/types';
import { termIsReferenced } from '../../domain/catalog';
import { messageForError } from '../../domain/errors';
import { StaffList, kindLabel, staffStyles as s } from '../../features/staff/shared';

export default function Vocabulary() {
  const { draft, language, saveDraft, busy } = useApp();
  const [kind, setKind] = useState<TermKind>('style');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Term | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ru: string) => tx(language, en, ru);
  const terms = useMemo(() => draft?.terms.filter(term => term.kind === kind && `${term.labels.en} ${term.labels.ru}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [], [draft, kind, search]);
  if (!draft) return null;
  const original = editing ? draft.terms.find(term => term.id === editing.id) : undefined;
  const referenced = editing ? termIsReferenced(draft, editing.id) : false;
  function close() { if (editing && JSON.stringify(editing) !== JSON.stringify(original)) setDiscard(true); else { setEditing(null); setError(null); } }
  async function save() {
    if (!editing || !draft) return;
    const next = { ...editing, labels: { en: editing.labels.en.trim(), ru: editing.labels.ru.trim() } };
    if (!next.labels.en || !next.labels.ru) return;
    if (draft.terms.some(term => term.id !== next.id && term.kind === next.kind && (term.labels.en.toLocaleLowerCase() === next.labels.en.toLocaleLowerCase() || term.labels.ru.toLocaleLowerCase() === next.labels.ru.toLocaleLowerCase()))) {
      setError(t('A term with that name already exists in this category.', 'Термин с таким названием уже есть в этой категории.')); return;
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
    <StaffList title={t('Styles & features', 'Стили и особенности')} data={terms} keyExtractor={term => term.id} initialNumToRender={16} windowSize={5} contentContainerStyle={{ paddingBottom: 24 }} header={<View style={s.section}>
        <Text style={typography.body}>{t('Every name has a Russian and English version. Clients see these names only in their results.', 'У каждого названия есть русская и английская версия. Клиенты увидят их только в результатах.')}</Text>
        <View style={s.row}>{(['style', 'palette', 'material', 'detail'] as const).map(value => <Chip key={value} label={kindLabel(value, language)} selected={kind === value} onPress={() => setKind(value)} />)}</View>
        <TextField label={t('Search vocabulary', 'Поиск по словарю')} value={search} onChangeText={setSearch} />
        <Button title={t('＋ Add term', '＋ Добавить термин')} onPress={() => { setEditing({ id: Crypto.randomUUID(), kind, labels: { en: '', ru: '' } }); setError(null); }} />
      </View>} ListEmptyComponent={<Text style={typography.body}>{t('No matching terms.', 'Подходящих терминов нет.')}</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { setEditing({ ...item, labels: { ...item.labels } }); setError(null); }} style={s.line}>
        <View style={{ flex: 1, gap: 4 }}><Text style={typography.subheading}>{item.labels[language]}</Text><Text style={typography.small}>{item.labels[language === 'ru' ? 'en' : 'ru']}</Text></View><Text style={{ color: colors.green, fontSize: 22 }}>→</Text>
      </Pressable>} />
    <AppModal visible={!!editing} animationType="slide" onRequestClose={close}>{editing && <Screen>
      <Header back={{ label: t('Vocabulary', 'Словарь'), onPress: close }} />
      <Text style={typography.heading}>{original ? t('Edit term', 'Редактировать термин') : t('New term', 'Новый термин')}</Text><Chip label={kindLabel(editing.kind, language)} />
      <TextField label="Русское название" value={editing.labels.ru} onChangeText={value => setEditing({ ...editing, labels: { ...editing.labels, ru: value } })} maxLength={100} />
      <TextField label="English name" value={editing.labels.en} onChangeText={value => setEditing({ ...editing, labels: { ...editing.labels, en: value } })} maxLength={100} />
      {error && <ErrorBanner message={error} />}
      <Button title={t('Save term', 'Сохранить термин')} onPress={() => void save()} loading={busy} disabled={!editing.labels.en.trim() || !editing.labels.ru.trim()} />
      {referenced && <Text style={typography.small}>{t('This term is used by library photos. Reassign it on those photos before deleting it.', 'Термин используется фотографиями библиотеки. Замените его у этих фотографий перед удалением.')}</Text>}
      {original && <Button title={t('Delete term', 'Удалить термин')} variant="ghost" disabled={referenced || busy} onPress={() => setDeleting(true)} />}
      <ConfirmDialog visible={deleting} language={language} loading={busy} title={t('Delete this term?', 'Удалить термин?')} description={t('It will be removed from the draft vocabulary.', 'Термин будет удалён из словаря черновика.')} confirmLabel={t('Delete term', 'Удалить термин')} cancelLabel={t('Cancel', 'Отмена')} onCancel={() => setDeleting(false)} onConfirm={() => void remove()} />
      <ConfirmDialog visible={discard} language={language} title={t('Discard unsaved edits?', 'Отменить несохранённые изменения?')} description={t('The last saved vocabulary will remain.', 'Останется последний сохранённый словарь.')} confirmLabel={t('Discard edits', 'Отменить изменения')} cancelLabel={t('Keep editing', 'Продолжить редактирование')} onCancel={() => setDiscard(false)} onConfirm={() => { setEditing(null); setDiscard(false); }} />
    </Screen>}</AppModal>
  </>;
}
