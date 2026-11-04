import { memo, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../../../lib/perf';
import { isMac } from '../../../../lib/platform';
import { MomentCard } from '../../../star-moments/MomentCard';
import { StarCta } from '../../../star-moments/StarCta';
import { shortcutLabel } from './failure';
import { PreviewAlbum } from './PreviewAlbum';
import { PreviewCovers } from './PreviewCovers';
import { PreviewQuota } from './PreviewQuota';
import { PREVIEW_KEYFRAMES } from './preview-keyframes';

function Perk({ art, title, hint }: { art: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-[58px] shrink-0 justify-center text-ink-85">{art}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-ink-90">{title}</span>
        <span className="block text-[11.5px] leading-snug text-ink-45">{hint}</span>
      </span>
    </div>
  );
}

export const StarPreview = memo(function StarPreview({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <MomentCard onClose={onClose}>
      <style>{PREVIEW_KEYFRAMES}</style>
      <div
        data-ui="chat-media-star-preview"
        data-preview-still={perf.idleAnim ? undefined : ''}
        className="flex flex-col gap-3"
      >
        <div className="pr-7 text-[14px] font-bold tracking-tight text-ink-95">
          {t('chat.media.preview.title')}
        </div>
        <PreviewAlbum caption={t('chat.media.preview.caption')} />
        <Perk
          art={<PreviewQuota />}
          title={t('chat.media.preview.quota')}
          hint={t('chat.media.preview.quotaHint')}
        />
        <Perk
          art={<PreviewCovers />}
          title={t('chat.media.preview.covers')}
          hint={t('chat.media.preview.coversHint')}
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-ink-40">
            {t('chat.media.preview.albumHint', { key: shortcutLabel(isMac()) })}
          </span>
          <StarCta onOpen={onClose} />
        </div>
      </div>
    </MomentCard>,
    document.body,
  );
});
