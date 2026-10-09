import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ExportFormat, isMp3ExportSupported } from '../../lib/cache';
import {
  cancelExport,
  exportCollection,
  pickExportFolder,
  useExportJob,
} from '../../lib/collection-export';
import type { Track } from '../../stores/player';
import { showExportToast } from './ExportToast';

let lastFormat: ExportFormat = 'm4a';

export function useCollectionExport(
  scope: string,
  title: string,
  collect: () => Promise<Track[]>,
  open: boolean,
) {
  const { t } = useTranslation();
  const job = useExportJob((s) => s.job);
  const [format, setFormatState] = useState<ExportFormat>(lastFormat);
  const [mp3Supported, setMp3Supported] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void isMp3ExportSupported()
      .then((ok) => {
        if (alive) setMp3Supported(ok);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const setFormat = useCallback((next: ExportFormat) => {
    lastFormat = next;
    setFormatState(next);
  }, []);

  const effectiveFormat: ExportFormat = format === 'mp3' && !mp3Supported ? 'm4a' : format;
  const running = job !== null && (job.status === 'preparing' || job.status === 'running');
  const mine = running && job.scope === scope ? job : null;

  const start = useCallback(async () => {
    try {
      const root = await pickExportFolder(t('collectionSave.pickFolder'));
      if (!root) return;
      showExportToast();
      await exportCollection({ scope, title, format: effectiveFormat, root, collect });
    } catch (error) {
      console.warn('[Export] could not start:', error);
      toast.error(t('collectionSave.exportFailed'));
    }
  }, [scope, title, effectiveFormat, collect, t]);

  return {
    job: mine,
    busy: running && !mine,
    format: effectiveFormat,
    mp3Supported,
    setFormat,
    start,
    cancel: cancelExport,
  };
}
