import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, colors, tx, typography, useLayout } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Disclosure } from '../../components/Disclosure';
import type { TransferIssue } from '../../domain/catalog-transfer';
import type { Language } from '../../domain/types';
import { useApp } from '../../state/AppProvider';
import { DraftEntryCard } from './DraftEntryCard';
import { WorkspaceFeedback } from './WorkspaceFeedback';
import { staffStyles as s } from './shared';
import { useStaffWorkspace } from './workspace-context';

function IssueText({ issue, language }: { issue: TransferIssue; language: Language }) {
  const location = [issue.sheet, issue.row ? `${tx(language, 'setir', 'строка')} ${issue.row}` : '', issue.column].filter(Boolean).join(' · ');
  return <Text style={styles.issue}>{location}{'\n'}{issue.labels[language]}</Text>;
}

function AdditionalIssues({ issues, language }: { issues: TransferIssue[]; language: Language }) {
  const [page, setPage] = useState(0);
  const last = Math.ceil((issues.length - 1) / 25) - 1;
  const current = Math.min(page, last);
  const start = 1 + current * 25;
  return <View style={styles.issueList}>
    {issues.slice(start, start + 25).map((issue, index) => <IssueText key={start + index} issue={issue} language={language} />)}
    {last > 0 && <>
      <Button title={tx(language, 'Öňki ýalňyşlyklar', 'Предыдущие ошибки')} variant="ghost" disabled={current === 0} onPress={() => setPage(current - 1)} />
      <Button title={tx(language, 'Indiki ýalňyşlyklar', 'Следующие ошибки')} variant="ghost" disabled={current === last} onPress={() => setPage(current + 1)} />
    </>}
  </View>;
}

