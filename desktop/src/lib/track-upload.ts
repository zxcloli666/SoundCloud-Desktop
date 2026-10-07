import { invoke } from '@tauri-apps/api/core';
import { getSessionId } from './api';
import { preferredDataBase } from './api-client';

export const AUDIO_EXTENSIONS = ['wav', 'flac', 'aiff', 'aif', 'mp3', 'm4a', 'aac', 'ogg', 'wma'];
export const ARTWORK_EXTENSIONS = ['jpg', 'jpeg', 'png'];
export const PROGRESS_EVENT = 'track-upload:progress';

export interface UploadFields {
  title: string;
  description: string;
  genre: string;
  tag_list: string;
  sharing: 'public' | 'private';
}

export interface UploadProgress {
  id: string;
  sent: number;
  total: number;
}

export interface UploadFailure {
  kind: 'file' | 'network' | 'cancelled' | 'server';
  status?: number | null;
  code?: string | null;
  message?: string | null;
  retryAfter?: number | null;
}

export interface UploadedTrack {
  urn?: string;
  title?: string;
}

const SERVER_CODES: Record<string, string> = {
  upload_too_large: 'upload.errors.tooLarge',
  upload_format_unsupported: 'upload.errors.format',
  upload_artwork_unsupported: 'upload.errors.artwork',
  upload_in_progress: 'upload.errors.inProgress',
  uploads_busy: 'upload.errors.busy',
  upload_invalid: 'upload.errors.invalid',
};

const FILE_CODES: Record<string, string> = {
  audio_unreadable: 'upload.errors.fileUnreadable',
  artwork_unreadable: 'upload.errors.artwork',
  artwork_unsupported: 'upload.errors.artwork',
  artwork_too_large: 'upload.errors.artworkTooLarge',
};

export function startTrackUpload(
  id: string,
  filePath: string,
  artworkPath: string | null,
  fields: UploadFields,
) {
  const sent = Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0),
  );
  return invoke<UploadedTrack>('track_upload_start', {
    request: {
      id,
      backendUrl: preferredDataBase(),
      sessionId: getSessionId() ?? '',
      filePath,
      artworkPath,
      fields: sent,
    },
  });
}

export function cancelTrackUpload(id: string) {
  return invoke<void>('track_upload_cancel', { id });
}

export function isUploadFailure(error: unknown): error is UploadFailure {
  return typeof error === 'object' && error !== null && 'kind' in error;
}

export function failureText(error: unknown): string {
  if (!isUploadFailure(error)) return 'upload.errors.failed';
  if (error.kind === 'network') return 'upload.errors.network';
  if (error.kind === 'file') return FILE_CODES[error.code ?? ''] ?? 'upload.errors.fileUnreadable';
  const known = SERVER_CODES[error.code ?? ''];
  if (known) return known;
  if (error.status === 401) return 'upload.errors.session';
  if (error.status === 403 || error.status === 422) return 'upload.errors.rejected';
  return 'upload.errors.failed';
}

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function titleFromFile(path: string): string {
  const name = fileNameOf(path);
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).replace(/[_]+/g, ' ').trim();
}
