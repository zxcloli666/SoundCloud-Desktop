import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { isDone } from './progress';

export interface TrayWork {
  rows: UploadView[];
  done: number;
  failed: number;
}

export function trayWork(
  uploads: UploadView[],
  hidden: ReadonlySet<string>,
  current: ConvId | null,
): TrayWork {
  const busy = new Set(
    uploads
      .filter((upload) => !isDone(upload) && !hidden.has(upload.album))
      .map((upload) => upload.album),
  );
  const order = new Map<string, number>();
  uploads.forEach((upload, index) => {
    if (!busy.has(upload.album) || order.has(upload.album)) return;
    const away = upload.conversationId === current ? 0 : 1;
    order.set(upload.album, away * uploads.length + index);
  });
  const rank = (upload: UploadView) => order.get(upload.album) ?? 0;
  const rows = uploads
    .filter((upload) => busy.has(upload.album))
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position);
  return {
    rows,
    done: rows.filter(isDone).length,
    failed: rows.filter((upload) => upload.state === 'failed').length,
  };
}
