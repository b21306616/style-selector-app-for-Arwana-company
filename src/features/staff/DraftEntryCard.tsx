import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, colors, spaceLabel, tx, typography, useLayout } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import type { TermKind } from '../../domain/types';
import { useApp } from '../../state/AppProvider';
import { PhotoMetadataFields, TermLabelFields } from './EntryFields';
import { SelectionField, SelectionRow } from './SelectionField';
import { WorkspaceFeedback } from './WorkspaceFeedback';
import { kindLabel } from './shared';
import { useStaffWorkspace } from './workspace-context';

const kinds: TermKind[] = ['style', 'palette', 'material', 'detail'];
const categories = kinds.map(kind => ({ id: kind, labels: { ru: kindLabel(kind, 'ru'), tk: kindLabel(kind, 'tk') } }));

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
      <View accessibilityRole="tablist" style={styles.tabs}>
        {(['photo', 'term'] as const).map(mode => <Pressable key={mode} accessibilityRole="tab"
          accessibilityState={{ selected: w.entryMode === mode, disabled: w.busy }} disabled={w.busy}
          onPress={() => { w.setEntryMode(mode); if (mode === 'term') w.setInlineTerm(false); }}
          style={({ pressed }) => [styles.tab, w.entryMode === mode && styles.activeTab, w.busy && styles.disabled, pressed && styles.pressed]}>
          <Text style={[styles.tabText, w.entryMode === mode && styles.activeTabText]}>{mode === 'photo' ? t('Surat', 'Фотография') : t('Stil ýa-da teg', 'Стиль или тег')}</Text>
        </Pressable>)}
      </View>

      {w.entryMode === 'photo' ? <View testID="draft-photo-editor" style={[styles.editor, split && styles.split]}>
        <View style={[styles.imageColumn, split && styles.imageSplit]}>
          {w.photo ? <PhotoImage key={w.photo.id} photo={w.photo} language={language} fit="contain" style={[styles.image, { height: Math.min(280, previewWidth * 0.75) }]} />
            : <View style={styles.placeholder}>
              <View style={styles.photoIcon}><Icon name="photo" size={32} fallback="＋" /></View>
              <Text style={styles.placeholderTitle}>{t('Interýer suratyny goşuň', 'Добавьте фото интерьера')}</Text>
              <Text style={styles.placeholderCopy}>{t('Enjamyňyzdan surat saýlaň', 'Выберите изображение с устройства')}</Text>
            </View>}
          <Button title={w.photo ? t('Başga surat saýlamak', 'Выбрать другое фото') : t('Surat saýlamak', 'Выбрать фотографию')} variant="secondary" disabled={w.busy} onPress={() => void w.choosePhoto()} />
          <Text style={typography.small}>{t('Surat enjamda saklanar we oflaýn elýeterli bolar.', 'Фотография сохранится на устройстве и будет доступна офлайн.')}</Text>
        </View>
        <View style={[styles.fields, split && styles.fieldsSplit]}>
          <PhotoMetadataFields presentation="compact" value={w.fields} terms={draft.terms} language={language} disabled={w.busy}
            onChange={value => { w.setFields(value); w.setSpaces(w.spaces.filter(space => space === 'whole_house' || space === value.room)); }}
            onAddTerm={w.startTerm} onPickerVisibilityChange={setPickerOpen}
            renderTermEditor={kind => w.inlineTerm && w.term.kind === kind ? <>
              {termLabels}
              <WorkspaceFeedback area="entry" />
              {saveTerm}
              <Button title={t('Saýlawa dolanmak', 'Вернуться к выбору')} variant="ghost" disabled={w.busy} onPress={() => w.setInlineTerm(false)} />
            </> : null} />
          <View style={styles.collections}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('Toplumlar', 'Подборки')}</Text>
            <Text style={typography.small}>{t('Hökmany däl. Suraty topluma soň hem goşup bilersiňiz.', 'Необязательно. Фото можно добавить в подборку позже.')}</Text>
            {[w.fields.room, 'whole_house' as const].map(space => <SelectionRow key={space} label={spaceLabel(space, language)} checked={w.spaces.includes(space)} disabled={w.busy}
              onPress={() => w.setSpaces(w.spaces.includes(space) ? w.spaces.filter(value => value !== space) : [...w.spaces, space])} />)}
          </View>
        </View>
      </View> : <View style={styles.termForm}>
        <SelectionField label={t('Kategoriýa', 'Категория')} language={language} options={categories} selectedIds={[w.term.kind]} disabled={w.busy} onVisibilityChange={setPickerOpen}
          onChange={ids => { const kind = kinds.find(kind => kind === ids[0]); if (kind) { w.setTerm({ ...w.term, kind }); w.setInlineTerm(false); } }} />
        <Text style={typography.small}>{t('Iki dilde at giriziň. Termin garalama goşular.', 'Укажите название на двух языках. Термин добавится в черновик.')}</Text>
        {termLabels}
      </View>}

      <View style={[styles.footer, w.entryMode === 'term' && styles.termForm]}>
        {!pickerOpen && <WorkspaceFeedback area="entry" />}
        {w.entryMode === 'photo' ? <>
          <Text style={typography.small}>{t('Tegleri soň dolduryp bilersiňiz. Çap etmek üçin bir stil we her kategoriýadan azyndan bir teg gerek.', 'Теги можно заполнить позже. Для публикации нужны стиль и хотя бы один тег каждой категории.')}</Text>
          <Button title={t('Suraty garalama ýazdyrmak', 'Сохранить фото в черновик')} disabled={w.busy || !w.photo} onPress={() => void w.savePhoto()} />
        </> : saveTerm}
        <Button title={t('Formany arassalamak', 'Очистить форму')} variant="ghost" disabled={w.busy || !w.dirty} onPress={() => setDiscard(true)} />
      </View>
    </View>
    <ConfirmDialog visible={discard} language={language} loading={w.busy} title={t('Formany arassalamalymy?', 'Очистить форму?')} description={t('Ýatda saklanmadyk giriş aýrylar. Garalama üýtgemez.', 'Несохранённые данные формы будут удалены. Черновик сохранится.')} confirmLabel={t('Arassalamak', 'Очистить')} cancelLabel={t('Dowam etmek', 'Продолжить')} onCancel={() => setDiscard(false)} onConfirm={() => { w.discardForm(); setDiscard(false); }} />
  </>;
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 24, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border }, tabletCard: { padding: 24 },
  heading: { gap: 6 }, title: { ...typography.heading, color: colors.ink },
  tabs: { flexDirection: 'row', alignItems: 'stretch', padding: 4, gap: 4, backgroundColor: colors.sand, borderRadius: 16 },
  tab: { flex: 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 12, justifyContent: 'center', borderRadius: 12 }, activeTab: { backgroundColor: colors.green },
  tabText: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.ink, textAlign: 'center' }, activeTabText: { color: colors.white }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  editor: { gap: 24, flexDirection: 'column' }, split: { flexDirection: 'row', alignItems: 'flex-start' }, imageColumn: { minWidth: 0, gap: 12 }, imageSplit: { flex: 0.8 }, fields: { minWidth: 0, gap: 24 }, fieldsSplit: { flex: 1.2 },
  image: { width: '100%', borderRadius: 16, backgroundColor: colors.sand },
  placeholder: { minHeight: 176, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.greenSoft, borderRadius: 16 },
  photoIcon: { padding: 10, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 4 }, placeholderTitle: { ...typography.body, color: colors.ink, fontWeight: '600', textAlign: 'center' }, placeholderCopy: { ...typography.small, textAlign: 'center' },
  collections: { gap: 12, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, sectionTitle: { ...typography.body, color: colors.ink, fontWeight: '600' },
  termForm: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  footer: { paddingTop: 20, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
