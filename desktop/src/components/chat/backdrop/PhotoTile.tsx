import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadView } from '../../../lib/chat/media-types';
import { ImageIcon, RotateCcw, Upload } from '../../../lib/icons';
import { clock } from './countdown';
import { Tile } from './Tile';
import { uploadPercent } from './upload';

export type PhotoState =
  | { kind: 'idle' }
  | { kind: 'current'; src: string }
  | { kind: 'uploading'; upload: UploadView | null }
  | { kind: 'failed' }
  | { kind: 'cooldown'; leftMs: number };

function Ring({ percent }: { percent: number }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3" className="stroke-ink/15" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-accent transition-[stroke-dashoffset] duration-300"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - Math.max(0.04, percent / 100))}
      />
    </svg>
  );
}

function Body({ state }: { state: PhotoState }) {
  const { t } = useTranslation();
  if (state.kind === 'uploading') {
    const percent = uploadPercent(state.upload);
    return (
      <>
        <Ring percent={percent} />
        <span className="text-[11px] font-semibold tabular-nums text-ink-80">
          {t('chat.backdrop.percent', { percent })}
        </span>
      </>
    );
  }
  if (state.kind === 'failed') {
    return (
      <>
        <RotateCcw size={16} className="text-bad" />
        <span className="text-[11px] font-semibold text-ink-80">{t('chat.backdrop.retry')}</span>
      </>
    );
  }
  if (state.kind === 'cooldown') {
    return (
      <>
        <ImageIcon size={16} className="text-ink-40" />
        <span className="text-[11px] font-semibold tabular-nums text-ink-60">
          {clock(state.leftMs)}
        </span>
      </>
    );
  }
  return (
    <>
      <Upload size={16} className="text-ink-60" />
      <span className="text-[11px] font-semibold text-ink-80">{t('chat.backdrop.photo')}</span>
    </>
  );
}

export const PHOTO_TILE = '[data-ui="chat-backdrop-photo"]';

export const PhotoTile = memo(function PhotoTile({
  state,
  current,
  disabled,
  starred = false,
  onPick,
  onFocus,
}: {
  state: PhotoState;
  current: boolean;
  disabled: boolean;
  starred?: boolean;
  onPick: () => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const label =
    state.kind === 'cooldown'
      ? t('chat.backdrop.photoIn', { time: clock(state.leftMs) })
      : t('chat.backdrop.photo');
  return (
    <Tile
      label={label}
      ui="chat-backdrop-photo"
      current={current}
      pending={false}
      disabled={disabled}
      starred={starred}
      onPick={onPick}
      onFocus={onFocus}
    >
      <span className="absolute inset-0 rounded-xl border border-dashed border-ink/20 bg-ink/[0.03]" />
      {state.kind === 'current' && (
        <img
          src={state.src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
      )}
      {state.kind === 'current' && <span className="absolute inset-0 bg-shade-30" />}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <Body state={state} />
      </span>
    </Tile>
  );
});
