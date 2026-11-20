import { PropsWithChildren, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorBanner, Header, Screen, TextField, colors, typography, tx, uiStyles } from '../../components/ui';
import { useApp } from '../../state/AppProvider';
import { useStaffAuth } from './auth-context';

function authMessage(error: unknown, ru: boolean) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, [string, string]> = {
    PIN_FORMAT: ['Use exactly six digits.', 'Введите ровно шесть цифр.'],
    PIN_INVALID: ['The PIN or recovery code is incorrect.', 'Неверный PIN или код восстановления.'],
    PIN_COOLDOWN: ['Too many attempts. Wait 30 seconds and try again.', 'Слишком много попыток. Подождите 30 секунд.'],
    PIN_MISMATCH: ['The PINs do not match.', 'PIN-коды не совпадают.'],
  };
  return (messages[code] ?? ['Could not access secure storage. Please retry.', 'Не удалось открыть защищённое хранилище. Повторите попытку.'])[ru ? 1 : 0];
}

export function StaffGate({ children }: PropsWithChildren) {
  const auth = useStaffAuth();
  const { language } = useApp();
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ru: string) => tx(language, en, ru);

  if (auth.unlocked) return children;
  const setup = auth.configured === false;
  async function submit() {
    setError(null);
    try {
      if (setup || recovering) {
        if (pin !== confirmation) throw new Error('PIN_MISMATCH');
        const nextCode = setup ? await auth.setup(pin) : await auth.recover(code, pin);
        setRecovery(nextCode); setCode(''); setRecovering(false);
      } else await auth.unlock(pin);
      setPin(''); setConfirmation('');
    } catch (failure) { setError(authMessage(failure, language === 'ru')); }
  }
  return <Screen>
    <Header back={{ label: t('Showroom', 'Шоурум'), onPress: () => router.replace('/') }} />
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16, paddingVertical: 12 }}>
      <Text style={typography.eyebrow}>{t('ARWANA • STAFF', 'ARWANA • СОТРУДНИКАМ')}</Text>
      <Text style={typography.heading}>{recovery ? t('Keep this code safe', 'Сохраните этот код') : setup ? t('Create staff PIN', 'Создайте PIN сотрудника') : recovering ? t('Recover access', 'Восстановление доступа') : t('Staff access', 'Вход для сотрудников')}</Text>
      {auth.error ? <ErrorBanner message={authMessage(auth.error, language === 'ru')} onRetry={() => void auth.refresh()} /> : auth.configured === null ? <ActivityIndicator color={colors.green} /> : recovery ? <>
        <Text style={typography.body}>{t('Write down this recovery code and keep it somewhere safe. It can reset your PIN without deleting your catalog. It will not be shown again.', 'Запишите код восстановления и сохраните его в надёжном месте. Он позволяет сменить PIN без удаления каталога. Повторно код не показывается.')}</Text>
        <View style={uiStyles.card}><Text selectable style={[typography.subheading, { letterSpacing: 2 }]}>{recovery}</Text></View>
        <Text style={typography.small}>{t('If both your PIN and this code are lost, there is no in-app recovery.', 'Если потерять и PIN, и этот код, восстановить доступ в приложении будет невозможно.')}</Text>
        <Button title={t('I saved the code — sign in', 'Код сохранён — войти')} onPress={() => setRecovery(null)} />
      </> : <>
        <Text style={typography.body}>{setup ? t('Create a six-digit staff PIN. Your photos and edits stay on this device; removing app data can remove the catalog.', 'Создайте шестизначный PIN сотрудника. Фотографии и изменения хранятся на этом устройстве; очистка данных приложения может удалить каталог.') : t('Enter your six-digit PIN.', 'Введите PIN из шести цифр.')}</Text>
        {recovering && <TextField label={t('Recovery code', 'Код восстановления')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />}
        <TextField label={setup || recovering ? t('New six-digit PIN', 'Новый PIN из шести цифр') : 'PIN'} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} autoComplete="off" />
        {(setup || recovering) && <TextField label={t('Confirm PIN', 'Повторите PIN')} value={confirmation} onChangeText={value => setConfirmation(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} autoComplete="off" />}
        {error && <ErrorBanner message={error} />}
        <Button title={setup ? t('Create staff PIN', 'Создать PIN') : recovering ? t('Reset PIN', 'Сменить PIN') : t('Unlock catalog', 'Открыть каталог')} onPress={() => void submit()} loading={auth.busy} disabled={pin.length !== 6 || ((setup || recovering) && confirmation.length !== 6)} />
        {!setup && <Button title={recovering ? t('Back to PIN', 'Вернуться к PIN') : t('Forgot PIN?', 'Забыли PIN?')} variant="ghost" onPress={() => { setRecovering(!recovering); setPin(''); setConfirmation(''); setError(null); }} />}
      </>}
    </View>
  </Screen>;
}
