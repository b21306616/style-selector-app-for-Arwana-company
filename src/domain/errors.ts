import type { Language } from './types';

export class AppError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) {
    super(code);
    this.name = 'AppError';
  }
}

const messages: Record<string, Record<Language, string>> = {
  BUSY: { tk: 'Üýtgeşme entek ýatda saklanylýar. Birazdan gaýtadan synanyşyň.', ru: 'Изменение ещё сохраняется. Повторите попытку через мгновение.' },
  EMPTY_GALLERY: { tk: 'Bu toplumda entek surat ýok. Başga otagy saýlaň.', ru: 'В этой галерее пока нет фотографий. Выберите другое пространство.' },
  NO_SESSION: { tk: 'Ilki saýlamagy başlaň.', ru: 'Сначала начните подборку.' },
  SESSION_COMPLETE: { tk: 'Ähli suratlar eýýäm bahalandyryldy.', ru: 'Все фотографии уже оценены.' },
  STALE_RATING: { tk: 'Bu saýlaw eýýäm ýazga geçirildi.', ru: 'Этот выбор уже сохранён.' },
  INVALID_CATALOG: { tk: 'Katalogy çap etmezden ozal ýalňyşlyklary düzediň.', ru: 'Перед публикацией исправьте ошибки в каталоге.' },
  MISSING_IMAGE: { tk: 'Surat tapylmady. Çap etmezden ozal ony redaktorda çalyşyň.', ru: 'Не найдено изображение. Замените его в редакторе перед публикацией.' },
  IMAGE_MISSING: { tk: 'Surat tapylmady. Çap etmezden ozal ony redaktorda çalyşyň.', ru: 'Не найдено изображение. Замените его в редакторе перед публикацией.' },
  IMPORT_BUSY: { tk: 'Suratlar eýýäm goşulýar. Tamamlanmagyna garaşyň.', ru: 'Фотографии уже импортируются. Дождитесь завершения.' },
  IMPORT_LIMIT: { tk: 'Bir gezekde 20-den köp bolmadyk surat goşuň.', ru: 'Импортируйте не более 20 фотографий за один раз.' },
  IMAGE_TOO_LARGE: { tk: 'Surat gaty uly. Kiçeldilen nusgasyny saýlaň.', ru: 'Изображение слишком большое. Выберите уменьшенную копию.' },
  STORAGE_FULL: { tk: 'Suratlar üçin ýeterlik ýat ýok. Enjamyň ýadyny boşadyň we gaýtadan synanyşyň.', ru: 'Недостаточно места для фотографий. Освободите память устройства и повторите попытку.' },
  IMPORT_FAILED: { tk: 'Suraty goşup bolmady. Asyl nusganyň enjamda elýeterlidigine göz ýetiriň we gaýtadan synanyşyň.', ru: 'Не удалось импортировать фото. Убедитесь, что оригинал доступен на устройстве, и повторите попытку.' },
  UNSUPPORTED_DATABASE: { tk: 'Maglumatlar programmanyň has täze wersiýasynda döredilipdir. Programmany täzeläň.', ru: 'Данные созданы новой версией приложения. Обновите приложение.' },
  CATALOG_DAMAGED: { tk: 'Katalogy açyp bolmady. Maglumatlar saklandy. Gaýtadan synanyşyň ýa-da administratora ýüz tutuň.', ru: 'Не удалось открыть каталог. Данные сохранены. Повторите попытку или обратитесь к администратору.' },
  DRAFT_DAMAGED: { tk: 'Zeper ýeten garalama dikeltmek üçin saklandy. Çap edilen katalogdan täze garalama döredildi.', ru: 'Повреждённый черновик сохранён для восстановления. Создан черновик из опубликованного каталога.' },
  SESSION_DAMAGED: { tk: 'Bökdelän saýlawy dikeldip bolmady. Ätiýaçlyk nusga saklandy; täze saýlawy başlap bilersiňiz.', ru: 'Не удалось восстановить прерванную подборку. Резервная копия сохранена; можно начать новую.' },
  STORAGE_ERROR: { tk: 'Maglumatlary bu enjamda ýatda saklap bolmady. Boş ýeri barlap, gaýtadan synanyşyň. Soňky saýlawyňyz ýitmedi.', ru: 'Не удалось сохранить данные. Проверьте свободное место и повторите попытку. Последний сохранённый выбор не потерян.' },
  REFERENCED_TERM: { tk: 'Termini öçürmezden ozal, baglanyşykly suratlarda ony çalyşyň.', ru: 'Прежде чем удалить термин, замените его у связанных фотографий.' },
};

export function messageForError(error: unknown, language: Language): string {
  const code = errorCode(error);
  return (messages[code] ?? messages.STORAGE_ERROR)[language];
}

export function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  const candidate = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  return Object.hasOwn(messages, candidate) ? candidate : 'STORAGE_ERROR';
}
