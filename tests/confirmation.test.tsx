import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ConfirmDialog } from '../src/components/ConfirmDialog';

test('a pending destructive action cannot be dismissed through the button or native back action', async () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const props = { visible: true, title: 'Remove photo?', description: 'Remove it from this draft.', confirmLabel: 'Remove', cancelLabel: 'Cancel', language: 'tk' as const, onCancel, onConfirm };
  const view = await render(<ConfirmDialog {...props} loading />);
  expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await fireEvent(screen.getByTestId('confirmation-dialog'), 'requestClose');
  expect(onCancel).not.toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();

  await view.rerender(<ConfirmDialog {...props} />);
  await fireEvent(screen.getByTestId('confirmation-dialog'), 'requestClose');
  expect(onCancel).toHaveBeenCalledTimes(1);
});
