import { toast } from 'sonner';
import i18n from '../i18n';
import { ApiError, api } from './api';

const ANSWERED_STATUSES = [404];

export interface TrackDetails {
  title: string;
  description: string;
  genre: string;
  tag_list: string;
}

export function parseTagList(tagList: string | undefined): string[] {
  if (!tagList) return [];
  const tags: string[] = [];
  for (const match of tagList.matchAll(/"([^"]*)"|(\S+)/g)) {
    const tag = (match[1] ?? match[2]).trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function formatTagList(tags: string[]): string {
  return tags
    .map((tag) => tag.replace(/"/g, '').trim())
    .filter(Boolean)
    .map((tag) => (/\s/.test(tag) ? `"${tag}"` : tag))
    .join(' ');
}

export function splitTagInput(input: string): string[] {
  const tags: string[] = [];
  for (const raw of input.split(/[,#\n]/)) {
    const tag = raw.replace(/"/g, '').trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function updateTrackDetails(trackUrn: string, details: TrackDetails) {
  return api(`/tracks/${encodeURIComponent(trackUrn)}`, {
    method: 'PUT',
    body: JSON.stringify({ track: details }),
    silentStatuses: ANSWERED_STATUSES,
  });
}

export function deleteTrack(trackUrn: string) {
  return api(`/tracks/${encodeURIComponent(trackUrn)}`, {
    method: 'DELETE',
    silentStatuses: ANSWERED_STATUSES,
  });
}

export function toastTrackEditError(error: unknown) {
  if (!(error instanceof ApiError) || !ANSWERED_STATUSES.includes(error.status)) return;
  toast.error(i18n.t('track.notSyncedYet'));
}
