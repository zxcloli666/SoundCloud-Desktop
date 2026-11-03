import { listen } from '@tauri-apps/api/event';
import { enqueueCommand } from './executor';
import { pushLevel, resetLevels } from './levels';
import { useVoiceRuntime } from './runtime';
import type {
  Devices,
  ErrorEvent,
  LevelEvent,
  ModelProgress,
  PartialEvent,
  StateEvent,
  VoiceCommand,
  WakeEvent,
} from './types';
import { wakeConfirmed, wakeHeard } from './wake';

const KEEP_ON_IDLE = new Set(['done', 'not_found', 'failed', 'error', 'asking']);

function onState(e: StateEvent) {
  const runtime = useVoiceRuntime.getState();
  const patch: Partial<typeof runtime> = { engine: e.state, source: e.source };
  if (e.source === 'headset') patch.headsetAt = Date.now();
  if (e.state === 'listening') {
    patch.partial = '';
    resetLevels();
    patch.hud = { kind: 'listening', source: e.source };
  }
  if (e.state === 'thinking' && runtime.hud.kind === 'listening') patch.hud = { kind: 'thinking' };
  if (e.state === 'speaking' && runtime.hud.kind === 'hidden' && !runtime.previewing) {
    patch.hud = { kind: 'speaking' };
  }
  if (e.state === 'idle') {
    patch.previewing = null;
    if (!KEEP_ON_IDLE.has(runtime.hud.kind)) patch.hud = { kind: 'hidden' };
  }
  useVoiceRuntime.setState(patch);
}

function onError(e: ErrorEvent) {
  useVoiceRuntime.setState((s) => ({
    hud: { kind: 'error', code: e.code },
    status: s.status ? { ...s.status, error: e } : s.status,
  }));
}

function onCommand(cmd: VoiceCommand) {
  if (cmd.source === 'wake') wakeConfirmed();
  enqueueCommand(cmd);
}

export function listenVoiceEvents() {
  void listen<StateEvent>('voice:state', (e) => onState(e.payload));
  void listen<LevelEvent>('voice:level', (e) => pushLevel(e.payload.input, e.payload.rms));
  void listen<PartialEvent>('voice:partial', (e) =>
    useVoiceRuntime.setState({ partial: e.payload.text }),
  );
  void listen<VoiceCommand>('voice:command', (e) => onCommand(e.payload));
  void listen<ErrorEvent>('voice:error', (e) => onError(e.payload));
  void listen<ModelProgress>('voice:models', (e) =>
    useVoiceRuntime.getState().mergeProgress(e.payload),
  );
  void listen<Devices>('voice:devices', (e) => useVoiceRuntime.setState({ devices: e.payload }));
  void listen<WakeEvent>('voice:wake', () => wakeHeard());
}
