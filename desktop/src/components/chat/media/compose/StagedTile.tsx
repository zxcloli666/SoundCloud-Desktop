import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadView } from '../../../../lib/chat/media-types';
import { Check, RotateCcw, TriangleAlert, X } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { failureOf } from './failure';
import { FADE, LIFT, POP } from './motion';
import { ProgressRing } from './ProgressRing';
import { isDone, uploadFraction } from './progress';
import { UploadThumb } from './UploadThumb';

export const TILE = 64;

export const StagedTile = memo(function StagedTile({
  upload,
  locked,
  onRemove,
  onFail,
}: {
  upload: UploadView;
  locked: boolean;
  onRemove: (upload: UploadView) => void;
  onFail: (error: unknown) => void;
}) {
  const perf = usePerfMode();
  const { t } = useTranslation();
  const error = useChatMediaStore((state) => state.errors[upload.id]);
  const failed = upload.state === 'failed';
  const done = isDone(upload);
  const waiting = upload.state === 'queued' || upload.state === 'reserved';
  const failure = failed ? failureOf(error, t) : null;
  const reason = failure?.text;

  return (
    <div
      data-ui="chat-staged-tile"
      data-state={upload.state}
      title={reason}
      className={`group/tile relative shrink-0 ${POP}`}
      style={{ width: TILE, height: TILE }}
    >
      <UploadThumb upload={upload} size={TILE} radius={14} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[14px] border"
        style={{
          borderColor: failed ? 'rgb(var(--bad) / 0.8)' : 'rgb(var(--ink) / 0.08)',
        }}
      />
      {!done && (
        <span
          data-scheme="dark"
          className="absolute inset-0 flex items-center justify-center rounded-[14px] transition-opacity duration-300"
          style={{ background: failed ? 'rgb(var(--shade) / 0.62)' : 'rgb(var(--shade) / 0.42)' }}
        >
          {failure?.action === 'none' ? (
            <TriangleAlert size={18} className="text-ink" />
          ) : failed ? (
            <button
              type="button"
              aria-label={t('chat.media.compose.retry')}
              onClick={() => void useChatMediaStore.getState().retryUpload(upload.id).catch(onFail)}
              className={`flex size-8 cursor-pointer items-center justify-center rounded-full bg-ink/[0.16] text-ink hover:scale-110 motion-reduce:hover:scale-100 ${LIFT} focus-visible:ring-2 focus-visible:ring-ink/60`}
            >
              <RotateCcw size={15} />
            </button>
          ) : (
            <ProgressRing
              value={uploadFraction(upload)}
              size={28}
              still={!perf.idleAnim}
              waiting={waiting}
              tone="rgb(var(--ink))"
            />
          )}
        </span>
      )}
      {done && (
        <span
          aria-hidden
          className={`absolute bottom-1 left-1 flex size-[18px] items-center justify-center rounded-full ${POP}`}
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
        >
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      <button
        type="button"
        aria-label={t('chat.media.compose.remove')}
        disabled={locked}
        onClick={() => onRemove(upload)}
        data-scheme="dark"
        className="absolute -top-1.5 -right-1.5 flex size-[22px] cursor-pointer items-center justify-center rounded-full border border-ink/20 text-ink opacity-0 transition-opacity duration-150 group-hover/tile:opacity-100 focus-visible:opacity-100 disabled:cursor-progress"
        style={{ background: 'rgb(var(--shade) / 0.78)' }}
      >
        <X size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
});

export const PreparingTile = memo(function PreparingTile() {
  const perf = usePerfMode();
  return (
    <span
      aria-hidden
      className={`relative shrink-0 overflow-hidden rounded-[14px] bg-ink/[0.07] ${FADE}`}
      style={{ width: TILE, height: TILE }}
    >
      {perf.idleAnim && (
        <span className="absolute inset-0 animate-pulse bg-ink/[0.06] motion-reduce:animate-none" />
      )}
    </span>
  );
});
