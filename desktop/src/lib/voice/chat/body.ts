import type { ListenerConfig, RelationConfig, VoiceLanguage } from '../types';
import type {
  CallResult,
  ChatBody,
  ChatMessage,
  ChatTool,
  ListenerBody,
  RelationBody,
  ToolSpec,
} from './types';

export const TEXT_MAX = 500;
export const HISTORY_MAX = 20;
export const NOTES_MAX = 30;
export const TOOLS_MAX = 64;
export const BLOCK_BYTES = 8 * 1024;
export const NAME_MAX = 40;
export const OWN_MAX = 300;
const SHED_FIRST = ['candidates', 'queue_next', 'now_playing'];
const BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

export interface BodyInput {
  text: string;
  persona: string;
  language: VoiceLanguage;
  context: Record<string, unknown>;
  history: ChatMessage[];
  notes: string[];
  tools: ChatTool[];
  results: CallResult[];
  quiet: boolean;
  listener: ListenerConfig;
  relation: RelationConfig;
}

const encoder = new TextEncoder();

export function bytesOf(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

export function clip(text: string, max: number): string {
  const chars = Array.from(text.trim());
  return chars.length > max ? chars.slice(0, max).join('') : chars.join('');
}

export function oneLine(text: string, max: number): string {
  return clip(text.replace(BREAKS, ' '), max).trim();
}

function fitContext(context: Record<string, unknown>): Record<string, unknown> {
  let kept = context;
  for (const key of SHED_FIRST) {
    if (bytesOf(kept) <= BLOCK_BYTES) return kept;
    const { [key]: _shed, ...rest } = kept;
    kept = rest;
  }
  return bytesOf(kept) <= BLOCK_BYTES ? kept : {};
}

function fitResults(results: CallResult[]): CallResult[] {
  const kept: CallResult[] = [];
  for (const call of [...results].reverse()) {
    const next = [call, ...kept];
    if (bytesOf(next) <= BLOCK_BYTES) {
      kept.unshift(call);
      continue;
    }
    if (kept.length > 0) break;
    kept.unshift({ ...call, result: { ok: false, reason: 'too_large' } });
  }
  return kept;
}

function evenTail(history: ChatMessage[]): ChatMessage[] {
  const tail = history.slice(-HISTORY_MAX);
  return tail[0]?.role === 'assistant' ? tail.slice(1) : tail;
}

function spec(tool: ChatTool): ToolSpec {
  return {
    name: tool.name,
    description: tool.description,
    args: tool.args,
    returns: tool.returns,
  };
}

function listenerOf({ gender, name, address }: ListenerConfig): ListenerBody | null {
  const named = oneLine(name, NAME_MAX);
  const listener: ListenerBody = {
    ...(gender ? { gender } : {}),
    ...(named ? { name: named } : {}),
    ...(address ? { address } : {}),
  };
  return Object.keys(listener).length > 0 ? listener : null;
}

function relationOf({ role, own }: RelationConfig): RelationBody | null {
  if (role !== 'own') return role ? { preset: role } : null;
  const text = oneLine(own, OWN_MAX);
  return text ? { own: text } : null;
}

export function buildBody(input: BodyInput): ChatBody {
  const listener = listenerOf(input.listener);
  const relation = relationOf(input.relation);
  return {
    text: clip(input.text, TEXT_MAX),
    persona: input.persona,
    language: input.language,
    context: fitContext(input.context),
    history: evenTail(input.history).map((m) => ({ role: m.role, text: clip(m.text, TEXT_MAX) })),
    notes: input.notes.slice(-NOTES_MAX),
    tools: input.tools.slice(0, TOOLS_MAX).map(spec),
    results: fitResults(input.results),
    quiet: input.quiet,
    ...(listener ? { listener } : {}),
    ...(relation ? { relation } : {}),
  };
}
