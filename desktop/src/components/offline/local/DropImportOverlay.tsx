import { getCurrentWebview } from '@tauri-apps/api/webview';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileMusic } from '../../../lib/icons';
import { isListFile } from '../../../lib/list-file';
import { importLocalPaths } from '../../../lib/local-import';
import { DropOverlay } from '../../ui/DropOverlay';
import { runLocalImport } from './importFeedback';

export const DropImportOverlay = React.memo(function DropImportOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hovering, setHovering] = useState<number | null>(null);

  useEffect(() => {
    const show = () => navigate('/offline', { state: { section: 'local' } });
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === 'enter') {
          const audio = payload.paths.filter((path) => !isListFile(path)).length;
          setHovering(audio > 0 ? audio : null);
        } else if (payload.type === 'leave') {
          setHovering(null);
        } else if (payload.type === 'drop') {
          setHovering(null);
          const paths = payload.paths.filter((path) => !isListFile(path));
          if (paths.length > 0) void runLocalImport(() => importLocalPaths(paths), show);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [navigate]);

  if (hovering === null) return null;

  return (
    <DropOverlay
      icon={<FileMusic size={40} strokeWidth={1.6} />}
      title={t('local.dropOverlayTitle')}
      hint={t('local.dropOverlayHint')}
      chip={t('local.dropCount', { count: hovering })}
    />
  );
});
