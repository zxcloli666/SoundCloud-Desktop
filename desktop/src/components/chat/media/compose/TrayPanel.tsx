import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, TriangleAlert } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { toastError } from '../../thread/errors';
import { ProgressRing } from './ProgressRing';
import { albumFraction } from './progress';
import { TrayRow } from './TrayRow';
import type { TrayWork } from './tray-scope';

export const TrayPanel = memo(function TrayPanel({
  work,
  showChat,
  place,
}: {
  work: TrayWork;
  showChat: boolean;
  place: 'thread' | 'dock';
}) {
  const { t, i18n } = useTranslation();
  const perf = usePerfMode();
  const blur = perf.blur(24);
  const [open, setOpen] = useState(false);
  const total = work.rows.length;

  useEffect(() => {
    if (total === 0) setOpen(false);
  }, [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (total === 0) return null;
  const fail = (error: unknown) => toastError(error, t, i18n.language);
  const failed = work.failed > 0;
  const glass = {
    background: blur ? 'rgb(var(--surface) / 0.82)' : 'rgb(var(--surface) / 0.97)',
    backdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
    WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
    boxShadow: '0 14px 40px -18px rgb(var(--shade) / calc(0.8 * var(--shade-alpha)))',
  };

  return (
    <div
      data-ui="chat-upload-tray"
      data-place={place}
      className={`pointer-events-none z-30 h-0 ${place === 'dock' ? 'absolute inset-x-0 bottom-3' : 'relative'}`}
    >
      <div className="absolute inset-x-0 bottom-1.5 flex flex-col items-center gap-1.5 px-3">
        {open && (
          <div
            className="pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-[18px] border border-ink/[0.08] p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
            style={glass}
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
              <span className="text-[11.5px] font-semibold text-ink-70">
                {t('chat.media.rows.title')}
              </span>
              <span className="font-mono text-[10.5px] tabular-nums text-ink-40">
                {work.done}/{total}
              </span>
            </div>
            <ul className="max-h-[260px] overflow-y-auto">
              {work.rows.map((upload) => (
                <TrayRow key={upload.id} upload={upload} showChat={showChat} onFail={fail} />
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-2.5 pl-1.5 text-[11.5px] font-medium text-ink-80 transition-transform duration-200 animate-in fade-in slide-in-from-bottom-1 hover:-translate-y-px motion-reduce:animate-none"
          style={{
            ...glass,
            borderColor: failed ? 'rgb(var(--bad) / 0.45)' : 'rgb(var(--ink) / 0.09)',
          }}
        >
          {failed ? (
            <span className="flex size-5 items-center justify-center text-bad">
              <TriangleAlert size={14} />
            </span>
          ) : (
            <ProgressRing value={albumFraction(work.rows)} size={20} stroke={2.5} />
          )}
          <span className="tabular-nums">
            {t('chat.media.tray.sending', { done: work.done, total })}
          </span>
          {failed && (
            <span className="text-bad">
              {t('chat.media.rows.failedCount', { count: work.failed })}
            </span>
          )}
          {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>
    </div>
  );
});