export function DashboardWorkbench() {
  const { draft, language } = useApp();
  const w = useStaffWorkspace();
  const { fontScale } = useLayout();
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  if (!draft) return null;
  const review = w.review;
  const emptyImport = review?.issues.length === 0 && review.catalog.photos.length === 0;
  return <>
    <View style={styles.transferCard}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Excel bilen işlemek', 'Работа с Excel')}</Text>
      <Text style={typography.small}>{t('Her suratyň faýl adyny Russian we Turkmen sahypalarynyň ikisinde-de ýazyň. Boş öýjük şol suratyň degişli dildäki maglumatyny garalamadan aýyrýar.', 'Укажите имя файла каждого фото на обоих листах Russian и Turkmen. Пустая ячейка очищает поле этого фото на языке листа.')}</Text>
      <Text style={typography.small}>Image filename · Room · Style · Palette · Material · Detail</Text>
      <Text style={typography.small}>{t('Bir stil ýazyp bilersiňiz. Palitranyň, materialyň we detalyň atlaryny nokatly otur bilen aýryň. Iki sanaw hem doldurylsa, atlaryň sany we tertibi gabat gelmeli.', 'Можно указать один стиль. Названия палитр, материалов и деталей разделяйте точкой с запятой. Если заполнены оба списка, количество и порядок названий должны совпадать.')}</Text>
      <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
        <Button title={t('Excel-den import', 'Импорт из Excel')} variant="secondary" onPress={() => void w.chooseWorkbook()} disabled={w.busy} style={styles.action} />
        <Button title={t('Excel-e eksport', 'Экспорт в Excel')} variant="secondary" onPress={() => void w.exportDraft()} disabled={w.busy} style={styles.action} />
        <Button title={t('Şablony almak', 'Скачать шаблон')} variant="ghost" onPress={() => void w.makeTemplate()} disabled={w.busy} style={styles.action} />
      </View>
      {w.template && <Button title={t('Excel şablonyny saklamak / paýlaşmak', 'Сохранить / отправить шаблон Excel')} variant="secondary" onPress={() => void w.share(w.template!.workbook)} disabled={w.busy} />}
      {w.exports && <View style={styles.output}>
        <Text style={s.label}>{t('Eksport taýýar', 'Экспорт готов')}</Text>
        <Text style={typography.small}>{t('Başga enjama geçirmek üçin Excel kitabyny we suratly ZIP faýly saklaň. Kitaba diňe suratlarda ulanylýan otaglar we tegler girýär.', 'Для переноса на другое устройство сохраните книгу Excel и ZIP с фотографиями. В книгу входят комнаты и теги, указанные у фотографий.')}</Text>
        <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
          <Button title={t('Excel faýlyny saklamak / paýlaşmak', 'Сохранить / отправить Excel')} variant="secondary" onPress={() => void w.share(w.exports!.workbook)} disabled={w.busy} style={styles.action} />
          {w.exports.photos && <Button title={t('Surat ZIP-ini saklamak / paýlaşmak', 'Сохранить / отправить ZIP с фото')} variant="secondary" onPress={() => void w.share(w.exports!.photos!, true)} disabled={w.busy} style={styles.action} />}
        </View>
      </View>}
      <WorkspaceFeedback area="transfer" />
    </View>

    {w.book && review && <View style={s.card} testID="import-review">
      <Text accessibilityRole="header" style={typography.subheading}>{t('Importy barlamak', 'Проверка импорта')}</Text>
      <Text style={typography.small}>{w.book.name}</Text>
      {review.issues.length > 0 ? <View style={styles.issues} accessibilityLiveRegion="polite">
        <IssueText issue={review.issues[0]} language={language} />
        {review.issues.length > 1 && <Disclosure key={`${w.book.name}-${w.bookKey ?? 0}`} title={`${t('Beýleki ýalňyşlyklar', 'Остальные ошибки')} (${review.issues.length - 1})`}>
          <AdditionalIssues issues={review.issues} language={language} />
        </Disclosure>}
      </View> : emptyImport ? <Text style={styles.warning} accessibilityRole="alert">
        {t('Kitapda surat ýok. Import tutuş garalamany arassalar.', 'В книге нет фото. Импорт очистит весь черновик.')}
      </Text> : <>
        <Text style={typography.body}>{t(`Garalamada ${review.catalog.photos.length} surat bolar.`, `В черновике будет ${review.catalog.photos.length} фото.`)}</Text>
        {review.warnings > 0 && <Text style={typography.small}>{t('Çap etmezden ozal ýetmeýän maglumatlary dolduryň.', 'Перед публикацией заполните недостающие данные.')}</Text>}
      </>}
      {w.book.workbook.photos.length > 0 && <Button title={t('ZIP ýa-da suratlary saýlamak', 'Выбрать ZIP или фотографии')} variant="secondary" onPress={() => void w.chooseImages()} disabled={w.busy} />}
      <WorkspaceFeedback area="import" />
      <Button title={t('Importy garalama ýazdyrmak', 'Сохранить импорт в черновик')} disabled={w.busy || review.issues.length > 0} onPress={() => w.setConfirmReplace(true)} />
      <Button title={t('Importy ýatyrmak', 'Отменить импорт')} variant="ghost" disabled={w.busy} onPress={w.discardImport} />
    </View>}

    <DraftEntryCard />
    <ConfirmDialog visible={w.confirmReplace} language={language} loading={w.busy}
      title={emptyImport ? t('Garalamany doly arassalamalymy?', 'Очистить весь черновик?') : t('Ähli garalamany çalyşmalymy?', 'Заменить весь черновик?')}
      description={emptyImport
        ? t('Kitapda surat ýok. Garalamadaky ähli suratlar, otaglar, stiller, palitralar, materiallar, detallar we toplumlaryň mazmuny aýrylar.', 'В книге нет фото. Из черновика будут удалены все фотографии, комнаты, стили, палитры, материалы, детали и содержимое подборок.')
        : t('Garalamada diňe şu kitapdaky suratlar we maglumatlar saklanar. Katalog aýratyn çap edilýär.', 'В черновике будут только фотографии и данные из этой книги. Каталог публикуется отдельно.')}
      confirmLabel={emptyImport ? t('Garalamany arassalamak', 'Очистить черновик') : t('Garalamany çalyşmak', 'Заменить черновик')}
      cancelLabel={t('Syna dolanmak', 'Вернуться к проверке')} onCancel={() => w.setConfirmReplace(false)} onConfirm={() => void w.applyImport()} />
  </>;
}

const styles = StyleSheet.create({
  transferCard: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 16, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stacked: { flexDirection: 'column' }, action: { flexGrow: 1, minWidth: 160, maxWidth: '100%' },
  output: { padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, gap: 12 },
  warning: { ...typography.body, color: colors.danger }, issueList: { gap: 10 },
  issues: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft }, issue: { ...typography.small, color: colors.danger },
});
