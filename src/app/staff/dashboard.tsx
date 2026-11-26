import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, ErrorBanner, Header, Screen, tx, typography, photoRoomLabel, spaceLabel, useLayout } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PhotoTile } from '../../components/PhotoTile';
import { PhotoImage } from '../../components/PhotoImage';
import { AppModal } from '../../components/AppModal';
import { IconButton } from '../../components/Icon';
import { useApp } from '../../state/AppProvider';
import { DashboardWorkbench } from '../../features/staff/DashboardWorkbench';
import { useStaffWorkspace } from '../../features/staff/workspace-context';
import { staffStyles as s } from '../../features/staff/shared';
import { Space, type Photo } from '../../domain/types';
import { catalogSpaces } from '../../domain/rooms';
import { photoFieldsForLanguage } from '../../domain/photo-metadata';
import { messageForError } from '../../domain/errors';

export default function StaffDashboard() {
  const { draft, catalog, language, busy, resetDraft } = useApp();
  const workspace = useStaffWorkspace();
  const { contentWidth, columns, fontScale } = useLayout();
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryModal, setGalleryModal] = useState<{ space: Space; mode: 'published' | 'draft' } | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const t = (tk: string, ru: string) => tx(language, tk, ru);

  const activeSource = galleryModal?.mode === 'published' ? catalog : draft;
  const activePhotos = useMemo(() => {
    if (!galleryModal || !activeSource) return [];
    const map = new Map(activeSource.photos.map(p => [p.id, p]));
    return (activeSource.galleries[galleryModal.space] ?? [])
      .map(id => map.get(id))
      .filter((photo): photo is Photo => !!photo);
  }, [galleryModal, activeSource]);

  const termsMap = useMemo(() => {
    return new Map(activeSource?.terms.map(term => [term.id, term.labels[language]]) ?? []);
  }, [activeSource, language]);

  if (!draft || !catalog) return null;

  function photoCaption(photo: Photo) {
    const room = photoRoomLabel(photo, language, activeSource?.rooms ?? []);
    const style = termsMap.get(photoFieldsForLanguage(photo, language).styleId);
    return { room, style, title: style ? `${room} · ${style}` : room };
  }
  const viewingTitle = viewingPhoto ? photoCaption(viewingPhoto).title : '';
  const overviewRooms = [...draft.rooms, ...catalog.rooms.filter(room => !draft.rooms.some(item => item.id === room.id))];
  const overviewSpaces = catalogSpaces({ rooms: overviewRooms });
  const links = [
    { route: '/staff/photos' as const, title: t('Suratlar', 'Фотографии'), count: String(draft.photos.length) },
    { route: '/staff/galleries' as const, title: t('Toplumlar', 'Подборки'), count: String(catalogSpaces(draft).length) },
    { route: '/staff/vocabulary' as const, title: t('Stiller we aýratynlyklar', 'Стили и особенности'), count: String(draft.terms.length) },
  ];

  return <Screen>
    <Header right={<Button title={t('Çykmak', 'Выйти')} variant="ghost" onPress={() => router.replace('/')} disabled={workspace.busy} />} />
    <View style={{ gap: 6 }}><Text accessibilityRole="header" style={typography.heading}>{t('Işgär otagy', 'Кабинет сотрудника')}</Text><Text style={typography.small}>{t('Garalamany redaktirlemek', 'Редактирование черновика')}</Text></View>
    {error && <ErrorBanner message={error} />}
    <DashboardWorkbench />
    <Text accessibilityRole="header" style={typography.subheading}>{t('Katalogy dolandyrmak', 'Управление каталогом')}</Text>
    <View style={[s.row, { alignItems: 'stretch', gap: 12 }]}>{links.map(link => <Button key={link.route} title={`${link.title} · ${link.count}`} variant="secondary" onPress={() => router.push(link.route)} disabled={workspace.busy} style={{ flexGrow: 1, flexBasis: 200 }} />)}</View>
    <Button title={t('Barlamak we çap etmek', 'Проверить и опубликовать')} onPress={() => router.push('/staff/preview')} disabled={workspace.busy} />
    <Text accessibilityRole="header" style={typography.subheading}>{t('Toplumlara umumy syn', 'Обзор подборок')}</Text>
    <View style={styles.overviewCard}>
      {overviewSpaces.map((space, index) => {
        const publishedCount = catalog.galleries[space]?.length ?? 0;
        const draftCount = draft.galleries[space]?.length ?? 0;
        const isLast = index === overviewSpaces.length - 1;
        return <View key={space} style={[styles.spaceRow, (contentWidth < 390 || fontScale >= 1.5) && { flexDirection: 'column', alignItems: 'flex-start' }, !isLast && styles.spaceRowDivider]}>
          <Text style={styles.spaceTitle}>{spaceLabel(space, language, overviewRooms)}</Text>
          <View style={styles.spaceActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${spaceLabel(space, language, overviewRooms)}, ${t('Çap edilen', 'Опубликовано')}: ${publishedCount}`}
              onPress={() => setGalleryModal({ space, mode: 'published' })}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
            >
              <Text style={styles.summaryLabel}>
                {t('Çap edilen', 'Опубликовано')}: <Text style={styles.summaryCount}>{publishedCount}</Text>
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${spaceLabel(space, language, overviewRooms)}, ${t('Garalama', 'Черновик')}: ${draftCount}`}
              onPress={() => setGalleryModal({ space, mode: 'draft' })}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
            >
              <Text style={styles.summaryLabel}>
                {t('Garalama', 'Черновик')}: <Text style={styles.summaryCount}>{draftCount}</Text>
              </Text>
            </Pressable>
          </View>
        </View>;
      })}
    </View>
    <Button title={t('Garalamanyň üýtgeşmelerini ýatyrmak', 'Отменить изменения черновика')} variant="ghost" onPress={() => setReset(true)} disabled={busy || workspace.busy} />
    <ConfirmDialog visible={reset} language={language} title={t('Bu garalamany ýatyrmak isleýärsiňizmi?', 'Отменить этот черновик?')} description={t('Çap edilen katalogy dikeltmek. Çap edilmedik suratlar we üýtgeşmeler garalamadan aýrylar.', 'Вернуть опубликованный каталог. Неопубликованные фотографии и изменения будут удалены из черновика.')} confirmLabel={t('Üýtgeşmeleri ýatyrmak', 'Отменить изменения')} cancelLabel={t('Redaktirlemegi dowam etmek', 'Продолжить редактирование')} loading={busy} onCancel={() => setReset(false)} onConfirm={() => { void resetDraft().then(() => setReset(false)).catch(e => { setError(messageForError(e, language)); setReset(false); }); }} />

    <AppModal
      visible={!!galleryModal}
      animationType="slide"
      onRequestClose={() => { setViewingPhoto(null); setGalleryModal(null); }}
    >
      {galleryModal && <Screen scroll={false}>
        <Header
          title={spaceLabel(galleryModal.space, language, [...(activeSource?.rooms ?? []), ...overviewRooms])}
          subtitle={`${galleryModal.mode === 'published' ? t('Çap edilen', 'Опубликовано') : t('Garalama', 'Черновик')} · ${activePhotos.length}`}
          right={<IconButton icon="close" label={t('Ýapmak', 'Закрыть')} fallbackLabel={t('Ýapmak', 'Закрыть')} onPress={() => { setViewingPhoto(null); setGalleryModal(null); }} />}
        />
        <FlatList
          data={activePhotos}
          key={columns}
          numColumns={columns}
          keyExtractor={photo => photo.id}
          columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          renderItem={({ item, index }) => {
            const caption = photoCaption(item);
            return <View style={{ width: (contentWidth - (columns - 1) * 12) / columns }}>
              <PhotoTile
                photo={item}
                language={language}
                title={caption.room}
                subtitle={caption.style || t('Tegler ýok', 'Без тегов')}
                badge={String(index + 1)}
                label={`${caption.room}, ${caption.style ?? ''}, ${index + 1}`}
                onPress={() => setViewingPhoto(item)}
              />
            </View>;
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[typography.body, { textAlign: 'center' }]}>
                {t('Bu toplumda suratlar ýok.', 'В этой подборке нет фотографий.')}
              </Text>
            </View>
          }
        />
      </Screen>}
    </AppModal>

    <AppModal visible={viewingPhoto !== null} animationType="fade" onRequestClose={() => setViewingPhoto(null)}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerTitle}>
            {viewingTitle}
          </Text>
          <IconButton
            label={tx(language, 'Ýapmak', 'Закрыть')}
            icon="close"
            fallbackLabel={tx(language, 'Ýapmak', 'Закрыть')}
            onPress={() => setViewingPhoto(null)}
          />
        </View>
        {viewingPhoto && (
          <PhotoImage
            key={viewingPhoto.id}
            photo={viewingPhoto}
            language={language}
            fit="contain"
            style={styles.fullImage}
            label={viewingTitle}
          />
        )}
      </SafeAreaView>
    </AppModal>
  </Screen>;
}

const styles = StyleSheet.create({
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  spaceRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  spaceTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.ink,
    flexShrink: 1,
  },
  spaceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  textAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  summaryCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.green,
  },
  pressed: {
    opacity: 0.6,
  },
  emptyContainer: {
    padding: 24,
    backgroundColor: colors.sand,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  viewer: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 12,
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewerTitle: {
    ...typography.subheading,
    flex: 1,
    color: colors.ink,
  },
  fullImage: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
  },
});
