import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvId } from '../../../../lib/chat/types';
import { ImageIcon, TriangleAlert } from '../../../../lib/icons';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { uploadStatus } from './photo-state';
import { uploadPercent } from './upload';
import { useBackdropUpload } from './useBackdropUpload';

export const UploadChip = memo(function UploadChip({
  conversationId,
}: {
  conversationId: ConvId | null;
}) {
  const { t } = useTranslation();
  const { upload, error } = useBackdropUpload(conversationId);
  const open = useBackdropStore((state) => state.open);
  const status = uploadStatus(upload, error);
  if (!status) return null;
  const failed = status.kind === 'failed';
  const percent = status.kind === 'active' ? uploadPercent(status.upload) : 0;
  return (
    <div className="pointer-events-none absolute top-2 right-3 z-10 flex justify-end">
      <button
        type="button"
        onClick={() => open('picker')}
        className={`chat-motion pointer-events-auto relative flex cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60 items-center gap-1.5 overflow-hidden rounded-full border py-1 pr-3 pl-2 text-[11.5px] font-semibold shadow-[0_8px_24px_rgb(var(--shade)/calc(0.35*var(--shade-alpha)))] animate-[room-drop_0.4s_var(--ease-apple)_both] ${
          failed ? 'border-bad/30 bg-surface text-bad' : 'border-ink/[0.1] bg-surface text-ink-80'
        }`}
      >
        {!failed && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-accent/15 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        )}
        {failed ? (
          <TriangleAlert size={12} className="relative" />
        ) : (
          <ImageIcon size={12} className="relative text-accent" />
        )}
        <span className="relative tabular-nums">
          {failed ? t('chat.backdrop.chipFailed') : t('chat.backdrop.chip', { percent })}
        </span>
      </button>
    </div>
  );
});
