import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from '../../components/AppModal';
import { Icon, IconButton } from '../../components/Icon';
import { Button, TextField, colors, tx, typography, useLayout } from '../../components/ui';
import type { Labels, Language } from '../../domain/types';

export type SelectionOption = { id: string; labels: Labels };

type SelectionProps = {
  label: string;
  language: Language;
  options: SelectionOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  onCreate?: () => void;
  editor?: ReactNode;
  onVisibilityChange?: (visible: boolean) => void;
};

/** Choices are controlled by the form; dismissing a picker never rolls them back. */
export function SelectionField(props: SelectionProps) {
  const { label, language, options, selectedIds, disabled, onVisibilityChange } = props;
  const [open, setOpen] = useState(false);
  const trigger = useRef<ComponentRef<typeof View>>(null);
  const names = useMemo(() => {
    const labels = new Map(options.map(option => [option.id, option.labels[language]]));
    return selectedIds.map(id => labels.get(id)).filter((name): name is string => !!name);
  }, [options, selectedIds, language]);
  const summary = names.length ? names.slice(0, 2).join(', ') : tx(language, 'Saýlaň', 'Выберите');
  const close = () => {
    if (disabled) return;
    setOpen(false);
    onVisibilityChange?.(false);
    trigger.current?.focus();
  };
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={label}
      accessibilityValue={{ text: names.length ? names.join(', ') : tx(language, 'Saýlanmady', 'Не выбрано') }}
      accessibilityState={{ expanded: open, disabled: !!disabled }} disabled={disabled}
      onPress={() => { setOpen(true); onVisibilityChange?.(true); }}
      style={({ pressed }) => [styles.trigger, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text numberOfLines={2} style={[styles.value, !names.length && styles.placeholder]}>{summary}</Text>
      {names.length > 2 && <Text style={styles.count}>+{names.length - 2}</Text>}
      <Icon name="expand" size={20} fallback="⌄" />
    </Pressable>
    {open && <SelectionSheet {...props} onClose={close} />}
  </View>;
}

function SelectionSheet({ label, language, options, selectedIds, onChange, onClose, multiple = false, searchable = false, allowClear = false, disabled = false, onCreate, editor }: SelectionProps & { onClose: () => void }) {
  const { tablet, height, fontScale } = useLayout();
  const fullHeight = height < 600 || fontScale >= 1.5;
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  return <AppModal testID="selection-sheet" visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
      <SafeAreaView style={[styles.safe, tablet && styles.centered, fullHeight && styles.fullSafe]}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} disabled={disabled} />
        <View accessibilityViewIsModal style={[styles.panel, tablet && styles.tabletPanel, fullHeight && styles.fullPanel]}>
          <View style={styles.heading}>
            <View style={styles.headingText}>
              <Text accessibilityRole="header" style={typography.subheading}>{editor ? t('Täze termin', 'Новый термин') : label}</Text>
              <Text style={typography.small}>{editor ? label : multiple ? `${t('Saýlandy', 'Выбрано')}: ${selectedIds.length}` : t('Birini saýlaň', 'Выберите один вариант')}</Text>
            </View>
            <IconButton icon="close" label={t('Ýapmak', 'Закрыть')} disabled={disabled} onPress={onClose} />
          </View>
          {editor ? <ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{editor}</ScrollView>
            : <SelectionList label={label} language={language} options={options} selectedIds={selectedIds} onChange={onChange} onClose={onClose} multiple={multiple} searchable={searchable} allowClear={allowClear} disabled={disabled} onCreate={onCreate} />}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </AppModal>;
}

/** A separate list resets its search when returning from the term editor. */
function SelectionList({ label, language, options, selectedIds, onChange, onClose, multiple, searchable, allowClear, disabled, onCreate }: SelectionProps & { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const list = useRef<FlatList<SelectionOption>>(null);
  const t = (tk: string, ru: string) => tx(language, tk, ru);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? options.filter(option => `${option.labels.ru} ${option.labels.tk}`.toLocaleLowerCase().includes(query)) : options;
  }, [options, search]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  return <>
    <FlatList ref={list} data={filtered} extraData={selected} keyExtractor={option => option.id}
      style={styles.list} contentContainerStyle={styles.listContent} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListHeaderComponent={searchable || onCreate || allowClear ? <View style={styles.listHeading}>
        {searchable && <TextField label={`${t('Gözleg', 'Поиск')}: ${label}`} value={search} editable={!disabled} autoCorrect={false}
          onChangeText={value => { setSearch(value); list.current?.scrollToOffset({ offset: 0, animated: false }); }}
          placeholder={t('Ady boýunça gözleg', 'Поиск по названию')} />}
        <View style={styles.actions}>
          {onCreate && <Button title={t('＋ Täze termin', '＋ Новый термин')} accessibilityLabel={`${t('＋ Täze', '＋ Добавить')}: ${label}`} variant="secondary" disabled={disabled} onPress={onCreate} style={styles.action} />}
          {allowClear && <Button title={t('Arassalamak', 'Сбросить')} accessibilityLabel={t('Saýlawy arassalamak', 'Сбросить выбор')} variant="ghost" disabled={disabled || !selectedIds.length} onPress={() => onChange([])} style={styles.action} />}
        </View>
      </View> : undefined}
      renderItem={({ item }) => <SelectionRow label={item.labels[language]} checked={selected.has(item.id)} multiple={multiple} disabled={disabled}
        onPress={() => {
          onChange(multiple ? selected.has(item.id) ? selectedIds.filter(id => id !== item.id) : [...selectedIds, item.id] : [item.id]);
          if (!multiple) onClose();
        }} />}
      ListEmptyComponent={<View style={styles.empty}><Text style={typography.body}>{options.length ? t('Gabat gelýän netije ýok.', 'Ничего не найдено.') : t('Bu kategoriýada entek termin ýok.', 'В этой категории пока нет терминов.')}</Text></View>} />
    {multiple && <View style={styles.footer}><Button title={t('Taýýar', 'Готово')} disabled={disabled} onPress={onClose} /></View>}
  </>;
}

export function SelectionRow({ label, checked, onPress, multiple = true, disabled = false }: { label: string; checked: boolean; onPress: () => void; multiple?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.option, checked && styles.selectedOption, disabled && styles.disabled, pressed && styles.pressed]}>
    <View style={[styles.mark, !multiple && styles.radio, checked && styles.checkedMark]}>
      {checked && (multiple ? <Icon name="check" size={16} color={colors.white} fallback="✓" /> : <View style={styles.radioDot} />)}
    </View>
    <Text style={[styles.optionText, checked && styles.selectedText]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  field: { gap: 8 }, label: { ...typography.small, color: colors.ink, fontWeight: '600' },
  trigger: { minHeight: 56, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { ...typography.body, color: colors.ink, flex: 1 }, placeholder: { color: colors.muted },
  count: { ...typography.small, color: colors.green, fontWeight: '700' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  overlay: { flex: 1, backgroundColor: colors.overlay }, safe: { flex: 1, padding: 12, justifyContent: 'flex-end' }, centered: { justifyContent: 'center', padding: 24 }, fullSafe: { padding: 0 },
  panel: { height: '90%', width: '100%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden' }, tabletPanel: { maxWidth: 560 }, fullPanel: { height: '100%', borderRadius: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, headingText: { flex: 1, gap: 4 },
  listHeading: { gap: 12, marginBottom: 12 }, list: { flex: 1 }, listContent: { padding: 12, gap: 6 }, editor: { padding: 16, gap: 16 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 52, padding: 12, gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  selectedOption: { backgroundColor: colors.greenSoft, borderColor: '#B9CBB8' }, optionText: { ...typography.body, color: colors.ink, flex: 1 }, selectedText: { color: colors.green },
  mark: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  radio: { borderRadius: 11 }, checkedMark: { borderColor: colors.green, backgroundColor: colors.green }, radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  empty: { padding: 16, gap: 8 }, footer: { padding: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { flexGrow: 1, flexBasis: 140 },
});
