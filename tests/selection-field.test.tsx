import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SelectionField, type SelectionOption } from '../src/features/staff/SelectionField';

const options: SelectionOption[] = [
  { id: 'oak', labels: { ru: 'Дуб', tk: 'Dub' } },
  { id: 'stone', labels: { ru: 'Камень', tk: 'Daş' } },
];

function Field({ items = options, multiple = false, create }: { items?: SelectionOption[]; multiple?: boolean; create?: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  return <SelectionField label="Материалы" language="ru" options={items} selectedIds={ids} onChange={setIds} multiple={multiple} searchable allowClear onCreate={create} />;
}

test('single choice closes the sheet, replaces the old choice, and can be cleared', async () => {
  await render(<Field />);
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Дуб' }));
  expect(screen.queryByTestId('selection-sheet')).toBeNull();
  expect(screen.getByRole('button', { name: 'Материалы' })).toHaveAccessibilityValue({ text: 'Дуб' });
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Камень' }));
  expect(screen.getByRole('button', { name: 'Материалы' })).toHaveAccessibilityValue({ text: 'Камень' });
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  expect(screen.getByRole('radio', { name: 'Дуб' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Сбросить выбор' }));
  expect(screen.getByRole('radio', { name: 'Камень' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Закрыть' }));
  expect(screen.getByRole('button', { name: 'Материалы' })).toHaveAccessibilityValue({ text: 'Не выбрано' });
});

test('empty and unmatched vocabulary lists still offer term creation', async () => {
  const create = jest.fn();
  const view = await render(<Field items={[]} multiple create={create} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  expect(screen.getByText('В этой категории пока нет терминов.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '＋ Добавить: Материалы' }));
  expect(create).toHaveBeenCalledTimes(1);
  await view.rerender(<Field multiple create={create} />);
  await fireEvent.changeText(screen.getByLabelText('Поиск: Материалы'), 'missing');
  expect(screen.getByText('Ничего не найдено.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '＋ Добавить: Материалы' })).toBeEnabled();
});

test('a 5,000-term list renders a bounded window and searches terms outside it', async () => {
  const items = Array.from({ length: 5000 }, (_, index) => ({ id: `term-${index}`, labels: { ru: `Материал ${index}`, tk: `Material ${index}` } }));
  await render(<Field items={items} multiple />);
  await fireEvent.press(screen.getByRole('button', { name: 'Материалы' }));
  expect(screen.getAllByRole('checkbox').length).toBeLessThan(100);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Материал 0' }));
  await fireEvent.changeText(screen.getByLabelText('Поиск: Материалы'), 'Material 4999');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Материал 4999' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Готово' }));
  expect(screen.getByRole('button', { name: 'Материалы' })).toHaveAccessibilityValue({ text: 'Материал 0, Материал 4999' });
});
