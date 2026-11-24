import { ROOMS, type Catalog, type Photo, type Term } from '../domain/types';
import { defaultRooms } from '../domain/rooms';

const styles = ['scandinavian', 'minimalist', 'modern_classic', 'industrial'] as const;

export const seedTerms: Term[] = [
  { id: 'scandinavian', kind: 'style', labels: { tk: 'Skandinaw', ru: 'Скандинавский' } },
  { id: 'minimalist', kind: 'style', labels: { tk: 'Minimalizm', ru: 'Минимализм' } },
  { id: 'modern_classic', kind: 'style', labels: { tk: 'Döwrebap nusgawy', ru: 'Современная классика' } },
  { id: 'industrial', kind: 'style', labels: { tk: 'Industrial', ru: 'Индустриальный' } },
  { id: 'warm_neutral', kind: 'palette', labels: { tk: 'Ýyly bitarap öwüşginler', ru: 'Тёплые нейтральные тона' } },
  { id: 'cool_neutral', kind: 'palette', labels: { tk: 'Sowuk bitarap öwüşginler', ru: 'Холодные нейтральные тона' } },
  { id: 'earthy', kind: 'palette', labels: { tk: 'Tebigy öwüşginler', ru: 'Природные оттенки' } },
  { id: 'oak', kind: 'material', labels: { tk: 'Tebigy dub', ru: 'Натуральный дуб' } },
  { id: 'stone', kind: 'material', labels: { tk: 'Daş', ru: 'Камень' } },
  { id: 'metal', kind: 'material', labels: { tk: 'Metal elementleri', ru: 'Металлические акценты' } },
  { id: 'clean_lines', kind: 'detail', labels: { tk: 'Ýönekeý çyzyklar', ru: 'Лаконичные линии' } },
  { id: 'soft_textiles', kind: 'detail', labels: { tk: 'Ýumşak matalar', ru: 'Мягкий текстиль' } },
  { id: 'statement_lighting', kind: 'detail', labels: { tk: 'Täsirli yşyklandyryş', ru: 'Выразительное освещение' } },
];

const photos: Photo[] = ROOMS.flatMap((room) => [1, 2, 3].flatMap((variant) => styles.map((style, styleIndex) => {
  const id = `${room}-${style}-${variant}`;
  return {
    id, room, styleId: style,
    paletteIds: [style === 'industrial' ? 'earthy' : style === 'minimalist' ? 'cool_neutral' : 'warm_neutral'],
    materialIds: [style === 'scandinavian' ? 'oak' : style === 'industrial' ? 'metal' : 'stone'],
    detailIds: [styleIndex < 2 ? 'clean_lines' : 'statement_lighting', ...((room === 'bedroom' || room === 'living_room') && style !== 'industrial' ? ['soft_textiles'] : [])],
    image: { kind: 'bundled' as const, key: id }, width: 1536, height: 1024, sample: true,
  };
})));

/** Stable, interleaved order makes the demo repeatable without duplicate photographs. */
export const seedCatalog: Catalog = {
  id: 'sample-v1', version: 1, createdAt: '2026-11-17T00:00:00.000Z', sample: true,
  terms: seedTerms,
  rooms: defaultRooms.map(room => ({ ...room, labels: { ...room.labels } })),
  photos,
  galleries: {
    bathroom: photos.filter((photo) => photo.room === 'bathroom').map((photo) => photo.id),
    bedroom: photos.filter((photo) => photo.room === 'bedroom').map((photo) => photo.id),
    living_room: photos.filter((photo) => photo.room === 'living_room').map((photo) => photo.id),
    kitchen: photos.filter((photo) => photo.room === 'kitchen').map((photo) => photo.id),
    whole_house: [1, 2].flatMap((variant) => styles.flatMap((style) => ROOMS.map((room) => `${room}-${style}-${variant}`))),
  },
};
