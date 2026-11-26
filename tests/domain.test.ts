import { describe, expect, test } from '@jest/globals';
import { seedCatalog } from '../src/data/catalog';
import { cloneCatalog, termIsReferenced, validateCatalog } from '../src/domain/catalog';
import { messageForError } from '../src/domain/errors';
import { summarizeSession } from '../src/domain/scoring';
import { canShowResult, createSession, isValidSession, rateSession, undoSession } from '../src/domain/session';
import { ROOMS, type Catalog, type Session } from '../src/domain/types';
import { singleRoomCatalog } from './room-fixture';

function ratedSession(ids: string[], likes: string[], catalog = seedCatalog): Session {
  return {
    id: 'test-session', catalog: { ...catalog, galleries: { ...catalog.galleries, bathroom: ids } }, space: 'bathroom', createdAt: '2026-11-17T10:00:00Z', status: 'complete',
    ratings: ids.map((photoId) => ({ photoId, choice: likes.includes(photoId) ? 'like' : 'dislike' })),
  };
}

describe('catalog integrity', () => {
  test('sample contains four independent galleries with 12 distinct photos per room', () => {
    expect(validateCatalog(seedCatalog)).toEqual([]);
    expect(seedCatalog.photos).toHaveLength(48);
    expect(new Set(seedCatalog.photos.map((photo) => photo.id)).size).toBe(48);
    for (const room of ROOMS) expect(seedCatalog.galleries[room]).toHaveLength(12);
    expect(Object.keys(seedCatalog.galleries)).toEqual([...ROOMS]);
  });

  test('flexible and empty galleries are valid, duplicate and wrong-room entries are not', () => {
    const catalog = cloneCatalog(seedCatalog);
    catalog.galleries.bathroom = [];
    catalog.galleries.bedroom = catalog.galleries.bedroom.slice(0, 3);
    expect(validateCatalog(catalog)).toEqual([]);
    catalog.galleries.bathroom = [catalog.galleries.bedroom[0], catalog.galleries.bedroom[0]];
    expect(validateCatalog(catalog).map((issue) => issue.code)).toEqual(expect.arrayContaining(['DUPLICATE_GALLERY_PHOTO', 'GALLERY_ROOM']));
  });

  test('unselected imports can be incomplete; selected ones require style and all feature categories', () => {
    const catalog = cloneCatalog(seedCatalog);
    const photo = { ...catalog.photos[0], id: 'new-import', styleId: '', paletteIds: [], materialIds: [], detailIds: [] };
    catalog.photos.push(photo);
    expect(validateCatalog(catalog)).toEqual([]);
    catalog.galleries.bathroom.push(photo.id);
    expect(validateCatalog(catalog).filter((issue) => issue.subject === photo.id).map((issue) => issue.code)).toEqual(['STYLE', 'TAGS', 'TAGS', 'TAGS']);
  });

  test('vocabulary requires both labels and consistent references', () => {
    const catalog = cloneCatalog(seedCatalog);
    expect(termIsReferenced(catalog, 'oak')).toBe(true);
    catalog.terms.find((term) => term.id === 'oak')!.labels.ru = '';
    expect(validateCatalog(catalog).some((issue) => issue.code === 'TERM_LABEL')).toBe(true);
    catalog.terms = catalog.terms.filter((term) => term.id !== 'oak');
    expect(validateCatalog(catalog).some((issue) => issue.code === 'TAGS')).toBe(true);
  });

  test('corrupted catalog structures return errors instead of crashing', () => {
    expect(validateCatalog(null)[0].code).toBe('STRUCTURE');
    expect(validateCatalog({ photos: [], terms: null })[0].code).toBe('STRUCTURE');
    const catalog = cloneCatalog(seedCatalog);
    catalog.photos[0].width = Number.NaN;
    expect(validateCatalog(catalog).some((issue) => issue.code === 'DIMENSIONS')).toBe(true);
  });
});

