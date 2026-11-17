import { AppError } from './errors';
import type { Catalog, Choice, Session, Space } from './types';

export function createSession(catalog: Catalog, space: Space, id: string, createdAt = new Date().toISOString()): Session {
  if (!catalog.galleries[space]?.length) throw new AppError('EMPTY_GALLERY');
  return { id, catalog, space, ratings: [], status: 'active', createdAt };
}

export function rateSession(session: Session, choice: Choice, expectedPhotoId: string): Session {
  if (session.status === 'complete') throw new AppError('SESSION_COMPLETE');
  const deck = session.catalog.galleries[session.space];
  const photoId = deck[session.ratings.length];
  if (photoId !== expectedPhotoId || session.ratings.some((rating) => rating.photoId === photoId)) throw new AppError('STALE_RATING');
  const ratings = [...session.ratings, { photoId, choice }];
  return { ...session, ratings, status: ratings.length === deck.length ? 'complete' : 'active' };
}

export function undoSession(session: Session): Session {
  if (!session.ratings.length) return session;
  return { ...session, ratings: session.ratings.slice(0, -1), status: 'active' };
}

export function canShowResult(session: Session): boolean {
  return session.status === 'complete' || session.ratings.length >= 20;
}

export function isValidSession(value: unknown, catalog: Catalog): value is Omit<Session, 'catalog'> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Omit<Session, 'catalog'>;
  if (typeof candidate.id !== 'string' || typeof candidate.createdAt !== 'string' || !Array.isArray(candidate.ratings)) return false;
  const deck = catalog.galleries[candidate.space];
  if (!deck?.length || candidate.ratings.length > deck.length) return false;
  if (candidate.status !== (candidate.ratings.length === deck.length ? 'complete' : 'active')) return false;
  return candidate.ratings.every((rating, index) => rating && rating.photoId === deck[index] && (rating.choice === 'like' || rating.choice === 'dislike'));
}
