import { useTranslation } from 'react-i18next';
import type { Scored } from '../../../lib/voice/types';
import { KeyCap } from '../../ui/KeyCap';
import { Mic } from '../icons';
import { kindIcon } from '../intentIcon';
import { CloseX } from './parts';

function Choice({ index, option, onPick }: { index: 1 | 2; option: Scored; onPick: () => void }) {
  const { entity } = option;
  const sub = entity.kind === 'artist' ? null : entity.artist;
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-2xl border border-ink/[0.1] bg-ink/[0.05] py-1.5 pl-1.5 pr-2.5 text-left transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-px hover:border-accent/50 hover:bg-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink/[0.07] text-ink-70 transition-colors group-hover:bg-accent/15 group-hover:text-accent">
        {kindIcon(entity.kind, 14)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink-90">
          {entity.name}
        </span>
        {sub && <span className="block truncate text-[11px] leading-tight text-ink-45">{sub}</span>}
      </span>
      <KeyCap size="sm">{index}</KeyCap>
    </button>
  );
}

export function AskView({
  heard,
  first,
  second,
  onPick,
  onClose,
}: {
  heard: string;
  first: Scored;
  second: Scored;
  onPick: (choice: 'first' | 'second') => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
      <span className="flex items-center gap-2 pl-1">
        <span
          className="relative flex size-5 items-center justify-center text-accent"
          title={t('voice.hud.answerByVoice')}
        >
          <Mic size={13} />
          <span
            className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-accent motion-reduce:animate-none"
            style={{ animation: 'vx-wait 1.4s ease-in-out infinite' }}
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-85">
          {t('voice.hud.ask')}
          <span className="font-normal text-ink-40"> · {t('voice.quote', { text: heard })}</span>
        </span>
        <CloseX onClick={onClose} label={t('voice.hud.cancel')} />
      </span>
      <span className="flex gap-2">
        <Choice index={1} option={first} onPick={() => onPick('first')} />
        <Choice index={2} option={second} onPick={() => onPick('second')} />
      </span>
    </span>
  );
}
