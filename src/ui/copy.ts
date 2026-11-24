import type { Language, RoomDefinition, Space } from '../domain/types';
import { messageForError } from '../domain/errors';

export function tx(language: Language, turkmen: string, russian: string) { return language === 'ru' ? russian : turkmen; }
export function spaceLabel(space: Space, language: Language, rooms: readonly RoomDefinition[]) {
  if (space === 'whole_house') return tx(language, 'Bütin jaý', 'Весь дом');
  return rooms.find(room => room.id === space)?.labels[language] ?? tx(language, 'Saýlanmady', 'Не выбрано');
}
export function photoCount(count: number, language: Language) { return language === 'ru' ? `${count} фото` : `${count} surat`; }
export function errorText(error: unknown, language: Language) {
  return messageForError(error, language);
}
