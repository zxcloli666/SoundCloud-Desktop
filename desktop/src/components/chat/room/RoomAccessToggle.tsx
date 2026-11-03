import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Globe, Loader2, Lock } from '../../../lib/icons';
import { setRoomPublic } from '../../../lib/together/session';

export const RoomAccessToggle = memo(function RoomAccessToggle({
  open,
  host,
}: {
  open: boolean;
  host: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const Icon = open ? Globe : Lock;
  const state = t(open ? 'chat.room.access.public' : 'chat.room.access.private');
  const action = t(open ? 'chat.room.access.toPrivate' : 'chat.room.access.toPublic');
  const tone = open
    ? 'border-accent/40 bg-accent/15 text-accent'
    : 'border-ink/[0.09] bg-black/25 text-ink-60';

  if (!host) {
    return (
      <span
        title={state}
        aria-label={state}
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${tone}`}
      >
        <Icon size={13} />
      </span>
    );
  }

  const toggle = () => {
    setBusy(true);
    setRoomPublic(!open)
      .catch(() => toast.error(t('chat.room.errors.generic')))
      .finally(() => setBusy(false));
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      title={`${state}. ${action}`}
      aria-label={action}
      disabled={busy}
      onClick={toggle}
      className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[transform,background-color,border-color,color] duration-200 hover:scale-[1.06] active:scale-95 disabled:cursor-default ${tone}`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
    </button>
  );
});
