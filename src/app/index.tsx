import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Language, translations } from '../../data/i18n';

type SpaceKey = 'whole_house' | 'bathroom' | 'bedroom' | 'living_room' | 'kitchen';

const SPACES: SpaceKey[] = [
  'whole_house',
  'bathroom',
  'bedroom',
  'living_room',
  'kitchen',
];

export default function HomeScreen() {
  const [lang, setLang] = useState<Language>('ru');
  const router = useRouter();
  const t = translations[lang];

  const handleSelectSpace = (space: SpaceKey) => {
    router.push({ pathname: '/gallery', params: { space, lang } });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Language Switcher (EN / RU) */}
      <View style={styles.langRow}>
        {(['ru', 'en'] as Language[]).map((l) => (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            style={[styles.langBtn, lang === l && styles.langBtnActive]}
          >
            <Text style={[styles.langText, lang === l && styles.langTextActive]}>
              {l.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
      </View>

      {/* Space Selection Buttons */}
      <View style={styles.grid}>
        {SPACES.map((space) => (
          <Pressable
            key={space}
            style={[
              styles.card,
              space === 'whole_house' && styles.wholeHouseCard,
            ]}
            onPress={() => handleSelectSpace(space)}
          >
            <Text
              style={[
                styles.cardTitle,
                space === 'whole_house' && styles.wholeHouseText,
              ]}
            >
              {t.spaces[space]}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F0', padding: 24 },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  langBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#E6E2D8' },
  langBtnActive: { backgroundColor: '#2C2A29' },
  langText: { fontSize: 13, fontWeight: '600', color: '#2C2A29' },
  langTextActive: { color: '#FFFFFF' },
  header: { marginVertical: 32 },
  title: { fontSize: 30, fontWeight: '700', color: '#1E1D1C', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6E6A64' },
  grid: { gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E2D8',
  },
  wholeHouseCard: { backgroundColor: '#2C2A29', borderColor: '#2C2A29' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1E1D1C' },
  wholeHouseText: { color: '#FFFFFF' },
});
