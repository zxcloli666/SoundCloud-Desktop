import type { ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';
import { isMac } from '../../../lib/platform';
import { type HudView, summarize, useVoiceRuntime } from '../../../lib/voice/runtime';
import { Mic } from '../icons';
import { IslandCard, type IslandHandlers } from '../island/IslandCard';
import { KHOCHU_M, KHOCHU_Z, SCRIPTONITE } from './fixtures';

const NOOP: IslandHandlers = {
  onClose: () => {},
  onStop: () => {},
  onUndo: () => {},
  onPick: () => {},
};

const CARDS: { label: string; hud: HudView }[] = [
  { label: 'listening', hud: { kind: 'listening', source: 'hotkey' } },
  { label: 'thinking', hud: { kind: 'thinking' } },
  {
    label: 'done',
    hud: {
      kind: 'done',
      id: 'lab-volume',
      heard: 'включи скриптонита',
      items: [{ intent: 'play', entity: SCRIPTONITE, display: 'Скриптонит' }],
      undo: true,
      at: 0,
    },
  },
  {
    label: 'done group',
    hud: {
      kind: 'done',
      id: 'lab-group',
      heard: 'выключи повтор и перемешай',
      items: [
        { intent: 'repeat_off', entity: null, display: 'Повтор выкл' },
        { intent: 'shuffle_on', entity: null, display: 'Перемешано' },
      ],
      undo: false,
      at: 0,
    },
  },
  {
    label: 'asking',
    hud: {
      kind: 'asking',
      id: 'lab-ask',
      heard: 'включи хочу',
      first: { entity: KHOCHU_Z, score: 0.82 },
      second: { entity: KHOCHU_M, score: 0.8 },
    },
  },
  { label: 'not found', hud: { kind: 'not_found', heard: 'поставь абырвалг' } },
  { label: 'failed', hud: { kind: 'failed', display: 'Сейчас ничего не играет' } },
  { label: 'speaking', hud: { kind: 'speaking' } },
  { label: 'error mic', hud: { kind: 'error', code: 'mic_denied' } },
  { label: 'error models', hud: { kind: 'error', code: 'no_models' } },
  { label: 'error star', hud: { kind: 'error', code: 'not_star' } },
  { label: 'error engine', hud: { kind: 'error', code: 'engine_missing' } },
];

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-35">{label}</span>
      {children}
    </div>
  );
}

function MicStates() {
  const cls = (active: boolean) =>
    `relative flex h-[30px] w-[30px] items-center justify-center rounded-full ${active ? 'bg-accent/15 text-accent' : 'text-ink-55'}`;
  return (
    <div className="flex items-center gap-2 rounded-full border border-ink/[0.12] bg-shade-25 px-3 py-2">
      <span className={cls(false)}>
        <Mic size={16} />
      </span>
      <span className={cls(true)}>
        <span className="absolute inset-0 scale-125 rounded-full bg-accent/25" />
        <Mic size={16} className="relative" />
      </span>
      <span className={cls(true)}>
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, var(--color-accent) 120deg, transparent 220deg)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            animation: 'vx-spin 1s linear infinite',
          }}
        />
        <Mic size={16} className="relative" />
      </span>
    </div>
  );
}

export function HudGallery() {
  const summary = useVoiceRuntime(useShallow((s) => summarize(s.models)));
  const mac = isMac();
  const download = {
    ...summary,
    downloading: true,
    done: 58 * 1024 * 1024,
    total: 153 * 1024 * 1024,
  };
  return (
    <div className="mx-auto grid max-w-[1000px] grid-cols-1 justify-items-center gap-x-8 gap-y-5 px-6 pb-16 pt-6 lg:grid-cols-2">
      {CARDS.map((c) => (
        <Labeled key={c.label} label={c.label}>
          <IslandCard hud={c.hud} summary={null} mac={mac} paused handlers={NOOP} />
        </Labeled>
      ))}
      <Labeled label="downloads">
        <IslandCard hud={{ kind: 'hidden' }} summary={download} mac={mac} paused handlers={NOOP} />
      </Labeled>
      <Labeled label="player mic">
        <MicStates />
      </Labeled>
    </div>
  );
}
