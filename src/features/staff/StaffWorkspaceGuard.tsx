import { useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { tx } from '../../components/ui';
import { useApp } from '../../state/AppProvider';
import { useStaffWorkspace } from './workspace-context';

export function StaffWorkspaceGuard() {
  const workspace = useStaffWorkspace();
  const { language } = useApp();
  const [leave, setLeave] = useState<(() => void) | null>(null);
  usePreventRemove(workspace.busy || workspace.dirty || !!workspace.book, ({ repeat }) => {
    if (!workspace.busy) setLeave(() => repeat);
  });
  return <ConfirmDialog visible={!!leave} language={language} loading={workspace.busy}
    title={tx(language, 'Ýatda saklanmadyk maglumatlary ýatyrmalymy?', 'Отменить несохранённые данные?')}
    description={tx(language, 'Forma we import syny ýatyrylar. Ýatda saklanan garalama galar.', 'Введённые в форму данные и подготовленный импорт будут отменены. Сохранённый черновик останется.')}
    confirmLabel={tx(language, 'Ýatyrmak we çykmak', 'Отменить и выйти')} cancelLabel={tx(language, 'Dowam etmek', 'Продолжить работу')}
    onCancel={() => setLeave(null)} onConfirm={() => { workspace.discardForm(); workspace.discardImport(); const repeat = leave; setLeave(null); repeat?.(); }} />;
}
