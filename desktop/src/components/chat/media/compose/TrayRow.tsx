import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadView } from '../../../../lib/chat/media-types';
import { conversationTitle } from '../../../../lib/chat/render';
import { X } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { useChatListStore } from '../../../../stores/chat/list';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { FailureAction } from './FailureAction';
import { failureOf } from './failure';
import { ProgressRing } from './ProgressRing';
import { isDone, uploadFraction } from './progress';
import { UploadThumb } from './UploadThumb';
import { useUploadActions } from './useUploadActions';

export const TrayRow = memo(function TrayRow({
  upload,
  showChat,
  onFail,
}: {
  upload: UploadView;
  showChat: boolean;
  onFail: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const actionable = useUploadActions();
  const error = useChatMediaStore((state) => state.errors[upload.id]);
  const chat = useChatListStore((state) => state.byId[upload.conversationId]);
  const done = isDone(upload);
  const failed = upload.state === 'failed';
  const waiting = upload.state === 'queued' || upload.state === 'reserved';
  const failure = failed || (waiting && error) ? failureOf(error, t) : null;
  const percent = Math.round(uploadFraction(upload) * 100);
  const kind = t(upload.kind === 'avatar' ? 'chat.media.rows.avatar' : 'chat.media.rows.image');
  const title = showChat && chat ? conversationTitle(chat, t) : kind;

  let status = `${percent}%`;
  if (done) status = t('chat.media.rows.done');
  else if (failure) status = failure.text;
  else if (waiting) status = t('chat.media.rows.queued');

  return (
    <li
      data-ui="chat-upload-row"
      data-state={upload.state}
      className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 transition-colors duration-150 hover:bg-ink/[0.04]"
    >
      <span className="relative shrink-0">
        <UploadThumb upload={upload} size={36} radius={upload.kind === 'avatar' ? 18 : 9} />
        {!done && !failed && (
          <span
            data-scheme="dark"
            className="absolute inset-0 flex items-center justify-center rounded-[9px]"
            style={{ background: 'rgb(var(--shade) / 0.4)' }}
          >
            <ProgressRing
              value={uploadFraction(upload)}
              size={20}
              stroke={2.5}
              waiting={waiting}
              still={!perf.idleAnim}
              tone="rgb(var(--ink))"
            />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-ink-85">{title}</span>
        <span
          className={`block truncate text-[11px] tabular-nums ${failed ? 'text-bad' : 'text-ink-40'}`}
          title={failure?.text}
        >
          {showChat && chat ? `${kind} · ${status}` : status}
        </span>
      </span>
      {failure && <FailureAction failure={failure} upload={upload} />}
      {!done && (
        <button
          type="button"
          aria-label={t('chat.media.tray.cancel')}
          title={t('chat.media.tray.cancel')}
          disabled={!actionable}
          onClick={() => void useChatMediaStore.getState().cancelUpload(upload.id).catch(onFail)}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-35 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-ink-80 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-35"
        >
          <X size={13} />
        </button>
      )}
    </li>
  );
});
