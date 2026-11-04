import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupAvatarUrl } from '../../../../lib/chat/avatar-url';
import type { ConversationSummary } from '../../../../lib/chat/types';
import { Pause, Pencil, X } from '../../../../lib/icons';
import { useChatStore } from '../../../../stores/chat';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { canManageMembers } from '../../thread/permissions';
import { clearAvatar, pickAvatar } from './avatar-actions';
import { FailureAction } from './FailureAction';
import { failureOf, notifyFailure } from './failure';
import { GroupAvatarFace } from './GroupAvatarFace';
import { LIFT } from './motion';
import { StarPreview } from './StarPreview';
import { useAvatarWork } from './useAvatarWork';

export const GroupAvatarEdit = memo(function GroupAvatarEdit({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const { t } = useTranslation();
  const media = useChatStore((state) => state.config?.media ?? null);
  const photo = groupAvatarUrl(conversation);
  const legacy = conversation.avatarUrl;
  const { upload, error, applying, cancel } = useAvatarWork(conversation.id, photo, t);
  const [preview, setPreview] = useState(false);
  const [clearing, setClearing] = useState(false);
  const admin = canManageMembers(conversation) && media !== null;
  const paused = media?.star === true && !media.uploads;
  const failed = upload?.state === 'failed';
  const failure = failed ? failureOf(error, t) : null;
  const face = (
    <GroupAvatarFace upload={upload} applying={applying} photo={photo} legacy={legacy} />
  );

  if (!admin) return face;

  const fail = (reason: unknown) => notifyFailure(reason, t);
  const pick = () => {
    if (!media || paused) return;
    if (!media.star) {
      setPreview(true);
      return;
    }
    pickAvatar(conversation.id, t).catch(fail);
  };
  const retry = () => {
    if (!upload || failure?.action !== 'retry') return;
    void useChatMediaStore.getState().retryUpload(upload.id).catch(fail);
  };
  const clear = () => {
    if (clearing) return;
    setClearing(true);
    void clearAvatar(conversation.id, t).finally(() => setClearing(false));
  };

  const idle = !upload && !applying;
  const busy = !idle || paused || clearing;
  let label = t(photo ? 'chat.media.avatar.change' : 'chat.media.avatar.set');
  if (!idle) label = t(failed ? 'chat.media.avatar.failed' : 'chat.media.avatar.uploading');
  if (paused && idle) label = t('chat.media.gate.pausedTitle');

  return (
    <div data-ui="chat-group-avatar" className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        title={failure?.text ?? label}
        disabled={busy && !(failed && failure?.action === 'retry')}
        onClick={failed ? retry : pick}
        className={`group/avatar relative rounded-full enabled:hover:scale-[1.03] motion-reduce:enabled:hover:scale-100 ${LIFT} ${busy && !failed ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {face}
        {idle && (
          <span
            className={`absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border-2 group-hover/avatar:scale-110 motion-reduce:group-hover/avatar:scale-100 ${LIFT}`}
            style={{
              background: paused ? 'rgb(var(--ink) / 0.18)' : 'var(--color-accent)',
              color: paused ? 'rgb(var(--ink) / 0.8)' : 'var(--color-accent-contrast)',
              borderColor: 'rgb(var(--surface))',
            }}
          >
            {paused ? <Pause size={10} /> : <Pencil size={11} />}
          </span>
        )}
      </button>
      {paused && idle && (
        <span className="text-[11px] text-ink-40">{t('chat.media.gate.pausedTitle')}</span>
      )}
      {preview && <StarPreview onClose={() => setPreview(false)} />}
      {failed && upload && failure && (
        <span className="flex max-w-[260px] items-center gap-1.5 text-[11px]">
          <span className="min-w-0 truncate text-bad" title={failure.text}>
            {failure.text}
          </span>
          <FailureAction failure={failure} upload={upload} />
          <button
            type="button"
            aria-label={t('chat.media.tray.cancel')}
            title={t('chat.media.tray.cancel')}
            onClick={() => void cancel().catch(fail)}
            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-40 hover:bg-ink/[0.07] hover:text-ink-80"
          >
            <X size={11} />
          </button>
        </span>
      )}
      {idle && (photo || legacy) && (
        <button
          type="button"
          disabled={clearing}
          onClick={clear}
          className="cursor-pointer rounded-full px-2 py-0.5 text-[11px] text-ink-40 transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink-75 disabled:cursor-progress disabled:opacity-50"
        >
          {t('chat.media.avatar.clear')}
        </button>
      )}
    </div>
  );
});