describe('session transitions', () => {
  test('ratings are sequential, undo restores the previous photo, and stale choices cannot advance', () => {
    const original = createSession(seedCatalog, 'bathroom', 'one');
    const first = original.catalog.galleries.bathroom[0];
    const next = rateSession(original, 'like', first);
    expect(original.ratings).toHaveLength(0);
    expect(next.ratings).toEqual([{ photoId: first, choice: 'like' }]);
    expect(() => rateSession(next, 'dislike', first)).toThrow('STALE_RATING');
    expect(undoSession(next).ratings).toHaveLength(0);
  });

  test('early results become available at 20 ratings and undo can reverse that boundary', () => {
    const catalog = singleRoomCatalog(21);
    let session = createSession(catalog, 'bathroom', 'threshold');
    for (const id of catalog.galleries.bathroom.slice(0, 19)) session = rateSession(session, 'like', id);
    expect(canShowResult(session)).toBe(false);
    session = rateSession(session, 'dislike', catalog.galleries.bathroom[19]);
    expect(canShowResult(session)).toBe(true);
    expect(session.status).toBe('active');
    expect(canShowResult(undoSession(session))).toBe(false);
  });

  test('short galleries finish naturally and completing all photos opens results', () => {
    let session = createSession(seedCatalog, 'kitchen', 'complete');
    for (const id of session.catalog.galleries.kitchen) session = rateSession(session, 'dislike', id);
    expect(session.status).toBe('complete');
    expect(canShowResult(session)).toBe(true);
    expect(undoSession(session).status).toBe('active');
    expect(() => rateSession(session, 'like', session.catalog.galleries.kitchen[0])).toThrow('SESSION_COMPLETE');
  });

  test('empty galleries and corrupted ordered ratings cannot become valid sessions', () => {
    const catalog: Catalog = { ...cloneCatalog(seedCatalog), galleries: { ...seedCatalog.galleries, bathroom: [] } };
    expect(() => createSession(catalog, 'bathroom', 'empty')).toThrow('EMPTY_GALLERY');
    const session = createSession(seedCatalog, 'bedroom', 'valid');
    expect(isValidSession(session, seedCatalog)).toBe(true);
    session.ratings = [{ photoId: seedCatalog.galleries.bedroom[1], choice: 'like' }];
    expect(isValidSession(session, seedCatalog)).toBe(false);
  });
});

describe('evidence-based style summaries', () => {
  test('zero, one, or two likes do not claim a style result', () => {
    const ids = seedCatalog.galleries.bathroom;
    for (const count of [0, 1, 2]) expect(summarizeSession(ratedSession(ids, ids.slice(0, count))).kind).toBe('inconclusive');
  });

  test('exposure normalization does not count unviewed photos as dislikes', () => {
    const catalog = singleRoomCatalog(24);
    const scandinavian = catalog.photos.filter((photo) => photo.styleId === 'scandinavian').map((photo) => photo.id);
    const industrial = catalog.photos.filter((photo) => photo.styleId === 'industrial').map((photo) => photo.id);
    const reviewed = [...scandinavian.slice(0, 2), ...industrial.slice(0, 4)];
    const liked = [...scandinavian.slice(0, 2), ...industrial.slice(0, 3)];
    const result = summarizeSession(ratedSession(reviewed, liked, catalog));
    expect(result.kind).toBe('single');
    expect(result.styles).toEqual([{ styleId: 'scandinavian', likes: 2, reviewed: 2, score: 1 }]);
  });

  test('equal two-style evidence yields a blend and three styles yield varied preferences', () => {
    const styles = ['scandinavian', 'minimalist', 'modern_classic'];
    const byStyle = styles.map((style) => seedCatalog.photos.filter((photo) => photo.styleId === style).slice(0, 2).map((photo) => photo.id));
    const pair = byStyle.slice(0, 2).flat();
    const triple = byStyle.flat();
    expect(summarizeSession(ratedSession(pair, pair)).kind).toBe('blend');
    expect(summarizeSession(ratedSession(triple, triple)).kind).toBe('varied');
  });

  test('liking one photo from each style remains inconclusive despite enough total likes', () => {
    const ids = ['scandinavian', 'minimalist', 'modern_classic', 'industrial'].map((style) => `bathroom-${style}-1`);
    expect(summarizeSession(ratedSession(ids, ids)).kind).toBe('inconclusive');
  });

  test('common features need distinct-photo support and duplicate votes are ignored defensively', () => {
    const ids = ['bathroom-scandinavian-1', 'bathroom-scandinavian-2', 'bathroom-modern_classic-1'];
    const session = ratedSession(ids, ids);
    session.ratings.push({ photoId: ids[0], choice: 'like' });
    const result = summarizeSession(session);
    expect(result.reviewed).toBe(3);
    expect(result.likedIds).toHaveLength(3);
    expect(result.features.palette).toEqual([{ termId: 'warm_neutral', count: 3 }]);
    expect(result.features.material).toEqual([{ termId: 'oak', count: 2 }]);
    expect(result.features.detail).toEqual([{ termId: 'clean_lines', count: 2 }]);
  });

  test('unexpected native errors do not leak internal details, known import errors are localized', () => {
    expect(messageForError(new Error('STORAGE_FULL'), 'tk')).toContain('ýat');
    expect(messageForError(new Error('private SQL or file path'), 'ru')).not.toContain('SQL');
  });
});
