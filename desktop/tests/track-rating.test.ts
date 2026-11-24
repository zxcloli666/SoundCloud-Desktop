import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ratingQuality, ratingTier, ratingTitleKey } from '../src/lib/track-rating.ts';
import type { TrackScdMeta } from '../src/stores/player.ts';

const meta = (over: Partial<TrackScdMeta> = {}): TrackScdMeta => ({
  storage_state: 'ok',
  index_state: 'indexed',
  enrich_state: 'done',
  ...over,
});

test('the worst state decides the letter', () => {
  assert.equal(ratingTier(meta()), 'analyzed');
  assert.equal(ratingTier(meta({ index_state: 'pending' })), 'cached');
  assert.equal(ratingTier(meta({ storage_state: 'pending' })), 'pending');
  assert.equal(ratingTier(meta({ index_state: 'failed' })), 'failed');
  assert.equal(ratingTier(meta({ storage_state: 'missing' })), 'failed');
  assert.equal(ratingTier(meta({ index_state: 'too_long' })), 'tooLong');
});

test('the dot is only for a stored HQ or UQ copy', () => {
  assert.equal(ratingQuality('analyzed', meta({ storage_quality: 'hq' })), 'hq');
  assert.equal(ratingQuality('cached', meta({ storage_quality: 'uq' })), 'uq');
  assert.equal(ratingQuality('analyzed', meta({ storage_quality: 'sq' })), null);
  assert.equal(ratingQuality('failed', meta({ storage_quality: 'hq' })), null);
});

test('the title names the stored quality', () => {
  assert.equal(ratingTitleKey('analyzed', meta({ storage_quality: 'uq' })), 'track.status.analyzedUq');
  assert.equal(ratingTitleKey('cached', meta({ storage_quality: 'hq' })), 'track.status.cachedHq');
  assert.equal(ratingTitleKey('pending', meta({ storage_quality: 'hq' })), 'track.status.pending');
});
