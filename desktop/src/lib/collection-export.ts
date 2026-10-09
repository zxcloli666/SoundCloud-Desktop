import { join } from '@tauri-apps/api/path';
import { create } from 'zustand';
import type { Track } from '../stores/player';
import { type ExportFormat, exportTrackToDir } from './cache';
import { sanitizeFilename, uniqueFileNames } from './filename';
import { getTrackDisplay } from './track-display';

const PARALLEL_EXPORTS = 2;

export type ExportStatus = 'preparing' | 'running' | 'done' | 'cancelled' | 'failed';

export interface ExportJob {
  scope: string;
  title: string;
  format: ExportFormat;
  status: ExportStatus;
  cancelling: boolean;
  total: number;
  done: number;
  failed: number;
  skipped: number;
  firstPath: string | null;
}

export const useExportJob = create<{ job: ExportJob | null }>(() => ({ job: null }));

let cancelRequested = false;

export function isExportRunning(): boolean {
  const status = useExportJob.getState().job?.status;
  return status === 'preparing' || status === 'running';
}

export function cancelExport() {
  if (!isExportRunning()) return;
  cancelRequested = true;
  patchJob({ cancelling: true });
}

function patchJob(patch: Partial<ExportJob>) {
  useExportJob.setState((s) => (s.job ? { job: { ...s.job, ...patch } } : s));
}

function uniqueTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track?.urn || seen.has(track.urn)) return false;
    seen.add(track.urn);
    return true;
  });
}

function bump(key: 'failed' | 'skipped' | null, path: string | null) {
  useExportJob.setState((s) => {
    if (!s.job) return s;
    const job = { ...s.job, done: s.job.done + 1 };
    if (key) job[key] += 1;
    if (path && !job.firstPath) job.firstPath = path;
    return { job };
  });
}

function tagsOf(track: Track) {
  const display = getTrackDisplay(track);
  return {
    title: display.title || track.title,
    artist: display.artistLine || track.user.username,
  };
}

export async function pickExportFolder(title: string): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === 'string' ? picked : null;
}

export async function exportCollection(options: {
  scope: string;
  title: string;
  format: ExportFormat;
  root: string;
  collect: () => Promise<Track[]>;
}): Promise<void> {
  if (isExportRunning()) return;
  const { scope, title, format, root, collect } = options;
  cancelRequested = false;
  useExportJob.setState({
    job: {
      scope,
      title,
      format,
      status: 'preparing',
      cancelling: false,
      total: 0,
      done: 0,
      failed: 0,
      skipped: 0,
      firstPath: null,
    },
  });

  try {
    const tracks = uniqueTracks(await collect());
    const dir = await join(root, sanitizeFilename(title));
    const tags = tracks.map(tagsOf);
    const names = uniqueFileNames(
      tags.map((tag) => `${tag.artist} - ${tag.title}`),
      format,
    );
    patchJob({ status: 'running', total: tracks.length });

    let next = 0;
    const worker = async () => {
      while (!cancelRequested && next < tracks.length) {
        const index = next++;
        try {
          const outcome = await exportTrackToDir(
            tracks[index],
            tags[index],
            dir,
            names[index],
            format,
          );
          bump(outcome.skipped ? 'skipped' : null, outcome.path);
        } catch (error) {
          console.warn('[Export] failed:', tracks[index].urn, error);
          bump('failed', null);
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_EXPORTS }, worker));
  } catch (error) {
    console.warn('[Export] aborted:', error);
    patchJob({ status: 'failed' });
    return;
  }

  patchJob({ status: cancelRequested ? 'cancelled' : 'done' });
}
