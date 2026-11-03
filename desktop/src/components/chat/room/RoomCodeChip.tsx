import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from '../../../lib/icons';
import { useCopyInvite } from '../../together/useCopyInvite';

export const RoomCodeChip = memo(function RoomCodeChip({ code }: { code: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopyInvite(code);
  const label = t(copied ? 'chat.room.copied' : 'chat.room.copyInvite');
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={copy}
      className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border pr-2 pl-2.5 transition-colors duration-200 ${
        copied
          ? 'border-emerald-300/30 bg-emerald-300/[0.1] text-emerald-200'
          : 'border-ink/[0.09] bg-black/25 text-ink-85 hover:border-ink/[0.18] hover:bg-black/35'
      }`}
    >
      <span className="font-mono text-[12.5px] font-bold tracking-[0.22em]">{code}</span>
      {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} className="text-ink-45" />}
    </button>
  );
});
