import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canUndo, onUndoChange } from '../../../lib/voice/executor';
import type { DoneItem } from '../../../lib/voice/runtime';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import { KeyCap } from '../../ui/KeyCap';
import { Undo2 } from '../icons';
import { itemIcon } from '../intentIcon';
import { VoiceAvatar } from '../VoiceAvatar';
import { voiceById } from '../voices';
import { IconTile, IslandText } from './parts';

export const UNDO_WINDOW_MS = 6000;

function useUndoable(id: string, wanted: boolean): boolean {
  const [ok, setOk] = useState(() => wanted && canUndo(id));
  useEffect(() => {
    if (!wanted) return;
    setOk(canUndo(id));
    return onUndoChange(() => setOk(canUndo(id)));
  }, [id, wanted]);
  return ok;
}

function Stack({ items }: { items: DoneItem[] }) {
  if (items.length === 1) {
    return (
      <IconTile tone={items[0].intent === 'undo' ? 'muted' : 'accent'}>
        {itemIcon(items[0], 17)}
      </IconTile>
    );
  }
  return (
    <span className="flex h-10 shrink-0 items-center gap-2 rounded-[14px] bg-accent/15 px-3 text-accent">
      {items.slice(0, 3).map((item, i) => (
        <span key={`${item.intent}:${item.display}`} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-4 w-px rounded-full bg-accent/30" />}
          {itemIcon(item, 15)}
        </span>
      ))}
    </span>
  );
}

function UndoChip({ onUndo, mac, paused }: { onUndo: () => void; mac: boolean; paused: boolean }) {
  const { t } = useTranslation();
  const len = 2 * Math.PI * 9;
  return (
    <button
      type="button"
      onClick={onUndo}
      className="group relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-ink/[0.1] bg-ink/[0.06] pl-1.5 pr-3 text-[12px] font-semibold text-ink-85 transition-colors duration-200 hover:bg-ink/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <span className="relative flex size-5 items-center justify-center">
        <svg aria-hidden viewBox="0 0 22 22" className="absolute inset-0 -rotate-90">
          <circle cx="11" cy="11" r="9" fill="none" className="stroke-ink/[0.12]" strokeWidth="2" />
          <circle
            cx="11"
            cy="11"
            r="9"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={len}
            className="motion-reduce:animate-none"
            style={{
              ['--len' as string]: `${len}`,
              animation: `vx-countdown ${UNDO_WINDOW_MS}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        </svg>
        <Undo2 size={10} className="relative" />
      </span>
      {t('voice.hud.undo')}
      <span className="hidden sm:inline-flex">
        <KeyCap size="sm">{mac ? '⌘Z' : 'Ctrl Z'}</KeyCap>
      </span>
    </button>
  );
}

export function DoneView({
  id,
  heard,
  items,
  undo,
  mac,
  paused,
  onUndo,
}: {
  id: string;
  heard: string;
  items: DoneItem[];
  undo: boolean;
  mac: boolean;
  paused: boolean;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const speaking = useVoiceRuntime((s) => s.engine === 'speaking');
  const voiceId = useVoiceStore((s) => s.config.speak.voice);
  const undoable = useUndoable(id, undo);
  const voice = voiceById(voiceId);
  const title = items.map((i) => i.display).join(', ');
  return (
    <>
      {speaking ? (
        <VoiceAvatar voice={voice} name={t(`voice.voices.${voice.id}.name`)} size={40} speaking />
      ) : (
        <Stack items={items} />
      )}
      <IslandText title={title} sub={heard ? t('voice.quote', { text: heard }) : undefined} />
      {undoable && <UndoChip onUndo={onUndo} mac={mac} paused={paused} />}
    </>
  );
}
