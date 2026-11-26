import type { Labels, Language, Photo, Room, RoomDefinition, Session } from '../domain/types';
import { LEGACY_HOUSE_ID } from '../domain/rooms';
import { photoFieldsForLanguage } from '../domain/photo-metadata';
import { messageForError } from '../domain/errors';

export function tx(language: Language, turkmen: string, russian: string) { return language === 'ru' ? russian : turkmen; }
/** A vocabulary option can be identified by its available name in either language. */
export function optionLabel(labels: Labels, language: Language) { return labels[language] || labels[language === 'ru' ? 'tk' : 'ru']; }
export function spaceLabel(space: Room, language: Language, rooms: readonly RoomDefinition[]) {
  const room = rooms.find(item => item.id === space);
  return room ? optionLabel(room.labels, language) : tx(language, 'Saýlanmady', 'Не выбрано');
}
export function sessionLabel(session: Session, language: Language) {
  if (session.space === LEGACY_HOUSE_ID) return tx(language, 'Bütin jaý', 'Весь дом');
  return spaceLabel(session.space, language, session.catalog.rooms);
}
export function photoRoomLabel(photo: Photo, language: Language, rooms: readonly RoomDefinition[]) {
  const { room } = photoFieldsForLanguage(photo, language);
  return rooms.find(item => item.id === room)?.labels[language] || tx(language, 'Saýlanmady', 'Не выбрано');
}
export function photoCount(count: number, language: Language) { return language === 'ru' ? `${count} фото` : `${count} surat`; }
export function errorText(error: unknown, language: Language) {
  return messageForError(error, language);
}
