import type { FeatureScore, Session, StyleScore, StyleSummary } from './types';

/** Describes reviewed choices, never unviewed photos or statistical confidence. */
export function summarizeSession(session: Session): StyleSummary {
  const photos = new Map(session.catalog.photos.map((photo) => [photo.id, photo]));
  const seen = new Set<string>();
  const styles = new Map<string, StyleScore>();
  const counts = { palette: new Map<string, number>(), material: new Map<string, number>(), detail: new Map<string, number>() };
  const likedIds: string[] = [];

  for (const rating of session.ratings) {
    const photo = photos.get(rating.photoId);
    if (!photo || seen.has(photo.id)) continue;
    seen.add(photo.id);
    const score = styles.get(photo.styleId) ?? { styleId: photo.styleId, likes: 0, reviewed: 0, score: 0 };
    score.reviewed += 1;
    if (rating.choice === 'like') {
      score.likes += 1;
      likedIds.push(photo.id);
      for (const [category, tags] of [
        ['palette', photo.paletteIds], ['material', photo.materialIds], ['detail', photo.detailIds],
      ] as const) {
        for (const id of new Set(tags)) counts[category].set(id, (counts[category].get(id) ?? 0) + 1);
      }
    }
    score.score = score.likes / score.reviewed;
    styles.set(photo.styleId, score);
  }

  const qualified = likedIds.length < 3 ? [] : [...styles.values()]
    .filter((style) => style.likes >= 2)
    .sort((a, b) => b.score - a.score || b.likes - a.likes || a.styleId.localeCompare(b.styleId));
  const leading = qualified.filter((style) => style.score >= (qualified[0]?.score ?? 0) * 0.85);
  const threshold = Math.max(2, Math.ceil(likedIds.length * 0.3));
  const features = Object.fromEntries(Object.entries(counts).map(([kind, values]) => [kind,
    [...values.entries()].filter(([, count]) => count >= threshold)
      .map(([termId, count]) => ({ termId, count }))
      .sort((a, b) => b.count - a.count || a.termId.localeCompare(b.termId)).slice(0, 2),
  ])) as Record<'palette' | 'material' | 'detail', FeatureScore[]>;

  return {
    kind: leading.length === 0 ? 'inconclusive' : leading.length === 1 ? 'single' : leading.length === 2 ? 'blend' : 'varied',
    styles: leading,
    features,
    likedIds,
    reviewed: seen.size,
  };
}
