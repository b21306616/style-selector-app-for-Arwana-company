export type Language = 'ru' | 'tk';
export type Labels = Record<Language, string>;
export const ROOMS = ['bathroom', 'bedroom', 'living_room', 'kitchen'] as const;
/** Room IDs are catalog data; ROOMS is only the legacy/seed list. */
export type Room = string;
export type Space = Room | 'whole_house';
export const SPACES: Space[] = ['whole_house', ...ROOMS];
export interface RoomDefinition { id: Room; labels: Labels }
export type TermKind = 'style' | 'palette' | 'material' | 'detail';
export interface Term { id: string; kind: TermKind; labels: Labels }
export type ImageRef = { kind: 'bundled'; key: string } | { kind: 'local'; file: string; thumbnail: string };
export interface Photo {
  id: string;
  room: Room;
  styleId: string;
  paletteIds: string[];
  materialIds: string[];
  detailIds: string[];
  image: ImageRef;
  width: number;
  height: number;
  sample: boolean;
}
export interface Catalog {
  id: string;
  version: number;
  createdAt: string;
  rooms: RoomDefinition[];
  terms: Term[];
  photos: Photo[];
  galleries: Record<Space, string[]>;
  sample: boolean;
}
export type Choice = 'like' | 'dislike';
export interface Rating { photoId: string; choice: Choice }
export interface Session {
  id: string;
  catalog: Catalog;
  space: Space;
  ratings: Rating[];
  status: 'active' | 'complete';
  createdAt: string;
}
export interface StyleScore { styleId: string; likes: number; reviewed: number; score: number }
export interface FeatureScore { termId: string; count: number }
export interface StyleSummary {
  kind: 'inconclusive' | 'single' | 'blend' | 'varied';
  styles: StyleScore[];
  features: Record<'palette' | 'material' | 'detail', FeatureScore[]>;
  likedIds: string[];
  reviewed: number;
}
