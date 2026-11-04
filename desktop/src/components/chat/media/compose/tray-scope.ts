import type { UploadView } from '../../../../lib/chat/media-types';
import { isDone } from './progress';

export interface TrayWork {
  rows: UploadView[];
  done: number;
  failed: number;
}

export function trayWork(uploads: UploadView[], hidden: ReadonlySet<string>): TrayWork {
  const busy = new Set(
    uploads
      .filter((upload) => !isDone(upload) && !hidden.has(upload.album))
      .map((upload) => upload.album),
  );
  const rows = uploads
    .filter((upload) => busy.has(upload.album))
    .sort((a, b) => a.album.localeCompare(b.album) || a.position - b.position);
  return {
    rows,
    done: rows.filter(isDone).length,
    failed: rows.filter((upload) => upload.state === 'failed').length,
  };
}
