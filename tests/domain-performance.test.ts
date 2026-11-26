/// <reference types="node" />
import { expect, test } from '@jest/globals';
import { performance } from 'node:perf_hooks';
import { summarizeSession } from '../src/domain/scoring';
import type { Session } from '../src/domain/types';
import { singleRoomCatalog } from './room-fixture';

test('100-rating summaries remain below the 100 ms budget across repeated Node runs', () => {
  const catalog = singleRoomCatalog(100);
  const session: Session = {
    id: 'benchmark', createdAt: '2026-11-17T00:00:00.000Z', catalog, space: 'bathroom', status: 'complete',
    ratings: catalog.photos.map((photo, index) => ({ photoId: photo.id, choice: index % 3 === 0 ? 'dislike' : 'like' })),
  };
  for (let warmup = 0; warmup < 20; warmup++) summarizeSession(session);
  const timings: number[] = [];
  for (let iteration = 0; iteration < 500; iteration++) {
    const start = performance.now();
    const summary = summarizeSession(session);
    timings.push(performance.now() - start);
    expect(summary.reviewed).toBe(100);
  }
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)];
  const p95 = timings[Math.floor(timings.length * 0.95)];
  const max = timings[timings.length - 1];
  console.info(`Node-only summary benchmark: 100 ratings × 500 runs; median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms, max ${max.toFixed(3)} ms. Native device profiling remains separate.`);
  expect(p95).toBeLessThan(100);
});
