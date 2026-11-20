import { PropsWithChildren, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorBanner, Header, Screen, TextField, colors, typography, tx, uiStyles } from '../../components/ui';
import { useApp } from '../../state/AppProvider';
import { useStaffAuth } from './auth-context';
import type { Language } from '../../domain/types';

function authMessage(error: unknown, language: Language) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, [string, string]> = {
    PIN_FORMAT: ['Doly alty sany sifr giriziň.', 'Введите ровно шесть цифр.'],
    PIN_INVALID: ['PIN ýa-da dikeldiş kody nädogry.', 'Неверный PIN или код восстановления.'],
    PIN_COOLDOWN: ['Synanyşyklar gaty köp. 30 sekunt garaşyp, gaýtadan synanyşyň.', 'Слишком много попыток. Подождите 30 секунд.'],
    PIN_MISMATCH: ['PIN kodlary gabat gelmeýär.', 'PIN-коды не совпадают.'],
  };
  return (messages[code] ?? ['Goragly ammary açyp bolmady. Gaýtadan synanyşyň.', 'Не удалось открыть защищённое хранилище. Повторите попытку.'])[language === 'ru' ? 1 : 0];
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
  const t = (tk: string, ru: string) => tx(language, tk, ru);

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
    } catch (failure) { setError(authMessage(failure, language)); }
  }
  return <Screen>
    <Header back={{ label: t('Şourum', 'Шоурум'), onPress: () => router.replace('/') }} />
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16, paddingVertical: 12 }}>
      <Text style={typography.eyebrow}>{t('ARWANA • IŞGÄRLER', 'ARWANA • СОТРУДНИКАМ')}</Text>
      <Text style={typography.heading}>{recovery ? t('Bu kody ygtybarly saklaň', 'Сохраните этот код') : setup ? t('Işgär PIN koduny dörediň', 'Создайте PIN сотрудника') : recovering ? t('Girişi dikeltmek', 'Восстановление доступа') : t('Işgärler üçin giriş', 'Вход для сотрудников')}</Text>
      {auth.error ? <ErrorBanner message={authMessage(auth.error, language)} onRetry={() => void auth.refresh()} /> : auth.configured === null ? <ActivityIndicator color={colors.green} /> : recovery ? <>
        <Text style={typography.body}>{t('Dikeldiş koduny belläp alyň we ygtybarly ýerde saklaň. Ol katalogy öçürmezden PIN kody täzelemäge mümkinçilik berýär. Bu kod gaýtadan görkezilmeýär.', 'Запишите код восстановления и сохраните его в надёжном месте. Он позволяет сменить PIN без удаления каталога. Повторно код не показывается.')}</Text>
        <View style={uiStyles.card}><Text selectable style={[typography.subheading, { letterSpacing: 2 }]}>{recovery}</Text></View>
        <Text style={typography.small}>{t('Eger PIN we bu kod ikisi hem ýitirilse, programmada girişi dikeldip bolmaýar.', 'Если потерять и PIN, и этот код, восстановить доступ в приложении будет невозможно.')}</Text>
        <Button title={t('Kody ýatda sakladym — girmek', 'Код сохранён — войти')} onPress={() => setRecovery(null)} />
      </> : <>
        <Text style={typography.body}>{setup ? t('Işgär üçin alty belgili PIN dörediň. Suratlaryňyz we üýtgeşmeler bu enjamda saklanýar; programma maglumatlaryny arassalamak katalogy öçürip biler.', 'Создайте шестизначный PIN сотрудника. Фотографии и изменения хранятся на этом устройстве; очистка данных приложения может удалить каталог.') : t('Alty belgili PIN kody giriziň.', 'Введите PIN из шести цифр.')}</Text>
        {recovering && <TextField label={t('Dikeldiş kody', 'Код восстановления')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />}
        <TextField label={setup || recovering ? t('Täze alty belgili PIN', 'Новый PIN из шести цифр') : 'PIN'} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} autoComplete="off" />
        {(setup || recovering) && <TextField label={t('PIN kody gaýtalaň', 'Повторите PIN')} value={confirmation} onChangeText={value => setConfirmation(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} autoComplete="off" />}
        {error && <ErrorBanner message={error} />}
        <Button title={setup ? t('PIN döretmek', 'Создать PIN') : recovering ? t('PIN kody çalşyrmak', 'Сменить PIN') : t('Katalogy açmak', 'Открыть каталог')} onPress={() => void submit()} loading={auth.busy} disabled={pin.length !== 6 || ((setup || recovering) && confirmation.length !== 6)} />
        {!setup && <Button title={recovering ? t('PIN koda dolanmak', 'Вернуться к PIN') : t('PIN ýatdan çykdymy?', 'Забыли PIN?')} variant="ghost" onPress={() => { setRecovering(!recovering); setPin(''); setConfirmation(''); setError(null); }} />}
      </>}
    </View>
  </Screen>;
}
