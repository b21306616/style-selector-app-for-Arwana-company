import type { Language, Photo, PhotoAssignments, PhotoField, Term } from './types';

const assignmentKeys = {
  room: 'room', style: 'styleId', palette: 'paletteIds', material: 'materialIds', detail: 'detailIds',
} as const satisfies Record<PhotoField, keyof PhotoAssignments>;

/** Resolve the assignments actually supplied for this photo in one language. */
export function photoFieldsForLanguage(photo: Photo, language: Language): PhotoAssignments {
  const blanks = photo.blankTranslations;
  if (!blanks) return photo;
  return {
    room: blanks.room === language ? '' : photo.room,
    styleId: blanks.style === language ? '' : photo.styleId,
    paletteIds: blanks.palette === language ? [] : photo.paletteIds,
    materialIds: blanks.material === language ? [] : photo.materialIds,
    detailIds: blanks.detail === language ? [] : photo.detailIds,
  };
}

export function editPhotoField(photo: Photo, field: PhotoField, values: PhotoAssignments, language: Language): Photo {
  const key = assignmentKeys[field];
  const updated = { ...photo, [key]: values[key] };
  const missing = photo.blankTranslations?.[field];
  if (missing && (missing === language || !values[key].length)) {
    updated.blankTranslations = { ...photo.blankTranslations };
    delete updated.blankTranslations[field];
    if (!Object.keys(updated.blankTranslations).length) delete updated.blankTranslations;
  }
  return updated;
}

export function photoTermSearchText(photo: Photo, terms: ReadonlyMap<string, Term>, include: 'style' | 'all'): string {
  const names: string[] = [];
  for (const language of ['ru', 'tk'] as const) {
    const fields = photoFieldsForLanguage(photo, language);
    const ids = include === 'style' ? [fields.styleId] : [fields.styleId, ...fields.paletteIds, ...fields.materialIds, ...fields.detailIds];
    for (const id of ids) {
      const label = terms.get(id)?.labels[language];
      if (label) names.push(label);
    }
  }
  return names.join(' ');
}
