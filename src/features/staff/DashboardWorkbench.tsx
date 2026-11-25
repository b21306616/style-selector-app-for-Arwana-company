import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, colors, spaceLabel, tx, typography, useLayout } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { catalogSpaces } from '../../domain/rooms';
import { useApp } from '../../state/AppProvider';
import { DraftEntryCard } from './DraftEntryCard';
import { WorkspaceFeedback } from './WorkspaceFeedback';
import { staffStyles as s } from './shared';
import { useStaffWorkspace } from './workspace-context';

export function DashboardWorkbench() {
  const { draft, language } = useApp();
  const w = useStaffWorkspace();
  const { fontScale } = useLayout();
  const [issuePage, setIssuePage] = useState(0);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  if (!draft) return null;
  const page = Math.min(issuePage, Math.max(0, Math.ceil((w.review?.issues.length ?? 0) / 25) - 1));
  return <>
    <View style={styles.transferCard}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Excel bilen işlemek', 'Работа с Excel')}</Text>
      <Text style={typography.small}>{t('Russian we Turkmen sahypalarynda her suratyň maglumatlaryny degişli dilde dolduryň. Import üçin alty sütüniň hemmesi hökmany.', 'Заполните сведения о каждом фото на двух листах: Russian — по-русски, Turkmen — по-туркменски. Для импорта обязательны все шесть столбцов.')}</Text>
      <Text style={typography.small}>Image filename · Room · Style · Palette · Material · Detail</Text>
      <Text style={typography.small}>{t('Iki sahypada-da şol bir faýl atlaryny ulanyň. Bir stil ýazyň; palitranyň, materialyň we detalyň birnäçe adyny nokatly otur bilen aýryň. Terjimeleri şol bir tertipde ýazyň.', 'На обоих листах используйте одинаковые имена файлов. Укажите один стиль; несколько названий палитры, материалов и деталей разделяйте точкой с запятой. Переводы перечисляйте в том же порядке.')}</Text>
      <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
        <Button title={t('Excel-den import', 'Импорт из Excel')} variant="secondary" onPress={() => { setIssuePage(0); void w.chooseWorkbook(); }} disabled={w.busy} style={styles.action} />
        <Button title={t('Excel-e eksport', 'Экспорт в Excel')} variant="secondary" onPress={() => void w.exportDraft()} disabled={w.busy} style={styles.action} />
        <Button title={t('Şablony almak', 'Скачать шаблон')} variant="ghost" onPress={() => void w.makeTemplate()} disabled={w.busy} style={styles.action} />
      </View>
      {w.template && <Button title={t('Excel şablonyny saklamak / paýlaşmak', 'Сохранить / отправить шаблон Excel')} variant="secondary" onPress={() => void w.share(w.template!.workbook)} disabled={w.busy} />}
      {w.exports && <View style={styles.output}>
        <Text style={s.label}>{t('Eksport taýýar', 'Экспорт готов')}</Text>
        <Text style={typography.small}>{t('Başga enjamda açmak üçin iki faýly hem saklaň. Boş öýjükleri Excel-de dolduryp, soňra import ediň. Kitap surat maglumatlaryny we suratlary geçirýär; ulanylmaýan otaglar, tegler we toplumlaryň aýratyn tertibi saklanmaýar.', 'Для переноса на другое устройство сохраните оба файла. Пустые ячейки необходимо заполнить в Excel перед импортом. Книга переносит описания и изображения; неиспользуемые комнаты, теги и отдельный порядок подборок не сохраняются.')}</Text>
        <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
          <Button title={t('Excel faýlyny saklamak / paýlaşmak', 'Сохранить / отправить Excel')} variant="secondary" onPress={() => void w.share(w.exports!.workbook)} disabled={w.busy} style={styles.action} />
          {w.exports.photos && <Button title={t('Surat ZIP-ini saklamak / paýlaşmak', 'Сохранить / отправить ZIP с фото')} variant="secondary" onPress={() => void w.share(w.exports!.photos!, true)} disabled={w.busy} style={styles.action} />}
        </View>
      </View>}
      <WorkspaceFeedback area="transfer" />
    </View>

    {w.book && w.review && <View style={s.card}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Importy barlamak', 'Проверка импорта')}</Text>
      <Text style={typography.small}>{w.book.name}</Text>
      <Text style={typography.small}>{t('Täze suratlar üçin atlary Excel-e gabat gelýän faýllary saýlaň. Bar bolan faýl ady şol suraty täzeleýär; täze faýl saýlanmasa, öňki surat saklanýar. Üýtgeşmeler ilki garalama ýazylýar.', 'Для новых фото выберите файлы с именами из Excel. Совпадающее имя обновляет существующее фото; если новый файл не выбран, изображение сохраняется. Изменения сначала сохраняются в черновик.')}</Text>
      <Button title={t('ZIP ýa-da suratlary saýlamak', 'Выбрать ZIP или фотографии')} variant="secondary" onPress={() => void w.chooseImages()} disabled={w.busy} />
      <Text style={typography.small}>{t('Taýýar suratlar', 'Подготовлено фотографий')}: {w.images.size}</Text>
      <View style={s.row}>
        <Chip label={t('Birleşdirmek', 'Объединить')} selected={w.mode === 'merge'} onPress={() => w.setMode('merge')} disabled={w.busy} />
        <Chip label={t('Garalamany çalyşmak', 'Заменить черновик')} selected={w.mode === 'replace'} onPress={() => w.setMode('replace')} disabled={w.busy} />
      </View>
      <Text style={typography.small}>{w.mode === 'merge'
        ? t('Kitapda ýok ýazgylar we öňki toplumlaryň tertibi saklanýar. Täze suratlar diňe öz otagynyň toplumyna, Russian sahypasynyň tertibinde goşulýar.', 'Записи вне книги и порядок существующих подборок сохраняются. Новые фото добавляются только в подборку своей комнаты, в порядке листа Russian.')
        : t('Diňe Excel-däki ýazgylar galar. Otag toplumlary Russian sahypasynyň tertibinde dörediler; «Bütin jaý» boş bolar. Çap edilen katalog üýtgemez.', 'Останутся только записи из Excel. Комнатные подборки будут созданы в порядке листа Russian; «Весь дом» станет пустым. Опубликованный каталог сохранится.')}</Text>
      <View style={styles.stats}>
        {[ [t('Goşular', 'Добавится'), w.review.added], [t('Täzelener', 'Обновится'), w.review.updated], [t('Aýrylar', 'Удалится'), w.review.removed] ].map(([label, count]) => <View style={styles.stat} key={label}><Text style={styles.statNumber}>{count}</Text><Text style={typography.small}>{label}</Text></View>)}
      </View>
      <Text style={typography.small}>{t('Netije', 'После импорта')}: {w.review.catalog.photos.length} {t('surat', 'фото')} · {w.review.catalog.terms.length} {t('termin', 'терминов')}</Text>
      {catalogSpaces(w.review.catalog).map(space => <View key={space} style={styles.summaryRow}><Text style={[typography.small, { flex: 1 }]}>{spaceLabel(space, language, w.review!.catalog.rooms)}</Text><Text style={s.label}>{draft.galleries[space]?.length ?? 0} → {w.review!.catalog.galleries[space].length}</Text></View>)}
      {w.review.issues.length === 0 && w.review.warnings > 0 && <Text style={typography.small}>{t('Çap etmezden ozal tegleri tamamlamak gerek. Ähli meseleler çap ediş synynda görkeziler.', 'Перед публикацией потребуется дополнить теги. Все замечания будут доступны на экране проверки публикации.')}</Text>}
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

    <DraftEntryCard />
    <ConfirmDialog visible={w.confirmReplace} language={language} loading={w.busy} title={t('Ähli garalamany çalyşmalymy?', 'Заменить весь черновик?')} description={t(`Excel-de ýok ýazgylar aýrylar: ${w.review?.removed ?? 0}. Çap edilen katalog we müşderi seanslary saklanar.`, `Записей вне Excel будет удалено: ${w.review?.removed ?? 0}. Опубликованный каталог и сеансы клиентов сохранятся.`)} confirmLabel={t('Garalamany çalyşmak', 'Заменить черновик')} cancelLabel={t('Syna dolanmak', 'Вернуться к проверке')} onCancel={() => w.setConfirmReplace(false)} onConfirm={() => void w.applyImport()} />
  </>;
}

const styles = StyleSheet.create({
  transferCard: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 16, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stacked: { flexDirection: 'column' }, action: { flexGrow: 1, minWidth: 160, maxWidth: '100%' },
  output: { padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, stat: { padding: 12, borderRadius: 12, backgroundColor: colors.sand, flexGrow: 1, minWidth: 90 }, statNumber: { ...typography.heading, color: colors.green },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  issues: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft }, issue: { ...typography.small, color: colors.danger },
});
