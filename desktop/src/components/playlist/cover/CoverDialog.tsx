import * as Slider from '@radix-ui/react-slider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type CoverFrame, maxZoom, zoomFrame, zoomOf } from '../../../lib/cover-crop';
import { ImagePlus, Loader2, TriangleAlert, ZoomIn, ZoomOut } from '../../../lib/icons';
import type { CoverSource } from '../../../lib/playlist-artwork';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { CoverStage } from './CoverStage';

export type CoverDraft =
  | { kind: 'loading' }
  | { kind: 'problem'; error: string }
  | { kind: 'ready'; source: CoverSource; frame: CoverFrame };

const PLACE =
  'flex aspect-square w-[min(300px,72vw)] flex-col items-center justify-center gap-3 rounded-[1.7rem] px-6 text-center';

function Placeholder({ draft, onPick }: { draft: CoverDraft; onPick: () => void }) {
  const { t } = useTranslation();
  if (draft.kind === 'loading') {
    return (
      <div className={PLACE} style={{ background: 'rgb(var(--ink) / 0.04)' }}>
        <Loader2 size={26} className="animate-spin text-ink-30 motion-reduce:animate-none" />
      </div>
    );
  }
  if (draft.kind !== 'problem') return null;
  return (
    <div
      className={PLACE}
      style={{ background: 'rgb(var(--ink) / 0.04)', border: '1px dashed rgb(var(--ink) / 0.12)' }}
    >
      <TriangleAlert size={26} className="text-bad" />
      <span className="text-[13px] font-semibold text-ink-80">{t(draft.error)}</span>
      <button
        type="button"
        onClick={onPick}
        className="mt-1 inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-[12.5px] font-semibold text-accent-contrast transition-all hover:bg-accent-hover active:scale-[0.97] cursor-pointer"
      >
        <ImagePlus size={15} />
        {t('playlist.cover.pickAnother')}
      </button>
    </div>
  );
}

function ZoomRow({
  draft,
  onFrame,
}: {
  draft: Extract<CoverDraft, { kind: 'ready' }>;
  onFrame: (frame: CoverFrame) => void;
}) {
  const { t } = useTranslation();
  const { size } = draft.source;
  const top = maxZoom(size);
  return (
    <div className="flex w-[min(300px,72vw)] items-center gap-3 text-ink-40">
      <ZoomOut size={15} aria-hidden />
      <Slider.Root
        className="relative flex h-5 grow cursor-pointer select-none touch-none items-center data-[disabled]:cursor-default data-[disabled]:opacity-40"
        aria-label={t('playlist.cover.zoom')}
        value={[zoomOf(draft.frame, size)]}
        min={1}
        max={top}
        step={0.01}
        disabled={top <= 1}
        onValueChange={([zoom]) => onFrame(zoomFrame(draft.frame, zoom, size))}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-ink/[0.1]">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-3.5 w-3.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] outline-none transition-transform duration-150 hover:scale-110 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-accent/50 motion-reduce:transition-none" />
      </Slider.Root>
      <ZoomIn size={15} aria-hidden />
    </div>
  );
}

export const CoverDialog = React.memo(function CoverDialog({
  open,
  draft,
  onOpenChange,
  onPick,
  onFrame,
  onSave,
}: {
  open: boolean;
  draft: CoverDraft;
  onOpenChange: (open: boolean) => void;
  onPick: () => void;
  onFrame: (frame: CoverFrame) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const ready = draft.kind === 'ready';
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm">
        <div
          data-ui="playlist-cover-editor"
          className="flex flex-col items-center gap-5 px-6 pb-6 pt-7"
        >
          <ModalTitle className="self-start text-[15px] font-bold text-ink-90">
            {t('playlist.cover.title')}
          </ModalTitle>
          {ready ? (
            <CoverStage
              source={draft.source}
              frame={draft.frame}
              label={t('playlist.cover.crop')}
              onFrame={onFrame}
              onSubmit={onSave}
            />
          ) : (
            <Placeholder draft={draft} onPick={onPick} />
          )}
          {ready && <ZoomRow draft={draft} onFrame={onFrame} />}
          <div className="flex w-full items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onPick}
              className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-ink-60 transition-all hover:bg-ink/[0.06] hover:text-ink-90 cursor-pointer"
            >
              <ImagePlus size={15} />
              {t('playlist.cover.replace')}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ml-auto h-9 rounded-xl px-4 text-[13px] font-medium text-ink-50 transition-all hover:bg-ink/[0.06] hover:text-ink-80 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={onSave}
              className="h-9 rounded-xl bg-accent px-4 text-[13px] font-semibold text-accent-contrast transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {t('playlist.save')}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
});
