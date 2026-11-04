import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { chatBridge } from '../../../../lib/chat/bridge';
import type { UploadView } from '../../../../lib/chat/media-types';
import { useChatStore } from '../../../../stores/chat';
import { CircleAlert, RotateCcw } from './icons';
import { ProgressRing } from './ProgressRing';
import { albumProgress } from './upload-progress';

function retryFailed(uploads: UploadView[], onError: () => void) {
  const failed = uploads.filter((upload) => upload.state === 'failed');
  void Promise.all(failed.map((upload) => chatBridge.mediaUploadRetry(upload.id))).catch(onError);
}

export function uploadStatusShown(uploads: UploadView[]): boolean {
  const progress = albumProgress(uploads);
  return progress.failed > 0 || progress.done < progress.total;
}

export const UploadStatus = memo(function UploadStatus({ uploads }: { uploads: UploadView[] }) {
  const { t } = useTranslation();
  const online = useChatStore((state) => state.status?.online ?? true);
  const progress = albumProgress(uploads);

  if (progress.failed > 0) {
    return (
      <div
        data-ui="chat-album-status"
        role="status"
        className="flex items-center gap-1.5 pt-1.5 text-[11.5px] font-medium text-bad"
      >
        <CircleAlert size={13} className="shrink-0" />
        <span className="truncate">
          {t('chat.gallery.upload.failed', { count: progress.failed })}
        </span>
        <button
          type="button"
          onClick={() =>
            retryFailed(uploads, () => toast.error(t('chat.gallery.upload.errors.generic')))
          }
          className="ml-auto flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-ink/[0.07] px-2 text-[11px] font-semibold text-ink-80 transition-colors duration-150 hover:bg-ink/[0.12]"
        >
          <RotateCcw size={11} />
          {progress.failed > 1 ? t('chat.gallery.upload.retryAll') : t('chat.gallery.upload.retry')}
        </button>
      </div>
    );
  }

  if (progress.done >= progress.total) return null;

  return (
    <div
      data-ui="chat-album-status"
      role="status"
      className="flex items-center gap-1.5 pt-1.5 text-[11.5px] font-medium text-ink-55 tabular-nums"
    >
      <ProgressRing fraction={progress.fraction} waiting={!online} size={14} plain />
      <span className="truncate">
        {online
          ? t('chat.gallery.upload.sending', { done: progress.done, total: progress.total })
          : t('chat.gallery.upload.waiting')}
      </span>
      {online && (
        <span aria-hidden className="ml-auto shrink-0 text-ink-40">
          {Math.round(progress.fraction * 100)}%
        </span>
      )}
    </div>
  );
});
