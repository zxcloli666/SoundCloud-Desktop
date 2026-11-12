import {
  chatOn,
  chatStep,
  closeChatHud,
  dropChatAhead,
  interruptChat,
  keepChatAhead,
  openChatHud,
  rowReply,
  stopChat,
} from './chat/session';
import { unanswered } from './chat/step';
import { execute, revert, type StepResult } from './execute';
import { dismiss } from './hud';
import { voiceIpc } from './ipc';
import { playerPort } from './player-port';
import { answerLink, markActive, settleRemote } from './remote';
import type { RemoteState } from './remote-types';
import { reply } from './replies';
import { type DoneItem, useVoiceRuntime } from './runtime';
import { type RowResult, useVoiceStore } from './store';
import type { VoiceCommand } from './types';
import { findEntry, stillValid, type UndoEntry } from './undo';

interface GroupRun {
  id: string;
  items: DoneItem[];
  speech: string[];
  ok: boolean;
  undo: boolean;
}

let stack: UndoEntry[] = [];
let chain: Promise<void> = Promise.resolve();
let group: GroupRun | null = null;
const undoListeners = new Set<() => void>();

const ROW_RESULT: Record<StepResult['kind'], RowResult> = {
  done: 'done',
  ask: 'asked',
  not_found: 'not_found',
  failed: 'failed',
  ignored: 'ignored',
  chat: 'replied',
  cancelled: 'ignored',
};

const REMOTE_STATE: Record<StepResult['kind'], RemoteState> = {
  done: 'done',
  ask: 'ask',
  not_found: 'not_found',
  failed: 'failed',
  ignored: 'failed',
  chat: 'done',
  cancelled: 'failed',
};

function language() {
  return useVoiceStore.getState().config.language;
}

function notifyUndo() {
  for (const listener of undoListeners) listener();
}

export function onUndoChange(listener: () => void): () => void {
  undoListeners.add(listener);
  return () => {
    undoListeners.delete(listener);
  };
}

function groupOf(cmd: VoiceCommand): GroupRun {
  const id = cmd.group ?? cmd.id;
  if (!group || group.id !== id || (cmd.step ?? 1) <= 1) {
    group = { id, items: [], speech: [], ok: true, undo: false };
  }
  return group;
}

function isLastStep(cmd: VoiceCommand): boolean {
  return !cmd.steps || (cmd.step ?? 1) >= cmd.steps;
}

function show(cmd: VoiceCommand, res: StepResult, run: GroupRun) {
  if (res.chat) {
    if (cmd.chatless) openChatHud(cmd, res.chat.say);
    return closeChatHud(cmd.id, res, run.undo ? run.id : null);
  }
  const runtime = useVoiceRuntime.getState();
  const decision = cmd.decision;
  if (res.kind === 'ask' && decision?.decision === 'ask') {
    runtime.setHud({
      kind: 'asking',
      id: cmd.id,
      heard: cmd.heard,
      first: decision.first,
      second: decision.second,
    });
    return;
  }
  if (res.kind === 'not_found') runtime.setHud({ kind: 'not_found', heard: cmd.heard });
  if (res.kind === 'failed') runtime.setHud({ kind: 'failed', display: res.outcome.display });
  if (res.kind === 'ignored' && run.items.length === 0) runtime.hideHud();
  if (run.items.length > 0) {
    runtime.setHud({
      kind: 'done',
      id: run.id,
      heard: cmd.heard,
      items: run.items,
      undo: run.undo,
      at: Date.now(),
    });
  }
}

function displayOf(res: StepResult, run: GroupRun): string {
  if (run.items.length > 0) return run.items.map((i) => i.display).join(', ');
  return res.kind === 'chat' ? '' : res.outcome.display;
}

function record(cmd: VoiceCommand, res: StepResult, run: GroupRun) {
  if (res.kind === 'cancelled') return;
  if (res.kind === 'ignored' && cmd.source !== 'typed') return;
  const store = useVoiceStore.getState();
  const label = displayOf(res, run);
  const previous = store.history.find((r) => r.id === run.id);
  store.addRow({
    id: run.id,
    at: previous?.at ?? Date.now(),
    source: cmd.source,
    heard: cmd.heard,
    intents: [...(previous?.intents ?? []), cmd.intent],
    label: label || cmd.heard,
    result: run.items.length > 0 ? 'done' : ROW_RESULT[res.kind],
    undoable: run.undo,
    wrong: previous?.wrong ?? false,
    reply: res.chat ? rowReply(res.chat) : previous?.reply,
  });
}

async function reread(id: string): Promise<boolean> {
  if (useVoiceRuntime.getState().engine !== 'thinking') return false;
  return voiceIpc.reread(id).then(
    () => true,
    () => false,
  );
}

async function handle(cmd: VoiceCommand) {
  if (cmd.source !== 'remote') markActive();
  const run = groupOf(cmd);
  const res = await execute(cmd, playerPort, {
    lang: language(),
    now: Date.now(),
    stack,
    chat: chatOn() ? chatStep : undefined,
  });
  dropChatAhead(cmd.id);
  stack = res.stack;
  if (unanswered(res) && (await reread(cmd.id))) return;
  if (res.kind === 'done') {
    run.items = [
      ...run.items,
      { intent: cmd.intent, entity: res.entity, display: res.outcome.display },
    ];
  }
  run.undo = run.undo || res.outcome.undo;
  if (res.outcome.speech) run.speech.push(res.outcome.speech);
  run.ok = run.ok && res.outcome.ok;
  show(cmd, res, run);
  record(cmd, res, run);
  notifyUndo();
  if (res.kind !== 'ask') await voiceIpc.done(cmd.id, res.outcome).catch(() => {});
  if (cmd.remote_id && (res.kind === 'ask' || isLastStep(cmd))) {
    void settleRemote(
      cmd.remote_id,
      run.ok,
      run.speech.join('. '),
      displayOf(res, run),
      REMOTE_STATE[res.kind],
    );
  }
}

export function enqueueCommand(cmd: VoiceCommand) {
  interruptChat();
  keepChatAhead(cmd.id);
  chain = chain.then(() => handle(cmd)).catch(() => {});
}

export function canUndo(id: string): boolean {
  const entry = findEntry(stack, id);
  return !!entry && stillValid(entry, Date.now(), playerPort.shot());
}

export async function undoById(id: string): Promise<boolean> {
  const entry = findEntry(stack, id);
  if (!entry || !stillValid(entry, Date.now(), playerPort.shot())) return false;
  stack = await revert(entry, playerPort, stack);
  const store = useVoiceStore.getState();
  const row = store.history.find((r) => r.id === id);
  if (row) store.addRow({ ...row, undoable: false });
  const undone = reply(language(), 'undo');
  useVoiceRuntime.getState().setHud({
    kind: 'done',
    id: `${id}:undo`,
    heard: '',
    items: [{ intent: 'undo', entity: null, display: undone.display }],
    undo: false,
    at: Date.now(),
  });
  notifyUndo();
  return true;
}

export function answerAsk(choice: string) {
  useVoiceRuntime.getState().setHud({ kind: 'thinking' });
  void voiceIpc.answer(choice).catch(() => useVoiceRuntime.getState().hideHud());
}

export function dismissHud() {
  const runtime = useVoiceRuntime.getState();
  dismiss(runtime.hud, {
    declineLink: (id) => answerLink(id, false),
    stopChat,
    cancelEngine: () => void voiceIpc.cancel().catch(() => {}),
    hide: runtime.hideHud,
  });
}
