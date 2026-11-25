import type { Language } from './types';

export class AppError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) {
    super(code);
    this.name = 'AppError';
  }
}

const messages: Record<string, Record<Language, string>> = {
  DUPLICATE_ROOM: { tk: 'Şeýle atly otag eýýäm bar.', ru: 'Комната с таким названием уже существует.' },
  REFERENCED_ROOM: { tk: 'Otagy öçürmezden ozal, baglanyşykly suratlarda ony çalyşyň.', ru: 'Прежде чем удалить комнату, замените её у связанных фотографий.' },
  ROOM_REQUIRED: { tk: 'Suraty ýatda saklamak üçin otagy saýlaň.', ru: 'Выберите комнату, чтобы сохранить фото.' },
  DRAFT_PHOTO_TOO_LARGE: { tk: 'Saýlanan suratyň ölçegi 10 MB-dan geçmeli däl.', ru: 'Размер выбранного фото не должен превышать 10 МБ.' },
  IMAGE_SIZE_UNAVAILABLE: { tk: 'Suratyň ölçegini barlap bolmady. Başga surat saýlaň.', ru: 'Не удалось проверить размер фото. Выберите другое изображение.' },
  DUPLICATE_TERM: { tk: 'Bu kategoriýada şeýle atly termin eýýäm bar.', ru: 'Термин с таким названием уже есть в этой категории.' },
  INVALID_WORKBOOK: { tk: 'Diňe Russian we Turkmen (şol tertipde) atly iki sahypaly .xlsx faýly gerek. Köne format goldanylmaýar — täze şablon üçin «Şablony almak» düwmesine basyň.', ru: 'Нужен файл .xlsx ровно с двумя листами Russian и Turkmen (в таком порядке). Старый формат не поддерживается — нажмите «Скачать шаблон» для нового файла.' },
  INVALID_ARCHIVE: { tk: 'ZIP nädogry, zaýalanan ýa-da goldanylmaýar.', ru: 'ZIP повреждён, содержит небезопасные пути или не поддерживается.' },
  TRANSFER_LIMIT: { tk: 'Çäk: 500 surat, XLSX 10 MiB, her surat 50 MiB, suratlar jemi 1 GiB.', ru: 'Лимиты: 500 фото, XLSX 10 МиБ, фото 50 МиБ каждое и 1 ГиБ всего.' },
  TRANSFER_CANCELED: { tk: 'Amal ýatyryldy. Garalama üýtgemedi.', ru: 'Операция отменена. Черновик не изменён.' },
  TRANSFER_FAILED: { tk: 'Faýllary taýýarlap bolmady. Faýllary we boş ýeri barlap gaýtadan synanyşyň.', ru: 'Не удалось подготовить файлы. Проверьте файлы и свободное место, затем повторите.' },
  DUPLICATE_FILENAME: { tk: 'Birmeňzeş atly suratlar bar. Faýllaryň atlaryny tapawutlandyryň.', ru: 'Есть изображения с одинаковыми именами. Переименуйте их и повторите выбор.' },
  STALE_DRAFT: { tk: 'Garalama üýtgedi. Täzelenen syny barlap, ýene tassyklaň.', ru: 'Черновик изменился. Проверьте обновлённый обзор и подтвердите снова.' },
  STAFF_LOCKED: { tk: 'Dowam etmek üçin işgär PIN koduny giriziň.', ru: 'Для продолжения войдите с PIN сотрудника.' },
  SHARING_UNAVAILABLE: { tk: 'Bu enjamda faýl paýlaşmak elýeterli däl.', ru: 'На этом устройстве недоступно сохранение через меню «Поделиться».' },
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
