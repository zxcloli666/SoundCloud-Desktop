import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { isMac } from '../../lib/platform';
import { replyLength } from '../../lib/voice/chat/live';
import { answerAsk, dismissHud, undoById } from '../../lib/voice/executor';
import { voiceIpc } from '../../lib/voice/ipc';
import { type HudView, summarize, useVoiceRuntime } from '../../lib/voice/runtime';
import { UNDO_WINDOW_MS } from './island/DoneView';
import { IslandCard, type IslandHandlers } from './island/IslandCard';

const HIDE_AFTER: Partial<Record<HudView['kind'], number>> = {
  done: UNDO_WINDOW_MS,
  not_found: 9000,
  failed: 4500,
  asking: 15000,
};

const READ_BASE_MS = 4000;
const READ_PER_CHAR_MS = 55;
const READ_MAX_MS = 30_000;
const AFTER_SPEECH_MS = 4000;

function hideAfter(hud: HudView, spoken: boolean): number | undefined {
  if (hud.kind !== 'chat') return HIDE_AFTER[hud.kind];
  if (hud.phase === 'live') return undefined;
  if (hud.phase === 'failed' && replyLength() === 0) return HIDE_AFTER.failed;
  if (spoken) return AFTER_SPEECH_MS;
  return Math.min(READ_MAX_MS, READ_BASE_MS + replyLength() * READ_PER_CHAR_MS);
}

function undoTarget(hud: HudView): string | null {
  if (hud.kind === 'done') return hud.undo ? hud.id : null;
  return hud.kind === 'chat' && hud.phase === 'done' ? hud.undo : null;
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

const handlers: IslandHandlers = {
  onClose: dismissHud,
  onStop: () => void voiceIpc.stop().catch(() => {}),
  onUndo: (id) => void undoById(id),
  onPick: answerAsk,
};

export function VoiceIsland() {
  const hud = useVoiceRuntime((s) => s.hud);
  const speaking = useVoiceRuntime((s) => s.engine === 'speaking');
  const settingsOpen = useVoiceRuntime((s) => s.settingsOpen);
  const summary = useVoiceRuntime(useShallow((s) => summarize(s.models)));
  const [hovered, setHovered] = useState(false);
  const mac = isMac();
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const spokenRef = useRef<HudView | null>(null);
  if (speaking) spokenRef.current = hud;

  useEffect(() => {
    const wait = hideAfter(hud, spokenRef.current === hud);
    if (!wait || hovered || speaking) return;
    const timer = setTimeout(() => {
      if (hudRef.current !== hud) return;
      if (hud.kind === 'asking') dismissHud();
      else useVoiceRuntime.getState().hideHud();
    }, wait);
    return () => clearTimeout(timer);
  }, [hud, hovered, speaking]);

  useEffect(() => {
    if (hud.kind === 'hidden') return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const current = hudRef.current;
      if (e.key === 'Escape') {
        e.stopPropagation();
        dismissHud();
        return;
      }
      if (current.kind === 'asking' && (e.key === '1' || (e.key === '2' && current.second))) {
        e.preventDefault();
        e.stopPropagation();
        answerAsk(e.key === '1' ? 'first' : 'second');
        return;
      }
      const undo = undoTarget(current);
      if (undo && e.code === 'KeyZ' && (mac ? e.metaKey : e.ctrlKey)) {
        e.preventDefault();
        void undoById(undo);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hud.kind, mac]);

  const showDownload = hud.kind === 'hidden' && summary.downloading && !settingsOpen;
  if (hud.kind === 'hidden' && !showDownload) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[128px] left-1/2 z-[70] -translate-x-1/2 animate-fade-in-up motion-reduce:animate-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <IslandCard
        hud={hud}
        summary={showDownload ? summary : null}
        mac={mac}
        paused={hovered}
        handlers={handlers}
      />
    </div>
  );
}
