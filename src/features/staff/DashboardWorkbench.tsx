import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, colors, spaceLabel, tx, typography, useLayout } from '../../components/ui';
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
  const emptyImport = w.review?.issues.length === 0 && w.review.catalog.photos.length === 0;
  return <>
    <View style={styles.transferCard}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Excel bilen işlemek', 'Работа с Excel')}</Text>
      <Text style={typography.small}>{t('Her suratyň faýl adyny Russian we Turkmen sahypalarynyň ikisinde-de ýazyň. Boş öýjük şol suratyň degişli dildäki maglumatyny garalamadan aýyrýar.', 'Укажите имя файла каждого фото на обоих листах Russian и Turkmen. Пустая ячейка очищает поле этого фото на языке листа.')}</Text>
      <Text style={typography.small}>Image filename · Room · Style · Palette · Material · Detail</Text>
      <Text style={typography.small}>{t('Bir stil ýazyp bilersiňiz. Palitranyň, materialyň we detalyň atlaryny nokatly otur bilen aýryň. Iki sanaw hem doldurylsa, atlaryň sany we tertibi gabat gelmeli.', 'Можно указать один стиль. Названия палитр, материалов и деталей разделяйте точкой с запятой. Если заполнены оба списка, количество и порядок названий должны совпадать.')}</Text>
      <View style={[styles.actions, fontScale >= 1.5 && styles.stacked]}>
        <Button title={t('Excel-den import', 'Импорт из Excel')} variant="secondary" onPress={() => { setIssuePage(0); void w.chooseWorkbook(); }} disabled={w.busy} style={styles.action} />
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

    {w.book && w.review && <View style={s.card}>
      <Text accessibilityRole="header" style={typography.subheading}>{t('Importy barlamak', 'Проверка импорта')}</Text>
      <Text style={typography.small}>{w.book.name}</Text>
      {!emptyImport && <>
        <Text style={typography.small}>{t('Täze suratlar üçin Excel-de görkezilen atlar bilen faýllary saýlaň. Ady gabat gelse, saklanan surat ulanylar. Ony çalyşmak üçin şol at bilen täze faýly saýlaň.', 'Для новых фото выберите файлы с именами из Excel. При совпадении имени используется сохранённое изображение. Для его замены выберите новый файл с тем же именем.')}</Text>
        <Button title={t('ZIP ýa-da suratlary saýlamak', 'Выбрать ZIP или фотографии')} variant="secondary" onPress={() => void w.chooseImages()} disabled={w.busy} />
        <Text style={typography.small}>{t('Taýýar suratlar', 'Подготовлено фотографий')}: {w.images.size}</Text>
      </>}
      <Text style={typography.small}>{t('Garalama tutuşlygyna kitapdaky maglumatlar bilen çalşylar. Otag toplumlary Russian sahypasynyň tertibinde dörediler, «Bütin jaý» boş bolar.', 'Книга полностью заменит черновик. Комнатные подборки будут собраны в порядке листа Russian. Подборка «Весь дом» будет пустой.')}</Text>
      <View style={styles.stats}>
        {[ [t('Häzirki ýazgylar', 'Записей сейчас'), w.review.removed], [t('Importdan soňky ýazgylar', 'Записей после импорта'), w.review.added] ].map(([label, count]) => <View style={styles.stat} key={label}><Text style={styles.statNumber}>{count}</Text><Text style={typography.small}>{label}</Text></View>)}
      </View>
      <Text style={typography.small}>{t('Netije', 'После импорта')}: {w.review.catalog.photos.length} {t('surat', 'фото')} · {w.review.catalog.terms.length} {t('termin', 'терминов')}</Text>
      {catalogSpaces(w.review.catalog).map(space => <View key={space} style={styles.summaryRow}><Text style={[typography.small, { flex: 1 }]}>{spaceLabel(space, language, w.review!.catalog.rooms)}</Text><Text style={s.label}>{draft.galleries[space]?.length ?? 0} → {w.review!.catalog.galleries[space].length}</Text></View>)}
      {w.review.issues.length === 0 && w.review.warnings > 0 && <Text style={typography.small}>{t('Garalamany häzir saklap bilersiňiz. Çap etmezden ozal ýetmeýän maglumatlary dolduryň.', 'Черновик можно сохранить сейчас. Перед публикацией заполните недостающие данные.')}</Text>}
      {w.review.issues.length > 0 && <View style={styles.issues} accessibilityLiveRegion="polite">
        <Text style={s.label}>{t('Düzetmeli meseleler', 'Исправьте ошибки')}: {w.review.issues.length}</Text>
        {w.review.issues.slice(page * 25, (page + 1) * 25).map((issue, index) => <Text key={`${page}-${index}`} style={styles.issue}>{issue.sheet}{issue.row ? ` · ${t('setir', 'строка')} ${issue.row}` : ''}{issue.column ? ` · ${issue.column}` : ''}: {issue.labels[language]}</Text>)}
        {w.review.issues.length > 25 && <View style={s.row}>
          <Button title={t('Öňki ýalňyşlyklar', 'Предыдущие ошибки')} variant="ghost" disabled={page === 0} onPress={() => setIssuePage(page - 1)} />
          <Button title={t('Indiki ýalňyşlyklar', 'Следующие ошибки')} variant="ghost" disabled={(page + 1) * 25 >= w.review.issues.length} onPress={() => setIssuePage(page + 1)} />
        </View>}
      </View>}
      <Button title={t('Importy garalama ýazdyrmak', 'Сохранить импорт в черновик')} disabled={w.busy || !!w.review.issues.length} onPress={() => w.setConfirmReplace(true)} />
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, stat: { padding: 12, borderRadius: 12, backgroundColor: colors.sand, flexGrow: 1, minWidth: 90 }, statNumber: { ...typography.heading, color: colors.green },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  issues: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft }, issue: { ...typography.small, color: colors.danger },
});
