import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { Message } from '../../../../lib/chat/types';
import { useChatStore } from '../../../../stores/chat';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { StarCta } from '../../../star-moments/StarCta';
import { failureOf, notifyFailure } from '../compose/failure';
import { DiscardPost } from './DiscardPost';
import { CircleAlert, HardDrive, RotateCcw } from './icons';
import { ProgressRing } from './ProgressRing';
import { albumProgress } from './upload-progress';

const PILL =
  'flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-ink/[0.07] px-2 text-[11px] font-semibold text-ink-80 transition-colors duration-150 hover:bg-ink/[0.12] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]';

export function uploadStatusShown(uploads: UploadView[]): boolean {
  const progress = albumProgress(uploads);
  return progress.failed > 0 || progress.done < progress.total;
}

const FailedStatus = memo(function FailedStatus({
  uploads,
  message,
  count,
}: {
  uploads: UploadView[];
  message: Message;
  count: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const failed = uploads.filter((upload) => upload.state === 'failed');
  const first = failed[0]?.id;
  const error = useChatMediaStore((state) => (first ? state.errors[first] : undefined));
  const failure = failureOf(error, t);
  const retry = () =>
    void useChatMediaStore
      .getState()
      .retryUploads(failed.map((upload) => upload.id))
      .catch((problem) => notifyFailure(problem, t));
  const retryLabel = count > 1 ? t('chat.gallery.upload.retryAll') : t('chat.gallery.upload.retry');

  return (
    <div data-ui="chat-album-status" role="status" className="flex flex-col gap-1 pt-1.5">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-bad">
        <CircleAlert size={13} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {t('chat.gallery.upload.failed', { count })}
        </span>
      </div>
      <p className="text-[11.5px] leading-snug text-ink-55">{failure.text}</p>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <DiscardPost message={message} />
        {failure.action === 'star' && <StarCta size="sm" />}
        {failure.action === 'storage' && (
          <button type="button" onClick={() => navigate('/chats/storage')} className={PILL}>
            <HardDrive size={11} />
            {t('chat.media.rows.storage')}
          </button>
        )}
        {failure.action !== 'none' && (
          <button
            type="button"
            aria-label={t('chat.gallery.upload.retryReason', { reason: failure.text })}
            onClick={retry}
            className={PILL}
          >
            <RotateCcw size={11} />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
});

export const UploadStatus = memo(function UploadStatus({
  uploads,
  message,
}: {
  uploads: UploadView[];
  message: Message;
}) {
  const { t } = useTranslation();
  const online = useChatStore((state) => state.status?.online ?? true);
  const progress = albumProgress(uploads);

  if (progress.failed > 0) {
    return <FailedStatus uploads={uploads} message={message} count={progress.failed} />;
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
