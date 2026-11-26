export type Language = 'ru' | 'tk';
export type Labels = Record<Language, string>;
export const ROOMS = ['bathroom', 'bedroom', 'living_room', 'kitchen'] as const;
/** Room IDs are catalog data; ROOMS is only the legacy/seed list. */
export type Room = string;
export interface RoomDefinition { id: Room; labels: Labels }
export type TermKind = 'style' | 'palette' | 'material' | 'detail';
export type PhotoField = 'room' | TermKind;
export interface Term { id: string; kind: TermKind; labels: Labels }
export type ImageRef = { kind: 'bundled'; key: string } | { kind: 'local'; file: string; thumbnail: string };
export interface Photo {
  id: string;
  /** Stable JPEG filename used by Excel and photo archives; never an image path. */
  exportFilename?: string;
  /** Original imported filename when it differs from the JPEG export name. */
  sourceFilename?: string;
  room: Room;
  styleId: string;
  paletteIds: string[];
  materialIds: string[];
  detailIds: string[];
  /** A shared room or term may have a translation that was blank on this photo. */
  blankTranslations?: Partial<Record<PhotoField, Language>>;
  image: ImageRef;
  width: number;
  height: number;
  sample: boolean;
}
export type PhotoAssignments = Pick<Photo, 'room' | 'styleId' | 'paletteIds' | 'materialIds' | 'detailIds'>;
export interface Catalog {
  id: string;
  /** Next generated photo filename number; retained when photos are deleted. */
  nextPhotoNumber?: number;
  version: number;
  createdAt: string;
  rooms: RoomDefinition[];
  terms: Term[];
  photos: Photo[];
  galleries: Record<Room, string[]>;
  sample: boolean;
}
export type Choice = 'like' | 'dislike';
export interface Rating { photoId: string; choice: Choice }
export interface Session {
  id: string;
  catalog: Catalog;
  space: Room;
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
