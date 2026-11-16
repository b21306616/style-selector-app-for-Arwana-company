export type Language = 'en' | 'ru';

export const translations = {
  en: {
    title: 'Arwana Style Selector',
    subtitle: 'Choose a space to discover your interior style',
    spaces: {
      whole_house: 'Whole House (100 photos)',
      bathroom: 'Bathroom (50 photos)',
      bedroom: 'Bedroom (50 photos)',
      living_room: 'Living Room (50 photos)',
      kitchen: 'Kitchen (50 photos)',
    },
    styles: {
      scandinavian: 'Scandinavian',
      minimalist: 'Minimalist',
      modern_classic: 'Modern Classic',
      industrial: 'Industrial',
    },
    tags: {
      pale_oak_vanities: 'pale oak vanities',
      warm_neutral_tiles: 'warm neutral tiles',
      simple_fittings: 'simple fittings',
    },
    resultTemplate: (style: string, room: string, m: string, p: string, d: string) =>
      `You lean toward ${style} ${room}. You often chose ${m}, ${p} and ${d}.`,
  },
  ru: {
    title: 'Arwana Style Selector',
    subtitle: 'Выберите пространство, чтобы определить ваш стиль интерьера',
    spaces: {
      whole_house: 'Весь дом (100 фото)',
      bathroom: 'Ванная (50 фото)',
      bedroom: 'Спальня (50 фото)',
      living_room: 'Гостиная (50 фото)',
      kitchen: 'Кухня (50 фото)',
    },
    styles: {
      scandinavian: 'скандинавский стиль',
      minimalist: 'минимализм',
      modern_classic: 'современная классика',
      industrial: 'лофт / индастриал',
    },
    tags: {
      pale_oak_vanities: 'тумбы из светлого дуба',
      warm_neutral_tiles: 'плитку тёплых нейтральных тонов',
      simple_fittings: 'лаконичные смесители',
    },
    resultTemplate: (style: string, _room: string, m: string, p: string, d: string) =>
      `Вам близок ${style}. Вы часто выбирали ${m}, ${p} и ${d}.`,
  },
};