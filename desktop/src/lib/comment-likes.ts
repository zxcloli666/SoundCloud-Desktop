import { useSyncExternalStore } from 'react';

export interface CommentLike {
  liked: boolean;
  count: number;
  touchedAt: number;
}

export interface CommentLikeReading {
  commentUrn: string;
  liked: boolean;
  count: number;
}

const FRESH_MS = 30_000;

const likes = new Map<string, CommentLike>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCommentLike(urn: string): CommentLike | undefined {
  return likes.get(urn);
}

export function useCommentLike(urn: string): CommentLike | undefined {
  return useSyncExternalStore(subscribe, () => likes.get(urn));
}

export function seedCommentLikes(readings: CommentLikeReading[], now = Date.now()) {
  for (const reading of readings) {
    const known = likes.get(reading.commentUrn);
    if (known && now - known.touchedAt < FRESH_MS) continue;
    likes.set(reading.commentUrn, { liked: reading.liked, count: reading.count, touchedAt: 0 });
  }
  notify();
}

export function shiftCommentLike(urn: string, liked: boolean, now = Date.now()) {
  const known = likes.get(urn);
  const was = known?.liked ?? false;
  const count = Math.max(0, (known?.count ?? 0) + (liked === was ? 0 : liked ? 1 : -1));
  likes.set(urn, { liked, count, touchedAt: now });
  notify();
}

export function forgetCommentLikes() {
  likes.clear();
  notify();
}
