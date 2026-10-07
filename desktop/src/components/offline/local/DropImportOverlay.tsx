import { getCurrentWebview } from '@tauri-apps/api/webview';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileMusic } from '../../../lib/icons';
import { importLocalPaths } from '../../../lib/local-import';
import { usePerfMode } from '../../../lib/perf';
import { runLocalImport } from './importFeedback';

export const DropImportOverlay = React.memo(function DropImportOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const [hovering, setHovering] = useState<number | null>(null);
  const blur = perf.blur(18);

  useEffect(() => {
    const show = () => navigate('/offline', { state: { section: 'local' } });
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === 'enter') {
          setHovering(payload.paths.length > 0 ? payload.paths.length : null);
        } else if (payload.type === 'leave') {
          setHovering(null);
        } else if (payload.type === 'drop') {
          setHovering(null);
          const { paths } = payload;
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
    <div
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-5 animate-fade-in-up"
      style={{
        background: blur > 0 ? 'rgba(8,8,10,0.55)' : 'rgba(8,8,10,0.85)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.3)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.3)` : undefined,
      }}
    >
      <div
        className="absolute inset-5 rounded-[28px] border-2 border-dashed"
        style={{
          borderColor: 'var(--color-accent)',
          background:
            'radial-gradient(60% 60% at 50% 45%, var(--color-accent-glow), transparent 70%)',
        }}
      />
      <div className="relative flex flex-col items-center text-center">
        <span
          className="relative flex size-24 items-center justify-center rounded-[30px]"
          style={{
            background: 'var(--color-accent-glow)',
            color: 'var(--color-accent-hover)',
            boxShadow: perf.glow ? '0 20px 60px -12px var(--color-accent-glow)' : undefined,
          }}
        >
          {perf.idleAnim && (
            <span
              className="absolute inset-0 animate-ping rounded-[30px] opacity-30"
              style={{ background: 'var(--color-accent-glow)' }}
            />
          )}
          <FileMusic size={40} strokeWidth={1.6} />
        </span>
        <div className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-white/95">
          {t('local.dropOverlayTitle')}
        </div>
        <div className="mt-1.5 max-w-[360px] text-[13px] leading-snug text-white/55">
          {t('local.dropOverlayHint')}
        </div>
        <div
          className="mt-4 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tabular-nums"
          style={{ borderColor: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
        >
          {t('local.dropCount', { count: hovering })}
        </div>
      </div>
    </div>
  );
});
