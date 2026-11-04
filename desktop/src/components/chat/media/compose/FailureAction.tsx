import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { UploadView } from '../../../../lib/chat/media-types';
import { Clock, HardDrive, RotateCcw } from '../../../../lib/icons';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { StarCta } from '../../../star-moments/StarCta';
import { type Failure, notifyFailure } from './failure';

const BUTTON =
  'flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-80 bg-ink/[0.07] transition-colors duration-150 hover:bg-ink/[0.12] hover:text-ink';

export const FailureAction = memo(function FailureAction({
  failure,
  upload,
}: {
  failure: Failure;
  upload: UploadView;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (failure.action === 'none') return null;
  if (failure.action === 'star') return <StarCta size="sm" />;
  if (failure.action === 'storage') {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button type="button" className={BUTTON} onClick={() => navigate('/chats/storage')}>
          <HardDrive size={11} />
          {t('chat.media.rows.storage')}
        </button>
        <RetryButton upload={upload} label={t('chat.media.compose.retry')} bare />
      </span>
    );
  }
  if (failure.action === 'wait' && upload.state !== 'failed') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-40">
        <Clock size={11} />
        {t('chat.media.compose.waiting')}
      </span>
    );
  }
  return <RetryButton upload={upload} label={t('chat.media.compose.retry')} />;
});

function RetryButton({
  upload,
  label,
  bare,
}: {
  upload: UploadView;
  label: string;
  bare?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={bare ? `${BUTTON} px-1.5` : BUTTON}
      onClick={() =>
        void useChatMediaStore
          .getState()
          .retryUpload(upload.id)
          .catch((error) => notifyFailure(error, t))
      }
    >
      <RotateCcw size={11} />
      {!bare && label}
    </button>
  );
}
