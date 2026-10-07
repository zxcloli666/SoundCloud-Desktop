import i18n from '../i18n';
import type { ApiError } from './api-client';

export interface ApiErrorText {
  title: string;
  description: string;
}

type Subject = 'track' | 'playlist' | 'user' | 'comment' | 'lyrics' | 'item';

const SUBJECT_BY_SEGMENT: Record<string, Subject> = {
  tracks: 'track',
  dislikes: 'track',
  playlists: 'playlist',
  users: 'user',
  followings: 'user',
  comments: 'comment',
  lyrics: 'lyrics',
};

const COLLECTION_ROOTS = new Set(['me', 'likes', 'reposts']);

const HTML_BODY = /<!doctype|<html|cloudfront|request could not be satisfied/i;

export function errorSubject(path: string): Subject {
  const segments = path.split(/[?#]/)[0].split('/').filter(Boolean);
  const head = COLLECTION_ROOTS.has(segments[0]) ? segments[1] : segments[0];
  return (head && SUBJECT_BY_SEGMENT[head]) || 'item';
}

function retryHint(seconds: number | null): string {
  return seconds
    ? i18n.t('errors.http.retryIn', { seconds: Math.ceil(seconds) })
    : i18n.t('errors.http.retryLater');
}

function looksBlocked(err: ApiError): boolean {
  return err.code === 'soundcloud_blocked' || HTML_BODY.test(err.body);
}

function text(titleKey: string, err: ApiError, description: string): ApiErrorText {
  return { title: i18n.t(titleKey, { status: err.status }), description };
}

function describeByCode(err: ApiError): ApiErrorText | null {
  const retry = retryHint(err.retryAfterSeconds);
  switch (err.code) {
    case 'soundcloud_temporarily_unavailable':
      return text('errors.http.soundcloudDown', err, retry);
    case 'soundcloud_read_timed_out':
    case 'soundcloud_refresh_timed_out':
      return text('errors.http.soundcloudTimeout', err, retry);
    case 'soundcloud_refresh_rate_limited':
      return text('errors.http.rateLimited', err, retry);
    case 'soundcloud_reauthorization_required':
      return text('errors.http.reauth', err, i18n.t('errors.http.reauthHint'));
    default:
      return looksBlocked(err) ? text('errors.http.blocked', err, retry) : null;
  }
}

function describeServerError(err: ApiError): ApiErrorText {
  const retry = retryHint(err.retryAfterSeconds);
  if (err.status === 504) return text('errors.http.timeout', err, retry);
  if (err.status === 502 || err.status === 503) {
    return text('errors.http.unavailable', err, retry);
  }
  return text('errors.serverError', err, i18n.t('errors.http.serverHint'));
}

function describeClientError(err: ApiError, path: string): ApiErrorText {
  switch (err.status) {
    case 404:
      return text(
        `errors.http.notFound.${errorSubject(path)}`,
        err,
        i18n.t('errors.http.notFoundHint'),
      );
    case 403:
      return text('errors.http.forbidden', err, i18n.t('errors.http.forbiddenHint'));
    case 409:
      return text('errors.http.conflict', err, i18n.t('errors.http.conflictHint'));
    case 429:
      return text('errors.http.rateLimited', err, retryHint(err.retryAfterSeconds));
    case 400:
    case 422:
      return text('errors.http.badRequest', err, i18n.t('errors.http.reportHint'));
    default:
      return text('errors.http.failed', err, i18n.t('errors.http.reportHint'));
  }
}

export function describeApiError(err: ApiError, path: string): ApiErrorText {
  return (
    describeByCode(err) ??
    (err.status >= 500 ? describeServerError(err) : describeClientError(err, path))
  );
}
