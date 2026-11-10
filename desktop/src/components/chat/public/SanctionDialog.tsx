import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PUBLIC_REASON_MAX, type UserRef } from '../../../lib/chat/types';
import { Ban } from '../../../lib/icons';
import { Avatar } from '../../ui/Avatar';
import { ModalTitle } from '../../ui/Modal';
import { MicOff } from '../room/icons';
import { banUser, durationLabel, muteUser } from './actions';

const BUTTON =
  'flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-colors duration-200 disabled:cursor-default disabled:opacity-50';

export type Sanction = { kind: 'mute'; seconds: number } | { kind: 'ban' };

export const SanctionDialog = memo(function SanctionDialog({
  user,
  sanction,
  onClose,
}: {
  user: UserRef;
  sanction: Sanction;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const mute = sanction.kind === 'mute';
  const trimmed = reason.trim();
  const tooLong = trimmed.length > PUBLIC_REASON_MAX;

  const apply = async () => {
    setBusy(true);
    const note = trimmed ? trimmed : null;
    const done = mute ? await muteUser(user, sanction.seconds, note) : await banUser(user, note);
    setBusy(false);
    if (done) onClose();
  };

  return (
    <div
      data-ui="chat-public-sanction-dialog"
      data-kind={sanction.kind}
      className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center"
    >
      <div className="relative">
        <Avatar src={user.avatarUrl} size={56} />
        <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/90 text-white">
          {mute ? <MicOff size={12} /> : <Ban size={12} />}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <ModalTitle>
          {t(mute ? 'chat.public.dialog.muteTitle' : 'chat.public.dialog.banTitle', {
            name: user.name,
          })}
        </ModalTitle>
        {mute && (
          <span className="text-[13px] font-semibold text-rose-200/90">
            {durationLabel(sanction.seconds)}
          </span>
        )}
      </div>
      <label className="flex w-full flex-col gap-1 text-left">
        <textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!busy && !tooLong) void apply();
            }
          }}
          placeholder={t('chat.public.dialog.reason')}
          className="w-full resize-none rounded-xl border border-ink/[0.07] bg-shade-20 px-3 py-2 text-[13px] text-ink-90 outline-none placeholder:text-ink-30 focus:border-ink/[0.16]"
        />
        <span
          className={`self-end text-[10.5px] tabular-nums ${tooLong ? 'text-rose-300' : 'text-ink-30'}`}
        >
          {trimmed.length}/{PUBLIC_REASON_MAX}
        </span>
      </label>
      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          disabled={busy || tooLong}
          onClick={() => void apply()}
          className={`${BUTTON} bg-rose-500/85 text-white hover:bg-rose-500`}
        >
          {mute ? <MicOff size={15} /> : <Ban size={15} />}
          {t(mute ? 'chat.public.dialog.mute' : 'chat.public.dialog.ban')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${BUTTON} bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1]`}
        >
          {t('chat.thread.cancel')}
        </button>
      </div>
    </div>
  );
});
