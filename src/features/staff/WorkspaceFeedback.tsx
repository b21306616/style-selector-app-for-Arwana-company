import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorBanner, colors, tx, typography } from '../../components/ui';
import { AppError, messageForError } from '../../domain/errors';
import { useApp } from '../../state/AppProvider';
import { useStaffWorkspace, type FeedbackArea } from './workspace-context';

export function WorkspaceFeedback({ area }: { area: FeedbackArea }) {
  const { language } = useApp();
  const w = useStaffWorkspace();
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  if (w.feedbackArea !== area) return null;
  const names: Record<string, string> = {
    photo: t('Surat taýýarlanýar', 'Подготовка фотографии'), workbook: t('Excel okalýar', 'Чтение Excel'), images: t('Suratlar taýýarlanýar', 'Подготовка фотографий'),
    export: t('Eksport taýýarlanýar', 'Подготовка экспорта'), template: t('Şablon taýýarlanýar', 'Подготовка шаблона'), share: t('Faýly saklamak / paýlaşmak', 'Сохранение / отправка файла'), save: t('Ýatda saklanylýar', 'Сохранение'),
  };
  return <>
    {w.operation && <View style={styles.progress} accessibilityLiveRegion="polite">
      <View style={styles.row}><ActivityIndicator color={colors.green} /><Text style={styles.message}>{names[w.operation]} {w.progress}</Text></View>
      {!['save', 'share'].includes(w.operation) && <Button title={t('Amaly ýatyrmak', 'Отменить операцию')} variant="ghost" onPress={w.cancel} />}
    </View>}
    {!!w.error && <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite"><ErrorBanner message={`${messageForError(w.error, language)}${w.error instanceof AppError && w.error.detail ? ` ${w.error.detail}` : ''}`} /></View>}
    {w.success && <Text accessibilityLiveRegion="polite" style={styles.success}>{w.success === 'photo' ? t('Surat garalama goşuldy.', 'Фото добавлено в черновик.') : w.success === 'term' ? t('Termin garalama goşuldy.', 'Термин добавлен в черновик.') : t('Import garalama ýazdyryldy.', 'Импорт сохранён в черновик.')}</Text>}
  </>;
}

const styles = StyleSheet.create({
  progress: { padding: 12, backgroundColor: colors.greenSoft, borderRadius: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, message: { ...typography.body, flex: 1 },
  success: { ...typography.small, color: colors.green, fontWeight: '600' },
});
