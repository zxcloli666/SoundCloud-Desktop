import { getCurrentWebview } from '@tauri-apps/api/webview';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import { FileText } from '../../lib/icons';
import { isListFile } from '../../lib/list-file';
import { useImportStore } from '../../stores/import';
import { startImportSync } from '../../stores/import-sync';
import { DropOverlay } from '../ui/DropOverlay';
import { ImportIsland } from './ImportIsland';
import { ImportSyncIsland } from './ImportSyncIsland';

const ImportDialog = lazy(() => import('./ImportDialog'));

function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function ImportHost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dialogOpen = useImportStore((s) => s.dialogOpen);
  const savedAt = useImportStore((s) => s.result?.savedAt ?? 0);
  const [dropping, setDropping] = useState(false);

  useEffect(() => startImportSync(), []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTextTarget(event.target) || useImportStore.getState().dialogOpen) return;
      const text = event.clipboardData?.getData('text')?.trim();
      if (!text || text.length > 600) return;
      void invoke<string | null>('import_detect', { input: text }).then((source) => {
        if (!source) return;
        toast(t('importer.pasted', { source: t(`importer.source.${source}`) }), {
          id: 'import-paste',
          action: {
            label: t('importer.start'),
            onClick: () => useImportStore.getState().openDialog({ tab: 'link', value: text }),
          },
        });
      });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [t]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === 'enter') {
          setDropping(payload.paths.some(isListFile));
        } else if (payload.type === 'leave') {
          setDropping(false);
        } else if (payload.type === 'drop') {
          setDropping(false);
          const path = payload.paths.find(isListFile);
          if (!path) return;
          invoke<string>('import_read_list_file', { path }).then(
            (value) => useImportStore.getState().openDialog({ tab: 'text', value }),
            () => toast.error(t('importer.err.bad_file')),
          );
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [t]);

  useEffect(() => {
    if (!savedAt) return;
    const { result, dialogOpen: visible } = useImportStore.getState();
    if (!result) return;
    const message = t('importer.saved', { count: result.count });
    const playlist = result.playlist;
    if (!visible) {
      toast.success(message, {
        id: 'import-saved',
        action: playlist
          ? {
              label: t('importer.openPlaylist'),
              onClick: () => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`),
            }
          : undefined,
      });
    }
    void invoke('import_notify', {
      title: t('importer.title'),
      body: playlist ? `${playlist.title}: ${message}` : message,
    }).catch(() => undefined);
  }, [savedAt, navigate, t]);

  return (
    <>
      <ImportIsland />
      <ImportSyncIsland />
      {dialogOpen && (
        <Suspense fallback={null}>
          <ImportDialog />
        </Suspense>
      )}
      {dropping && (
        <DropOverlay
          icon={<FileText size={40} strokeWidth={1.6} />}
          title={t('importer.dropFile')}
          chip=".txt · .csv · .tsv"
        />
      )}
    </>
  );
}
