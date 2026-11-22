import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, ErrorBanner, colors, spaceLabel, tx, typography, useLayout } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { SPACES, type TermKind } from '../../domain/types';
import { AppError, messageForError } from '../../domain/errors';
import { useApp } from '../../state/AppProvider';
import { PhotoMetadataFields, TermLabelFields } from './EntryFields';
import { kindLabel, staffStyles as s } from './shared';
import { useStaffWorkspace } from './workspace-context';

export function DashboardWorkbench() {
  const { draft, language } = useApp();
  const w = useStaffWorkspace();
  const { wide, fontScale, contentWidth } = useLayout();
  const [discard, setDiscard] = useState(false);
  const [issuePage, setIssuePage] = useState(0);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  if (!draft) return null;
  const split = wide && contentWidth >= 850;
  const page = Math.min(issuePage, Math.max(0, Math.ceil((w.review?.issues.length ?? 0) / 25) - 1));
  const operationNames: Record<string, string> = {
    photo: t('Surat taýýarlanýar', 'Подготовка фотографии'), workbook: t('Excel okalýar', 'Чтение Excel'), images: t('Suratlar taýýarlanýar', 'Подготовка фотографий'),
    export: t('Eksport taýýarlanýar', 'Подготовка экспорта'), template: t('Şablon taýýarlanýar', 'Подготовка шаблона'), share: t('Faýly saklamak / paýlaşmak', 'Сохранение / отправка файла'), save: t('Ýatda saklanylýar', 'Сохранение'),
  };
  const saveTerm = <>
    <TermLabelFields labels={w.term.labels} onChange={labels => w.setTerm({ ...w.term, labels })} disabled={w.busy} />
    <Button title={t('Termini ýatda sakla', 'Сохранить термин')} onPress={() => void w.saveTerm()} disabled={w.busy || !w.term.labels.ru.trim() || !w.term.labels.tk.trim()} />
  </>;
  return <>
    <View style={styles.transferCard}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Excel bilen işlemek', 'Работа с Excel')}</Text>
      <Text style={typography.small}>{t('Katalogy we aýratyn surat faýllaryny geçiriň. Üýtgeşmeler ilki garalama ýazylýar.', 'Переносите каталог и отдельные файлы фотографий. Изменения сначала сохраняются в черновик.')}</Text>
      <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
        <Button title={t('Excel-den import', 'Импорт из Excel')} variant="secondary" onPress={() => { setIssuePage(0); void w.chooseWorkbook(); }} disabled={w.busy} style={styles.action} />
        <Button title={t('Excel-e eksport', 'Экспорт в Excel')} variant="secondary" onPress={() => void w.exportDraft()} disabled={w.busy} style={styles.action} />
        <Button title={t('Şablony almak', 'Скачать шаблон')} variant="ghost" onPress={() => void w.makeTemplate()} disabled={w.busy} style={styles.action} />
      </View>
      {w.template && <Button title={t('Excel şablonyny saklamak / paýlaşmak', 'Сохранить / отправить шаблон Excel')} variant="secondary" onPress={() => void w.share(w.template!.workbook)} disabled={w.busy} />}
      {w.exports && <View style={styles.output}>
        <Text style={s.label}>{t('Eksport taýýar', 'Экспорт готов')}</Text>
        <Text style={typography.small}>{t('Başga enjamda açmak üçin iki faýly hem saklaň.', 'Для переноса на другое устройство сохраните оба файла.')}</Text>
        <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
          <Button title={t('Excel faýlyny saklamak / paýlaşmak', 'Сохранить / отправить Excel')} variant="secondary" onPress={() => void w.share(w.exports!.workbook)} disabled={w.busy} style={styles.action} />
          {w.exports.photos && <Button title={t('Surat ZIP-ini saklamak / paýlaşmak', 'Сохранить / отправить ZIP с фото')} variant="secondary" onPress={() => void w.share(w.exports!.photos!, true)} disabled={w.busy} style={styles.action} />}
        </View>
      </View>}
      {w.operation && <View style={styles.output} accessibilityLiveRegion="polite">
        <View style={s.row}><ActivityIndicator color={colors.green} /><Text style={typography.body}>{operationNames[w.operation]} {w.progress}</Text></View>
        {!['save', 'share'].includes(w.operation) && <Button title={t('Amaly ýatyrmak', 'Отменить операцию')} variant="ghost" onPress={w.cancel} />}
      </View>}
      {!!w.error && <ErrorBanner message={`${messageForError(w.error, language)}${w.error instanceof AppError && w.error.detail ? ` ${w.error.detail}` : ''}`} />}
      {w.success && <Text accessibilityLiveRegion="polite" style={styles.success}>{w.success === 'photo' ? t('Surat garalama goşuldy.', 'Фото добавлено в черновик.') : w.success === 'term' ? t('Termin garalama goşuldy.', 'Термин добавлен в черновик.') : t('Import garalama ýazdyryldy.', 'Импорт сохранён в черновик.')}</Text>}
    </View>

    {w.book && w.review && <View style={s.card}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Importy barlamak', 'Проверка импорта')}</Text>
      <Text style={typography.small}>{w.book.name}</Text>
      <Text style={typography.small}>{t('Täze suratlar üçin atlary Excel-e gabat gelýän faýllary saýlaň. Bar bolan ID-ler suraty saklaýar, saýlanan faýl ony çalyşýar.', 'Для новых фото выберите файлы с именами из Excel. Существующие ID сохраняют свои изображения; выбранный файл заменяет изображение.')}</Text>
      <Button title={t('ZIP ýa-da suratlary saýlamak', 'Выбрать ZIP или фотографии')} variant="secondary" onPress={() => void w.chooseImages()} disabled={w.busy} />
      <Text style={typography.small}>{t('Taýýar suratlar', 'Подготовлено фотографий')}: {w.images.size}</Text>
      <View style={s.row}>
        <Chip label={t('Birleşdirmek', 'Объединить')} selected={w.mode === 'merge'} onPress={() => w.setMode('merge')} disabled={w.busy} />
        <Chip label={t('Garalamany çalyşmak', 'Заменить черновик')} selected={w.mode === 'replace'} onPress={() => w.setMode('replace')} disabled={w.busy} />
      </View>
      <Text style={typography.small}>{w.mode === 'merge'
        ? t('Ýok ýazgylar saklanýar. Excel-däki tertip öňe geçýär, beýleki suratlar yzyna goşulýar.', 'Отсутствующие записи сохраняются. Сначала идёт порядок из Excel, затем остальные фото подборки.')
        : t('Garalamada diňe Excel-däki ýazgylar galar. Çap edilen katalog üýtgemez.', 'В черновике останутся только записи из Excel. Опубликованный каталог сохранится.')}</Text>
      <View style={styles.stats}>
        {[ [t('Goşular', 'Добавится'), w.review.added], [t('Täzelener', 'Обновится'), w.review.updated], [t('Aýrylar', 'Удалится'), w.review.removed] ].map(([label, count]) => <View style={styles.stat} key={label}><Text style={styles.statNumber}>{count}</Text><Text style={typography.small}>{label}</Text></View>)}
      </View>
      <Text style={typography.small}>{t('Netije', 'После импорта')}: {w.review.catalog.photos.length} {t('surat', 'фото')} · {w.review.catalog.terms.length} {t('termin', 'терминов')}</Text>
      {SPACES.map(space => <View key={space} style={styles.summaryRow}><Text style={[typography.small, { flex: 1 }]}>{spaceLabel(space, language)}</Text><Text style={s.label}>{draft.galleries[space].length} → {w.review!.catalog.galleries[space].length}</Text></View>)}
      {w.review.warnings > 0 && <Text style={typography.small}>{t('Çap etmezden ozal tegleri tamamlamak gerek. Ähli meseleler çap ediş synynda görkeziler.', 'Перед публикацией потребуется дополнить теги. Все замечания будут доступны на экране проверки публикации.')}</Text>}
      {w.review.issues.length > 0 && <View style={styles.issues} accessibilityLiveRegion="polite">
        <Text style={s.label}>{t('Düzetmeli meseleler', 'Исправьте ошибки')}: {w.review.issues.length}</Text>
        {w.review.issues.slice(page * 25, (page + 1) * 25).map((issue, index) => <Text key={`${page}-${index}`} style={styles.issue}>{issue.sheet}{issue.row ? ` · ${t('setir', 'строка')} ${issue.row}` : ''}{issue.column ? ` · ${issue.column}` : ''}: {issue.labels[language]}</Text>)}
        {w.review.issues.length > 25 && <View style={s.row}>
          <Button title={t('Öňki ýalňyşlyklar', 'Предыдущие ошибки')} variant="ghost" disabled={page === 0} onPress={() => setIssuePage(page - 1)} />
          <Button title={t('Indiki ýalňyşlyklar', 'Следующие ошибки')} variant="ghost" disabled={(page + 1) * 25 >= w.review.issues.length} onPress={() => setIssuePage(page + 1)} />
        </View>}
      </View>}
      <Button title={t('Importy garalama ýazdyrmak', 'Сохранить импорт в черновик')} disabled={w.busy || !!w.review.issues.length} onPress={() => w.mode === 'replace' ? w.setConfirmReplace(true) : void w.applyImport()} />
      <Button title={t('Importy ýatyrmak', 'Отменить импорт')} variant="ghost" disabled={w.busy} onPress={w.discardImport} />
    </View>}

    <View style={styles.entryCard}>
      <View style={styles.entryHeading}><Text style={typography.eyebrow}>{t('GARALAMA', 'ЧЕРНОВИК')}</Text><Text accessibilityRole="header" style={typography.subheading}>{t('Maglumat goşmak', 'Добавить данные')}</Text><Text style={typography.small}>{t('Suratlary we tegleri şu ýerde goşuň.', 'Добавляйте фотографии и теги прямо здесь.')}</Text></View>
      <View style={s.row}>
        <Chip label={t('Täze surat', 'Новая фотография')} selected={w.entryMode === 'photo'} onPress={() => w.setEntryMode('photo')} disabled={w.busy} />
        <Chip label={t('Stil ýa-da teg', 'Стиль или тег')} selected={w.entryMode === 'term'} onPress={() => { w.setEntryMode('term'); w.setInlineTerm(false); }} disabled={w.busy} />
      </View>
      {w.entryMode === 'photo' ? <>
        <View style={[styles.editor, split && styles.editorSplit]}>
          <View style={[styles.imageColumn, split && { flex: 0.8 }]}>
            {w.photo ? <PhotoImage photo={w.photo} language={language} fit="contain" style={styles.image} /> : <View style={styles.imagePlaceholder}><Icon name="photo" size={36} fallback="＋" /><Text style={typography.body}>{t('Interýer suraty', 'Фотография интерьера')}</Text></View>}
            <Button title={w.photo ? t('Başga surat saýlamak', 'Выбрать другое фото') : t('Surat saýlamak', 'Выбрать фотографию')} variant="secondary" disabled={w.busy} onPress={() => void w.choosePhoto()} />
            <Text style={typography.small}>{t('Surat enjamda saklanar we oflaýn elýeterli bolar.', 'Фотография сохранится на устройстве и будет доступна офлайн.')}</Text>
          </View>
          <View style={[styles.fields, split && { flex: 1.2 }]}>
            <PhotoMetadataFields value={w.fields} terms={draft.terms} language={language} disabled={w.busy} onChange={value => { w.setFields(value); w.setSpaces(w.spaces.filter(space => space === 'whole_house' || space === value.room)); }} onAddTerm={w.startTerm}
              renderTermEditor={kind => w.inlineTerm && w.term.kind === kind ? <View style={styles.output}>
              <Text style={s.label}>{t('Täze termin', 'Новый термин')}: {kindLabel(w.term.kind, language)}</Text>
              {saveTerm}
              <Button title={t('Termini goşmagy ýatyrmak', 'Отменить добавление термина')} variant="ghost" disabled={w.busy} onPress={() => w.setInlineTerm(false)} />
            </View> : null} />
            <Text style={s.label}>{t('Topluma goşmak (hökmany däl)', 'Добавить в подборку (необязательно)')}</Text>
            <View style={s.row}>{[w.fields.room, 'whole_house' as const].map(space => <Chip key={space} label={spaceLabel(space, language)} selected={w.spaces.includes(space)} disabled={w.busy} onPress={() => w.setSpaces(w.spaces.includes(space) ? w.spaces.filter(value => value !== space) : [...w.spaces, space])} />)}</View>
            <Text style={typography.small}>{t('Çap etmek üçin bir stil we her kategoriýadan azyndan bir teg gerek. Häzir doly bolmadyk suraty garalama ýazdyryp bilersiňiz.', 'Для публикации нужны один стиль и хотя бы один тег каждой категории. Сейчас можно сохранить фото с незаполненными тегами в черновик.')}</Text>
            <Button title={t('Suraty garalama ýazdyrmak', 'Сохранить фото в черновик')} disabled={w.busy || !w.photo} onPress={() => void w.savePhoto()} />
          </View>
        </View>
      </> : <View style={styles.fields}>
        <View style={s.row}>{(['style', 'palette', 'material', 'detail'] as TermKind[]).map(kind => <Chip key={kind} label={kindLabel(kind, language)} selected={w.term.kind === kind} disabled={w.busy} onPress={() => { w.setTerm({ ...w.term, kind }); w.setInlineTerm(false); }} />)}</View>
        {saveTerm}
      </View>}
      <Button title={t('Formany arassalamak', 'Очистить форму')} variant="ghost" disabled={w.busy || !w.dirty} onPress={() => setDiscard(true)} />
    </View>
    <ConfirmDialog visible={discard} language={language} title={t('Formany arassalamalymy?', 'Очистить форму?')} description={t('Ýatda saklanmadyk giriş aýrylar. Garalama üýtgemez.', 'Несохранённые данные формы будут удалены. Черновик сохранится.')} confirmLabel={t('Arassalamak', 'Очистить')} cancelLabel={t('Dowam etmek', 'Продолжить')} onCancel={() => setDiscard(false)} onConfirm={() => { w.discardForm(); setDiscard(false); }} />
    <ConfirmDialog visible={w.confirmReplace} language={language} loading={w.busy} title={t('Ähli garalamany çalyşmalymy?', 'Заменить весь черновик?')} description={t(`Excel-de ýok ýazgylar aýrylar: ${w.review?.removed ?? 0}. Çap edilen katalog we müşderi seanslary saklanar.`, `Записей вне Excel будет удалено: ${w.review?.removed ?? 0}. Опубликованный каталог и сеансы клиентов сохранятся.`)} confirmLabel={t('Garalamany çalyşmak', 'Заменить черновик')} cancelLabel={t('Syna dolanmak', 'Вернуться к проверке')} onCancel={() => w.setConfirmReplace(false)} onConfirm={() => void w.applyImport()} />
  </>;
}

const styles = StyleSheet.create({
  transferCard: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 16, gap: 12 },
  entryCard: { ...s.card, padding: 18, gap: 18 }, entryHeading: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stacked: { flexDirection: 'column' }, action: { flexGrow: 1, minWidth: 160, maxWidth: '100%' },
  output: { padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, gap: 12 },
  success: { ...typography.body, color: colors.green, fontWeight: '600' },
  editor: { gap: 24 }, editorSplit: { flexDirection: 'row', alignItems: 'flex-start' }, imageColumn: { gap: 12, minWidth: 0 }, fields: { gap: 16, minWidth: 0 },
  image: { height: 240, width: '100%', borderRadius: 14 }, imagePlaceholder: { minHeight: 180, backgroundColor: colors.sand, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, stat: { padding: 12, borderRadius: 12, backgroundColor: colors.sand, flexGrow: 1, minWidth: 90 }, statNumber: { ...typography.heading, color: colors.green },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  issues: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft }, issue: { ...typography.small, color: colors.danger },
});
