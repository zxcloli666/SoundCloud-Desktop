import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Message } from '../../../../lib/chat/types';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { toastError } from '../../thread/errors';
import { Trash2 } from './icons';

const CONFIRM_MS = 4000;

export const DiscardPost = memo(function DiscardPost({ message }: { message: Message }) {
  const { t, i18n } = useTranslation();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const press = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    useChatThreadStore
      .getState()
      .discard(message)
      .catch((error) => {
        toastError(error, t, i18n.language);
        setBusy(false);
        setArmed(false);
      });
  };

  return (
    <button
      type="button"
      disabled={busy}
      aria-live="polite"
      onClick={press}
      onBlur={() => setArmed(false)}
      className={`flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-progress disabled:opacity-60 ${
        armed ? 'bg-bad/15 text-bad hover:bg-bad/25' : 'text-ink-55 hover:bg-ink/[0.07] hover:text-ink-80'
      }`}
    >
      <Trash2 size={11} />
      {armed ? t('chat.gallery.upload.discardConfirm') : t('chat.gallery.upload.discard')}
    </button>
  );
});
