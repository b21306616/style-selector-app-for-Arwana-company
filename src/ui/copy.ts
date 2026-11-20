import type { Language, Space } from '../domain/types';
import { messageForError } from '../domain/errors';

export function tx(language: Language, turkmen: string, russian: string) { return language === 'ru' ? russian : turkmen; }
const spaces: Record<Space, { tk: string; ru: string }> = {
  whole_house: { tk: 'Bütin jaý', ru: 'Весь дом' },
  bathroom: { tk: 'Wanna otagy', ru: 'Ванная' },
  bedroom: { tk: 'Ýatylýan otag', ru: 'Спальня' },
  living_room: { tk: 'Myhman otagy', ru: 'Гостиная' },
  kitchen: { tk: 'Aşhana', ru: 'Кухня' },
};
export function spaceLabel(space: Space, language: Language) { return spaces[space][language]; }
export function photoCount(count: number, language: Language) { return language === 'ru' ? `${count} фото` : `${count} surat`; }
export function errorText(error: unknown, language: Language) {
  return messageForError(error, language);
}
