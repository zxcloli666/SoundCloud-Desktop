import { memo, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Pause, Users } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { StarCta } from '../../../star-moments/StarCta';
import { RISE } from './motion';
import type { NoteGate as AnyNote } from './useComposerMedia';

type NoteGate = Exclude<AnyNote, 'locked'>;

const TEXT: Record<NoteGate, { title: string; desc: string; self?: string }> = {
  paused: { title: 'pausedTitle', desc: 'pausedDesc' },
  'room-host': { title: 'roomHostTitle', desc: 'roomHostDesc', self: 'roomHostSelf' },
  'room-mods': { title: 'roomModsTitle', desc: 'roomModsDesc' },
  'room-off': { title: 'roomOffTitle', desc: 'roomOffDesc', self: 'roomOffSelf' },
};

export const GateNote = memo(function GateNote({
  gate,
  host,
  onClose,
}: {
  gate: NoteGate;
  host: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const blur = perf.blur(24);
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const text = TEXT[gate];
  const Glyph = gate === 'paused' ? Pause : gate === 'room-mods' ? Users : Lock;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const target = box.current?.querySelector<HTMLElement>('button') ?? box.current;
    target?.focus({ preventScroll: true });
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (box.current?.contains(target) || target.closest?.('[data-ui="chat-attach"]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      data-ui="chat-attach-gate"
      data-gate={gate}
      className={`absolute bottom-[calc(100%+8px)] left-0 z-40 w-[280px] rounded-[16px] border border-ink/[0.09] p-3 outline-none ${RISE}`}
      style={{
        background: blur ? 'rgb(var(--surface) / 0.86)' : 'rgb(var(--surface) / 0.98)',
        backdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
        WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
        boxShadow: '0 18px 50px -20px rgb(var(--shade) / calc(0.85 * var(--shade-alpha)))',
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: gate === 'paused' ? 'rgb(var(--ink) / 0.07)' : 'var(--color-accent-glow)',
            color: gate === 'paused' ? 'rgb(var(--ink) / 0.6)' : 'var(--color-accent-hover)',
          }}
        >
          <Glyph size={14} />
        </span>
        <span className="min-w-0">
          <span id={titleId} className="block text-[12.5px] font-semibold text-ink-90">
            {t(`chat.media.gate.${text.title}`)}
          </span>
          <span id={descId} className="mt-0.5 block text-[11.5px] leading-snug text-ink-50">
            {t(`chat.media.gate.${host && text.self ? text.self : text.desc}`)}
          </span>
        </span>
      </div>
      {gate === 'room-host' && host && (
        <div className="mt-2.5 flex justify-end">
          <StarCta size="sm" onOpen={onClose} />
        </div>
      )}
    </div>
  );
});
