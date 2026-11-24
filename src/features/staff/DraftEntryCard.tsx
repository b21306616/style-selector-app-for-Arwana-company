import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, colors, spaceLabel, tx, typography, useLayout } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { hasRoom } from '../../domain/rooms';
import { useApp } from '../../state/AppProvider';
import { PhotoMetadataFields, TermLabelFields } from './EntryFields';
import { SelectionRow } from './SelectionField';
import { WorkspaceFeedback } from './WorkspaceFeedback';
import { useStaffWorkspace } from './workspace-context';

export function DraftEntryCard() {
  const { draft, language } = useApp();
  const w = useStaffWorkspace();
  const { wide, contentWidth, tablet } = useLayout();
  const [discard, setDiscard] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  if (!draft) return null;
  const split = wide && contentWidth >= 850;
  const previewWidth = split ? (contentWidth - 74) * 0.4 : contentWidth - (tablet ? 50 : 34);
  const termReady = !!w.term.labels.ru.trim() && !!w.term.labels.tk.trim();
  const termLabels = <TermLabelFields labels={w.term.labels} onChange={labels => w.setTerm({ ...w.term, labels })} disabled={w.busy} />;
  const saveTerm = <Button title={t('Termini ýatda sakla', 'Сохранить термин')} onPress={() => void w.saveTerm()} disabled={w.busy || !termReady} />;

  return <>
    <View testID="draft-entry-card" style={[styles.card, tablet && styles.tabletCard]}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{t('Garalama', 'Черновик')}</Text>
        <Text style={typography.small}>{t('Üýtgeşmeler çap edilenden soň müşderilere görüner.', 'Клиенты увидят изменения после публикации.')}</Text>
      </View>
      <View testID="draft-photo-editor" style={[styles.editor, split && styles.split]}>
        <View style={[styles.imageColumn, split && styles.imageSplit]}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('Surat', 'Фотография')}</Text>
          <Pressable testID="draft-photo-picker" accessibilityRole="button" accessibilityLabel={w.photo ? t('Suraty çalşyrmak', 'Заменить фотографию') : t('Interýer suratyny goşuň', 'Добавьте фото интерьера')} disabled={w.busy} onPress={() => void w.choosePhoto()}
            style={({ pressed }) => [styles.photoPicker, w.busy && styles.photoPickerDisabled, pressed && styles.photoPickerPressed]}>
          {w.photo ? <PhotoImage key={w.photo.id} photo={w.photo} language={language} fit="contain" style={[styles.image, { height: Math.min(280, previewWidth * 0.75) }]} />
            : <View style={styles.placeholder}>
              <View style={styles.photoIcon}><Icon name="photo" size={32} fallback="＋" /></View>
              <Text style={styles.placeholderTitle}>{t('Interýer suratyny goşuň', 'Добавьте фото интерьера')}</Text>
              <Text style={styles.placeholderCopy}>{t('Bir surat · 10 MB çenli', 'Одно фото · до 10 МБ')}</Text>
            </View>}
          </Pressable>
          {w.photo && <Button title={t('Suraty aýyrmak', 'Удалить фото')} variant="ghost" disabled={w.busy} onPress={w.removePhoto} />}
          {w.photo && <Text style={typography.small}>{t('Bir surat · 10 MB çenli', 'Одно фото · до 10 МБ')}</Text>}
          {!pickerOpen && <WorkspaceFeedback area="entry" />}
        </View>
        <View style={[styles.fields, split && styles.fieldsSplit]}>
          <PhotoMetadataFields presentation="compact" value={w.fields} terms={draft.terms} rooms={draft.rooms} photos={draft.photos} language={language} disabled={w.busy}
            onChange={value => { w.setFields(value); w.setSpaces(w.spaces.filter(space => space === 'whole_house' || space === value.room)); }}
            onAddTerm={w.startTerm} onAddRoom={w.startRoom} onDeleteOptions={w.deleteOptions} pickerFeedback={<WorkspaceFeedback area="entry" />} onManage={w.clearEntryFeedback}
            onPickerVisibilityChange={visible => { setPickerOpen(visible); if (visible) w.clearEntryFeedback(); }}
            roomEditor={w.inlineRoom ? <>
              <TermLabelFields labels={w.room.labels} onChange={labels => w.setRoom({ ...w.room, labels })} disabled={w.busy} />
              <Button title={t('Otagy ýatda saklamak', 'Сохранить комнату')} onPress={() => void w.saveRoom()} disabled={w.busy || !w.room.labels.ru.trim() || !w.room.labels.tk.trim()} />
              <Button title={t('Saýlawa dolanmak', 'Вернуться к выбору')} variant="ghost" disabled={w.busy} onPress={() => w.setInlineRoom(false)} />
            </> : null}
            renderTermEditor={kind => w.inlineTerm && w.term.kind === kind ? <>
              {termLabels}
              {saveTerm}
              <Button title={t('Saýlawa dolanmak', 'Вернуться к выбору')} variant="ghost" disabled={w.busy} onPress={() => w.setInlineTerm(false)} />
            </> : null} />
          <View style={styles.collections}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('Toplumlar', 'Подборки')}</Text>
            <Text style={typography.small}>{t('Hökmany däl. Suraty topluma soň hem goşup bilersiňiz.', 'Необязательно. Фото можно добавить в подборку позже.')}</Text>
            {[...(hasRoom(draft, w.fields.room) ? [w.fields.room] : []), 'whole_house'].map(space => <SelectionRow key={space} label={spaceLabel(space, language, draft.rooms)} checked={w.spaces.includes(space)} disabled={w.busy}
              onPress={() => w.setSpaces(w.spaces.includes(space) ? w.spaces.filter(value => value !== space) : [...w.spaces, space])} />)}
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        {!hasRoom(draft, w.fields.room) && <Text style={typography.small}>{t('Suraty ýatda saklamak üçin otagy saýlaň.', 'Выберите комнату, чтобы сохранить фото.')}</Text>}
        <Text style={typography.small}>{t('Tegleri soň dolduryp bilersiňiz. Çap etmek üçin bir stil we her kategoriýadan azyndan bir teg gerek.', 'Теги можно заполнить позже. Для публикации нужны стиль и хотя бы один тег каждой категории.')}</Text>
        <Button title={t('Suraty garalama ýazdyrmak', 'Сохранить фото в черновик')} disabled={w.busy || !w.photo || !hasRoom(draft, w.fields.room)} onPress={() => void w.savePhoto()} />
        <Button title={t('Formany arassalamak', 'Очистить форму')} variant="ghost" disabled={w.busy || !w.dirty} onPress={() => setDiscard(true)} />
      </View>
    </View>
    <ConfirmDialog visible={discard} language={language} loading={w.busy} title={t('Formany arassalamalymy?', 'Очистить форму?')} description={t('Ýatda saklanmadyk giriş aýrylar. Garalama üýtgemez.', 'Несохранённые данные формы будут удалены. Черновик сохранится.')} confirmLabel={t('Arassalamak', 'Очистить')} cancelLabel={t('Dowam etmek', 'Продолжить')} onCancel={() => setDiscard(false)} onConfirm={() => { w.discardForm(); setDiscard(false); }} />
  </>;
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 24, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border }, tabletCard: { padding: 24 },
  heading: { gap: 6 }, title: { ...typography.heading, color: colors.ink },
  editor: { gap: 24, flexDirection: 'column' }, split: { flexDirection: 'row', alignItems: 'flex-start' }, imageColumn: { minWidth: 0, gap: 12 }, imageSplit: { flex: 0.8 }, fields: { minWidth: 0, gap: 24 }, fieldsSplit: { flex: 1.2 },
  photoPicker: { borderRadius: 16 }, photoPickerDisabled: { opacity: 0.45 }, photoPickerPressed: { opacity: 0.72 }, image: { width: '100%', borderRadius: 16, backgroundColor: colors.sand },
  placeholder: { minHeight: 176, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.greenSoft, borderRadius: 16 },
  photoIcon: { padding: 10, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 4 }, placeholderTitle: { ...typography.body, color: colors.ink, fontWeight: '600', textAlign: 'center' }, placeholderCopy: { ...typography.small, textAlign: 'center' },
  collections: { gap: 12, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, sectionTitle: { ...typography.body, color: colors.ink, fontWeight: '600' },
  footer: { paddingTop: 20, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
