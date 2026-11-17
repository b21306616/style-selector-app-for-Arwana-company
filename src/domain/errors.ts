import type { Language } from './types';

export class AppError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) {
    super(code);
    this.name = 'AppError';
  }
}

const messages: Record<string, Record<Language, string>> = {
  BUSY: { en: 'A change is still being saved. Please try again in a moment.', ru: 'Изменение ещё сохраняется. Повторите попытку через мгновение.' },
  EMPTY_GALLERY: { en: 'This gallery has no photos yet. Please choose another space.', ru: 'В этой галерее пока нет фотографий. Выберите другое пространство.' },
  NO_SESSION: { en: 'Start a selection first.', ru: 'Сначала начните подборку.' },
  SESSION_COMPLETE: { en: 'All photos have been rated.', ru: 'Все фотографии уже оценены.' },
  STALE_RATING: { en: 'This choice has already been recorded.', ru: 'Этот выбор уже сохранён.' },
  INVALID_CATALOG: { en: 'The catalog needs attention before it can be published.', ru: 'Перед публикацией исправьте ошибки в каталоге.' },
  MISSING_IMAGE: { en: 'An image is missing. Replace it in the staff editor before publishing.', ru: 'Не найдено изображение. Замените его в редакторе перед публикацией.' },
  IMAGE_MISSING: { en: 'An image is missing. Replace it in the staff editor before publishing.', ru: 'Не найдено изображение. Замените его в редакторе перед публикацией.' },
  IMPORT_BUSY: { en: 'Photos are already being imported. Wait for the current import to finish.', ru: 'Фотографии уже импортируются. Дождитесь завершения.' },
  IMPORT_LIMIT: { en: 'Import up to 20 photos at a time.', ru: 'Импортируйте не более 20 фотографий за один раз.' },
  IMAGE_TOO_LARGE: { en: 'This image is too large to import safely. Choose a smaller copy.', ru: 'Изображение слишком большое. Выберите уменьшенную копию.' },
  STORAGE_FULL: { en: 'There is not enough free space for these photos. Free some device storage and try again.', ru: 'Недостаточно места для фотографий. Освободите память устройства и повторите попытку.' },
  IMPORT_FAILED: { en: 'Could not import this photo. Make sure the original is available on this device and try again.', ru: 'Не удалось импортировать фото. Убедитесь, что оригинал доступен на устройстве, и повторите попытку.' },
  UNSUPPORTED_DATABASE: { en: 'This data was created by a newer app version. Update the app to open it.', ru: 'Данные созданы новой версией приложения. Обновите приложение.' },
  CATALOG_DAMAGED: { en: 'The saved catalog could not be opened. Your data has been kept. Retry or contact the app administrator.', ru: 'Не удалось открыть каталог. Данные сохранены. Повторите попытку или обратитесь к администратору.' },
  DRAFT_DAMAGED: { en: 'A damaged draft was preserved for recovery. The published catalog is available as a fresh draft.', ru: 'Повреждённый черновик сохранён для восстановления. Создан черновик из опубликованного каталога.' },
  SESSION_DAMAGED: { en: 'The interrupted selection could not be restored. A recovery copy was kept; you can start a new selection.', ru: 'Не удалось восстановить прерванную подборку. Резервная копия сохранена; можно начать новую.' },
  STORAGE_ERROR: { en: 'Could not save on this device. Check free storage and try again. Your last saved choices are safe.', ru: 'Не удалось сохранить данные. Проверьте свободное место и повторите попытку. Последний сохранённый выбор не потерян.' },
  REFERENCED_TERM: { en: 'Reassign this term on its photos before deleting it.', ru: 'Прежде чем удалить термин, замените его у связанных фотографий.' },
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
