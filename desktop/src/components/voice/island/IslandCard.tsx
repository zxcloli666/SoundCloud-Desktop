import type { ReactNode } from 'react';
import { usePerfMode } from '../../../lib/perf';
import type { HudView, ModelSummary } from '../../../lib/voice/runtime';
import { AskView } from './AskView';
import { ChatView } from './ChatView';
import { DoneView } from './DoneView';
import { DownloadView } from './DownloadView';
import { LinkConfirmView } from './LinkConfirmView';
import { ListeningView } from './ListeningView';
import { ErrorView, FailedView, NotFoundView } from './NoticeViews';
import { SpeakingView } from './SpeakingView';

export interface IslandHandlers {
  onClose: () => void;
  onStop: () => void;
  onUndo: (id: string) => void;
  onPick: (choice: 'first' | 'second') => void;
}

function Body({
  hud,
  summary,
  mac,
  paused,
  handlers,
}: {
  hud: HudView;
  summary: ModelSummary | null;
  mac: boolean;
  paused: boolean;
  handlers: IslandHandlers;
}): ReactNode {
  const { onClose } = handlers;
  switch (hud.kind) {
    case 'listening':
      return (
        <ListeningView
          source={hud.source}
          thinking={false}
          onStop={handlers.onStop}
          onClose={onClose}
        />
      );
    case 'thinking':
      return <ListeningView source="button" thinking onStop={handlers.onStop} onClose={onClose} />;
    case 'done':
      return (
        <DoneView
          id={hud.id}
          heard={hud.heard}
          items={hud.items}
          undo={hud.undo}
          mac={mac}
          paused={paused}
          onUndo={() => handlers.onUndo(hud.id)}
        />
      );
    case 'asking':
      return (
        <AskView
          heard={hud.heard}
          first={hud.first}
          second={hud.second}
          onPick={handlers.onPick}
          onClose={onClose}
        />
      );
    case 'link_confirm':
      return <LinkConfirmView id={hud.id} provider={hud.provider} hint={hud.hint} />;
    case 'not_found':
      return <NotFoundView heard={hud.heard} onClose={onClose} />;
    case 'failed':
      return <FailedView display={hud.display} onClose={onClose} />;
    case 'error':
      return <ErrorView code={hud.code} onClose={onClose} />;
    case 'speaking':
      return <SpeakingView onClose={onClose} />;
    case 'chat':
      return (
        <ChatView
          heard={hud.heard}
          phase={hud.phase}
          undo={hud.undo}
          line={hud.line}
          onUndo={() => hud.undo && handlers.onUndo(hud.undo)}
          onClose={onClose}
        />
      );
    default:
      return summary ? <DownloadView summary={summary} /> : null;
  }
}

export function IslandCard({
  hud,
  summary,
  mac,
  paused,
  handlers,
}: {
  hud: HudView;
  summary: ModelSummary | null;
  mac: boolean;
  paused: boolean;
  handlers: IslandHandlers;
}) {
  const blur = usePerfMode().blur(30);
  const chatting = hud.kind === 'chat' && hud.phase === 'live';
  const live = hud.kind === 'listening' || hud.kind === 'thinking' || chatting;
  const wide = hud.kind === 'asking' || hud.kind === 'chat';
  return (
    <div
      data-ui="voice-island"
      data-state={hud.kind}
      role="status"
      aria-live="polite"
      className={`pointer-events-auto relative flex ${wide ? 'w-[460px]' : 'w-[420px]'} max-w-[92vw] items-center gap-3 overflow-hidden rounded-[24px] border border-ink/[0.14] py-2.5 pr-2.5 pl-2.5 shadow-[0_16px_48px_rgb(var(--shade)/calc(0.32*var(--shade-alpha)))]`}
      style={
        blur > 0
          ? {
              background: 'rgb(var(--surface) / 0.66)',
              backdropFilter: `blur(${blur}px) saturate(1.4)`,
              WebkitBackdropFilter: `blur(${blur}px) saturate(1.4)`,
            }
          : { background: 'rgb(var(--surface) / 0.94)' }
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px transition-opacity duration-500"
        style={{
          background: live
            ? 'linear-gradient(90deg, transparent, var(--color-accent), transparent)'
            : 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.25), transparent)',
        }}
      />
      <div
        key={hud.kind}
        className="relative flex min-w-0 flex-1 items-center gap-3 motion-reduce:animate-none"
        style={{ animation: 'vx-pop 420ms var(--ease-apple) both' }}
      >
        <Body hud={hud} summary={summary} mac={mac} paused={paused} handlers={handlers} />
      </div>
    </div>
  );
}
