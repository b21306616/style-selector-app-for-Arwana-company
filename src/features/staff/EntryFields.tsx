import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, TextField, colors, spaceLabel, tx, typography } from '../../components/ui';
import { ROOMS, type Language, type Labels, type Term, type TermKind } from '../../domain/types';
import { kindLabel, staffStyles as s } from './shared';
import type { PhotoFieldsValue } from './workspace-context';
import { SelectionField, type SelectionOption } from './SelectionField';

export function TermLabelFields({ labels, onChange, disabled = false }: { labels: Labels; onChange: (labels: Labels) => void; disabled?: boolean }) {
  return <>
    <TextField label="Русское название" value={labels.ru} onChangeText={ru => onChange({ ...labels, ru })} maxLength={100} editable={!disabled} />
    <TextField label="Türkmençe ady" value={labels.tk} onChangeText={tk => onChange({ ...labels, tk })} maxLength={100} editable={!disabled} />
  </>;
}

function TermChoices({ terms, kind, language, selected, onSelect, disabled }: {
  terms: Term[]; kind: TermKind; language: Language; selected: (id: string) => boolean; onSelect: (id: string) => void; disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const query = search.trim().toLocaleLowerCase();
  const filtered = terms.filter(term => !query || `${term.labels.ru} ${term.labels.tk}`.toLocaleLowerCase().includes(query));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 30) - 1));
  return <View style={{ gap: 8 }}>
    {terms.length > 18 && <TextField label={`${tx(language, 'Gözleg', 'Поиск')}: ${kindLabel(kind, language)}`} value={search} onChangeText={value => { setSearch(value); setPage(0); }} editable={!disabled} />}
    <View style={s.row}>{filtered.slice(currentPage * 30, (currentPage + 1) * 30).map(term => <Chip key={term.id} label={term.labels[language]} selected={selected(term.id)} disabled={disabled} onPress={() => onSelect(term.id)} />)}</View>
    {filtered.length > 30 && <View style={s.row}>
      <Button title={tx(language, 'Öňki tegler', 'Предыдущие теги')} variant="ghost" disabled={disabled || !currentPage} onPress={() => setPage(currentPage - 1)} />
      <Text style={s.label}>{currentPage + 1} / {Math.ceil(filtered.length / 30)}</Text>
      <Button title={tx(language, 'Indiki tegler', 'Следующие теги')} variant="ghost" disabled={disabled || (currentPage + 1) * 30 >= filtered.length} onPress={() => setPage(currentPage + 1)} />
    </View>}
    {terms.length > 18 && <Text style={s.label}>{tx(language, 'Saýlanan', 'Выбрано')}: {terms.filter(term => selected(term.id)).map(term => term.labels[language]).join(', ') || '—'}</Text>}
  </View>;
}

type PhotoMetadataProps = {
  value: PhotoFieldsValue; terms: Term[]; language: Language; onChange: (value: PhotoFieldsValue) => void; onAddTerm?: (kind: TermKind) => void; renderTermEditor?: (kind: TermKind) => ReactNode; disabled?: boolean;
  presentation?: 'chips' | 'compact'; onPickerVisibilityChange?: (visible: boolean) => void;
};

export function PhotoMetadataFields(props: PhotoMetadataProps) {
  const { value, terms, language, onChange, onAddTerm, renderTermEditor, disabled = false } = props;
  if (props.presentation === 'compact') return <CompactPhotoMetadataFields {...props} />;
  return <>
    <View style={s.section}>
      <Text style={s.label}>{tx(language, 'Otag', 'Комната')}</Text>
      <View style={s.row}>{ROOMS.map(room => <Chip key={room} label={spaceLabel(room, language)} selected={value.room === room} disabled={disabled} onPress={() => onChange({ ...value, room })} />)}</View>
    </View>
    {(['style', 'palette', 'material', 'detail'] as const).map(kind => {
      const field = kind === 'palette' ? 'paletteIds' : kind === 'material' ? 'materialIds' : 'detailIds';
      return <View key={kind} style={s.section}>
        <Text style={s.label}>{kindLabel(kind, language)}</Text>
        <TermChoices terms={terms.filter(term => term.kind === kind)} kind={kind} language={language} disabled={disabled}
          selected={id => kind === 'style' ? value.styleId === id : value[field].includes(id)}
          onSelect={id => onChange(kind === 'style' ? { ...value, styleId: id } : { ...value, [field]: value[field].includes(id) ? value[field].filter(value => value !== id) : [...value[field], id] })} />
        {onAddTerm && <Button title={`${tx(language, '＋ Täze', '＋ Добавить')}: ${kindLabel(kind, language)}`} variant="ghost" disabled={disabled} onPress={() => onAddTerm(kind)} style={{ alignSelf: 'flex-start' }} />}
        {renderTermEditor?.(kind)}
      </View>;
    })}
  </>;
}

function CompactPhotoMetadataFields({ value, terms, language, onChange, onAddTerm, renderTermEditor, disabled = false, onPickerVisibilityChange }: PhotoMetadataProps) {
  const grouped = useMemo(() => {
    const result: Record<TermKind, SelectionOption[]> = { style: [], palette: [], material: [], detail: [] };
    for (const term of terms) result[term.kind].push(term);
    return result;
  }, [terms]);
  const rooms = useMemo(() => ROOMS.map(room => ({ id: room, labels: { ru: spaceLabel(room, 'ru'), tk: spaceLabel(room, 'tk') } })), []);
  const termField = (kind: TermKind) => {
    const field = kind === 'palette' ? 'paletteIds' : kind === 'material' ? 'materialIds' : 'detailIds';
    return <SelectionField key={kind} label={kindLabel(kind, language)} language={language} options={grouped[kind]} searchable allowClear multiple={kind !== 'style'} disabled={disabled}
      selectedIds={kind === 'style' ? value.styleId ? [value.styleId] : [] : value[field]}
      onChange={ids => onChange(kind === 'style' ? { ...value, styleId: ids[0] ?? '' } : { ...value, [field]: ids })}
      onCreate={onAddTerm ? () => onAddTerm(kind) : undefined} editor={renderTermEditor?.(kind)} onVisibilityChange={onPickerVisibilityChange} />;
  };
  return <>
    <View style={compact.section}>
      <Text accessibilityRole="header" style={compact.heading}>{tx(language, 'Otag we stil', 'Комната и стиль')}</Text>
      <SelectionField label={tx(language, 'Otag', 'Комната')} language={language} options={rooms} selectedIds={[value.room]} disabled={disabled}
        onChange={ids => { const room = ROOMS.find(room => room === ids[0]); if (room) onChange({ ...value, room }); }} onVisibilityChange={onPickerVisibilityChange} />
      {termField('style')}
    </View>
    <View style={[compact.section, compact.divided]}>
      <Text accessibilityRole="header" style={compact.heading}>{tx(language, 'Aýratynlyklar', 'Характеристики')}</Text>
      <Text style={typography.small}>{tx(language, 'Her meýdanda birnäçe wariant saýlap bilersiňiz.', 'В каждом поле можно выбрать несколько вариантов.')}</Text>
      {termField('palette')}{termField('material')}{termField('detail')}
    </View>
  </>;
}

const compact = StyleSheet.create({
  section: { gap: 14 }, heading: { ...typography.body, color: colors.ink, fontWeight: '600' },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 20 },
});
