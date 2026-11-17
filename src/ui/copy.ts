import type { Language, Space } from '../domain/types';
import { messageForError } from '../domain/errors';

export function tx(language: Language, english: string, russian: string) { return language === 'ru' ? russian : english; }
const spaces: Record<Space, { en: string; ru: string }> = {
  whole_house: { en: 'Whole house', ru: 'Весь дом' },
  bathroom: { en: 'Bathroom', ru: 'Ванная' },
  bedroom: { en: 'Bedroom', ru: 'Спальня' },
  living_room: { en: 'Living room', ru: 'Гостиная' },
  kitchen: { en: 'Kitchen', ru: 'Кухня' },
};
export function spaceLabel(space: Space, language: Language) { return spaces[space][language]; }
export function photoCount(count: number, language: Language) { return language === 'ru' ? `${count} фото` : `${count} photos`; }
export function errorText(error: unknown, language: Language) {
  return messageForError(error, language);
}
