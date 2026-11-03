import { getCurrentWebview } from '@tauri-apps/api/webview';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import { FileText } from '../../lib/icons';
import { useImportStore } from '../../stores/import';
import { ImportIsland } from './ImportIsland';

const ImportDialog = lazy(() => import('./ImportDialog'));
const LIST_FILE = /\.(txt|csv|tsv)$/i;

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
          setDropping(payload.paths.some((path) => LIST_FILE.test(path)));
        } else if (payload.type === 'leave') {
          setDropping(false);
        } else if (payload.type === 'drop') {
          setDropping(false);
          const path = payload.paths.find((p) => LIST_FILE.test(p));
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
      {dialogOpen && (
        <Suspense fallback={null}>
          <ImportDialog />
        </Suspense>
      )}
      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-5 bg-[rgb(var(--paper)/0.7)] backdrop-blur-xl animate-fade-in-up motion-reduce:animate-none">
          <div className="absolute inset-5 rounded-[28px] border-2 border-dashed border-accent" />
          <div className="relative flex flex-col items-center gap-3 text-center text-accent">
            <FileText size={40} />
            <p className="text-[16px] font-semibold text-ink-90">{t('importer.dropFile')}</p>
          </div>
        </div>
      )}
    </>
  );
}
