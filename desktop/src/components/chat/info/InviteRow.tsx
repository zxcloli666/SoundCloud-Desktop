import { memo, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { timeLeft } from '../../../lib/chat/time';
import type { Invite } from '../../../lib/chat/types';
import { Check, Clock, Copy, LinkIcon, Loader2, Trash2 } from '../../../lib/icons';
import { useThread } from '../thread/context';
import { toastError } from '../thread/errors';

const COPIED_MS = 1_600;
const ROW =
  'flex w-full items-center gap-2.5 rounded-2xl border border-ink/[0.06] bg-ink/[0.025] px-3 py-2.5';

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-50 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-white"
    >
      {children}
    </button>
  );
}

export const InviteRow = memo(function InviteRow() {
  const { t, i18n } = useTranslation();
  const { conversation } = useThread();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fail = (error: unknown) => toastError(error, t, i18n.language);

  const create = async () => {
    setBusy(true);
    try {
      setInvite(await chatBridge.inviteCreate(conversation.id, {}));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: string) => {
    try {
      await chatBridge.inviteRevoke(token);
      setInvite(null);
    } catch (error) {
      fail(error);
    }
  };

  const copy = (url: string) => {
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch(fail);
  };

  if (!invite) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void create()}
        className={`${ROW} cursor-pointer text-left transition-colors duration-150 hover:bg-ink/[0.045] disabled:opacity-60`}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-ink/[0.06] text-ink-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-ink-85">
          {t('chat.thread.info.inviteLink')}
        </span>
      </button>
    );
  }

  return (
    <div className={ROW}>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
      >
        <LinkIcon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="selectable block truncate font-mono text-[11.5px] text-ink-80">
          {invite.url}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-40">
          <Clock size={10} className="shrink-0" />
          {timeLeft(invite.expiresAt, Date.now(), i18n.language)}
        </span>
      </span>
      <IconButton label={t('chat.thread.info.inviteCopy')} onClick={() => copy(invite.url)}>
        {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
      </IconButton>
      <IconButton
        label={t('chat.thread.info.inviteRevoke')}
        onClick={() => void revoke(invite.token)}
      >
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
});
