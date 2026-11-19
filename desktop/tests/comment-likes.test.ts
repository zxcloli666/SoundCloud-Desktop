import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  forgetCommentLikes,
  getCommentLike,
  seedCommentLikes,
  shiftCommentLike,
} from '../src/lib/comment-likes.ts';

const URN = 'soundcloud:comments:1';

test('a like adds one to the count and an unlike takes it back', () => {
  forgetCommentLikes();
  seedCommentLikes([{ commentUrn: URN, liked: false, count: 2 }]);
  shiftCommentLike(URN, true);
  assert.deepEqual(
    [getCommentLike(URN)?.liked, getCommentLike(URN)?.count],
    [true, 3],
  );
  shiftCommentLike(URN, false);
  assert.deepEqual(
    [getCommentLike(URN)?.liked, getCommentLike(URN)?.count],
    [false, 2],
  );
});

test('repeating the same state does not move the count', () => {
  forgetCommentLikes();
  seedCommentLikes([{ commentUrn: URN, liked: true, count: 5 }]);
  shiftCommentLike(URN, true);
  assert.equal(getCommentLike(URN)?.count, 5);
});

test('the count never goes below zero', () => {
  forgetCommentLikes();
  shiftCommentLike(URN, false);
  assert.equal(getCommentLike(URN)?.count, 0);
});

test('a reading does not overwrite a fresh local change', () => {
  forgetCommentLikes();
  seedCommentLikes([{ commentUrn: URN, liked: false, count: 1 }]);
  shiftCommentLike(URN, true, 1_000);
  seedCommentLikes([{ commentUrn: URN, liked: false, count: 1 }], 10_000);
  assert.equal(getCommentLike(URN)?.liked, true);
  seedCommentLikes([{ commentUrn: URN, liked: false, count: 1 }], 40_000);
  assert.equal(getCommentLike(URN)?.liked, false);
});
