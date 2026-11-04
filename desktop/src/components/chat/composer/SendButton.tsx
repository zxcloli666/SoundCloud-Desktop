import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from '../../../lib/chat/icons';
import { ink } from '../../../lib/chat/tone';
import { Check } from '../../../lib/icons';

export const SendButton = memo(function SendButton({
  editing,
  disabled,
  onSend,
}: {
  editing: boolean;
  disabled: boolean;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const label = t(editing ? 'chat.thread.composer.save' : 'chat.thread.composer.send');
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onSend}
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[transform,opacity,background-color] duration-150 enabled:hover:scale-105 disabled:cursor-default disabled:opacity-35"
      style={{
        background: disabled ? ink(8) : 'var(--color-accent)',
        color: disabled ? ink(60) : 'var(--color-accent-contrast)',
      }}
    >
      {editing ? (
        <Check size={17} />
      ) : (
        <Send size={16} className="-translate-x-px translate-y-px" />
      )}
    </button>
  );
});
