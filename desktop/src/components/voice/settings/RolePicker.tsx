import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OWN_MAX } from '../../../lib/voice/chat/body';
import { useVoiceStore } from '../../../lib/voice/store';
import type { RelationRole } from '../../../lib/voice/types';
import { ConciergeBell, GraduationCap, HandHelping, HeartHandshake, PenLine } from '../icons';
import { useVoiceGender } from '../useVoiceGender';
import { LineField } from './LineField';

const ROLES: { id: RelationRole; icon: ReactNode }[] = [
  { id: 'friend', icon: <HeartHandshake size={16} /> },
  { id: 'assistant', icon: <HandHelping size={16} /> },
  { id: 'butler', icon: <ConciergeBell size={16} /> },
  { id: 'mentor', icon: <GraduationCap size={16} /> },
  { id: 'own', icon: <PenLine size={16} /> },
];

function RoleTile({
  name,
  icon,
  on,
  onToggle,
}: {
  name: string;
  icon: ReactNode;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-ui="voice-role"
      data-on={on ? 'true' : 'false'}
      aria-pressed={on}
      onClick={onToggle}
      className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border px-2 pb-3 pt-3.5 text-center transition-all duration-500 ease-[var(--ease-apple)] enabled:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default ${
        on
          ? 'border-accent/60 bg-accent/[0.07]'
          : 'border-ink/[0.07] bg-ink/[0.025] enabled:hover:-translate-y-0.5 enabled:hover:border-ink/[0.14] enabled:hover:bg-ink/[0.05]'
      }`}
      style={
        on
          ? {
              boxShadow:
                '0 14px 36px -18px var(--color-accent-glow), inset 0 0 0 0.5px var(--color-accent)',
            }
          : undefined
      }
    >
      <span
        className={`flex size-9 items-center justify-center rounded-xl transition-colors duration-500 ${
          on ? 'bg-accent/15 text-accent' : 'bg-ink/[0.06] text-ink-50'
        }`}
      >
        {icon}
      </span>
      <span
        className={`max-w-full truncate text-[12.5px] font-semibold ${on ? 'text-ink-90' : 'text-ink-60'}`}
      >
        {name}
      </span>
    </button>
  );
}

export function RolePicker() {
  const { t } = useTranslation();
  const gender = useVoiceGender();
  const relation = useVoiceStore((s) => s.config.relation);
  const patchRelation = useVoiceStore((s) => s.patchRelation);
  const [picked, setPicked] = useState(false);

  const toggle = (role: RelationRole) => {
    const next = relation.role === role ? null : role;
    setPicked(next === 'own');
    patchRelation({ role: next });
  };

  return (
    <>
      <div
        role="group"
        aria-label={t('voice.you.role')}
        className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2"
      >
        {ROLES.map((role) => (
          <RoleTile
            key={role.id}
            name={t(`voice.you.roles.${role.id}`, { context: gender })}
            icon={role.icon}
            on={relation.role === role.id}
            onToggle={() => toggle(role.id)}
          />
        ))}
      </div>
      {relation.role === 'own' && (
        <div className="mt-2.5 motion-safe:animate-[vx-pop_320ms_var(--ease-apple)_both]">
          <LineField
            value={relation.own}
            max={OWN_MAX}
            label={t('voice.you.own')}
            icon={<PenLine size={13} />}
            counted
            focus={picked}
            onCommit={(own) => patchRelation({ own })}
          />
        </div>
      )}
    </>
  );
}
