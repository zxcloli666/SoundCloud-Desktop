import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupAvatarUrl } from '../../../../lib/chat/avatar-url';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConversationSummary } from '../../../../lib/chat/types';
import { Pause, Pencil, RotateCcw, Users, X } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { useChatStore } from '../../../../stores/chat';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { Avatar } from '../../../ui/Avatar';
import { canManageMembers } from '../../thread/permissions';
import { clearAvatar, pickAvatar } from './avatar-actions';
import { failureOf, notifyFailure } from './failure';
import { GroupPhoto } from './GroupPhoto';
import { ProgressRing } from './ProgressRing';
import { uploadFraction } from './progress';
import { StarPreview } from './StarPreview';
import { UploadThumb } from './UploadThumb';

const SIZE = 72;

function Placeholder() {
  return (
    <span className="flex size-[72px] items-center justify-center rounded-full bg-ink/[0.07] text-ink-45">
      <Users size={28} />
    </span>
  );
}

function useAvatarUpload(conversationId: string): UploadView | null {
  return useChatMediaStore(
    (state) =>
      state.uploads
        .filter((upload) => upload.conversationId === conversationId && upload.kind === 'avatar')
        .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null,
  );
}

export const GroupAvatarEdit = memo(function GroupAvatarEdit({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const media = useChatStore((state) => state.config?.media ?? null);
  const upload = useAvatarUpload(conversation.id);
  const error = useChatMediaStore((state) => (upload ? state.errors[upload.id] : undefined));
  const [preview, setPreview] = useState(false);
  const photo = groupAvatarUrl(conversation);
  const legacy = conversation.avatarUrl;
  const admin = canManageMembers(conversation) && media !== null;
  const paused = media?.star === true && !media.uploads;
  const failed = upload?.state === 'failed';
  const waiting = upload?.state === 'queued' || upload?.state === 'reserved';

  const pick = () => {
    if (!media || paused) return;
    if (!media.star) {
      setPreview(true);
      return;
    }
    pickAvatar(conversation.id, t).catch((error) => notifyFailure(error, t));
  };

  const face = upload ? (
    <span className="relative block">
      <UploadThumb upload={upload} size={SIZE} radius={SIZE / 2} />
      <span
        data-scheme="dark"
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: failed ? 'rgb(var(--shade) / 0.6)' : 'rgb(var(--shade) / 0.35)' }}
      >
        {failed ? (
          <RotateCcw size={20} className="text-ink" />
        ) : (
          <ProgressRing
            still={!perf.idleAnim}
            value={uploadFraction(upload)}
            size={SIZE - 8}
            stroke={3}
            waiting={waiting}
            tone="rgb(var(--ink))"
          />
        )}
      </span>
    </span>
  ) : photo ? (
    <GroupPhoto src={photo} size={SIZE} fallback={<Placeholder />} />
  ) : legacy ? (
    <Avatar src={legacy} size={SIZE} />
  ) : (
    <Placeholder />
  );

  if (!admin) return face;

  const busy = (upload !== null && !failed) || paused;
  const label = upload
    ? failed
      ? t('chat.media.compose.retry')
      : t('chat.media.avatar.uploading')
    : photo
      ? t('chat.media.avatar.change')
      : t('chat.media.avatar.set');

  return (
    <div data-ui="chat-group-avatar" className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        title={
          failed ? failureOf(error, t).text : paused ? t('chat.media.gate.pausedTitle') : label
        }
        disabled={busy}
        onClick={() =>
          failed && upload
            ? void useChatMediaStore
                .getState()
                .retryUpload(upload.id)
                .catch(() => undefined)
            : pick()
        }
        className={`group/avatar relative rounded-full transition-transform duration-200 enabled:hover:scale-[1.03] ${paused ? 'cursor-default' : 'cursor-pointer disabled:cursor-progress'}`}
      >
        {face}
        {!upload && (
          <span
            className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border-2 transition-transform duration-150 group-hover/avatar:scale-110"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-contrast)',
              borderColor: 'rgb(var(--surface))',
            }}
          >
            {paused ? <Pause size={10} /> : <Pencil size={11} />}
          </span>
        )}
      </button>
      {paused && !upload && (
        <span className="text-[11px] text-ink-40">{t('chat.media.gate.pausedTitle')}</span>
      )}
      {preview && <StarPreview onClose={() => setPreview(false)} />}
      {failed && upload && (
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="text-bad">{t('chat.media.avatar.failed')}</span>
          <button
            type="button"
            aria-label={t('chat.media.tray.cancel')}
            onClick={() =>
              void useChatMediaStore
                .getState()
                .cancelUpload(upload.id)
                .catch(() => undefined)
            }
            className="flex size-5 cursor-pointer items-center justify-center rounded-full text-ink-40 hover:bg-ink/[0.07] hover:text-ink-80"
          >
            <X size={11} />
          </button>
        </span>
      )}
      {!upload && (photo || legacy) && (
        <button
          type="button"
          onClick={() => void clearAvatar(conversation.id, t)}
          className="cursor-pointer rounded-full px-2 py-0.5 text-[11px] text-ink-40 transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink-75"
        >
          {t('chat.media.avatar.clear')}
        </button>
      )}
    </div>
  );
});
