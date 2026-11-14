import type { EntityKind, Intent, VoiceCommand, VoiceLanguage } from '../types';
import type { UndoEntry } from '../undo';

export type ChatEvent =
  | { kind: 'action'; name: string; args: Record<string, unknown> }
  | { kind: 'say'; text: string }
  | { kind: 'quiet' }
  | { kind: 'done' }
  | { kind: 'error'; code: string }
  | { kind: 'cancelled' };

export type ArgType = 'string' | 'number' | 'integer' | 'boolean';

export interface ArgSpec {
  type: ArgType;
  enum?: readonly string[];
}

export interface ArgsSchema {
  type: 'object';
  properties: Record<string, ArgSpec>;
  required: string[];
}

export type ArgValue = string | number | boolean;
export type Args = Record<string, ArgValue>;

export type ToolResult = { ok: boolean; reason?: string } & Record<string, unknown>;

export interface ToolRun {
  result: ToolResult;
  intent?: Intent;
  kind?: EntityKind;
  text?: string;
}

export interface ToolEnv {
  cmd: VoiceCommand;
  lang: VoiceLanguage;
  now: number;
  stack: UndoEntry[];
  undo: boolean;
}

export interface ChatTool {
  name: string;
  description: string;
  args: ArgsSchema;
  returns: boolean;
  run(args: Args, env: ToolEnv): Promise<ToolRun>;
}

export interface ToolMark {
  tool: string;
  ok: boolean;
  intent?: Intent;
  kind?: EntityKind;
  text?: string;
}

export interface CallResult {
  name: string;
  args: Args;
  result: ToolResult;
}

export interface Ran extends CallResult {
  returns: boolean;
  mark: ToolMark;
}

export interface ToolSpec {
  name: string;
  description: string;
  args: ArgsSchema;
  returns: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatBody {
  text: string;
  persona: string;
  language: VoiceLanguage;
  context: Record<string, unknown>;
  history: ChatMessage[];
  notes: string[];
  tools: ToolSpec[];
  results: CallResult[];
  quiet: boolean;
}

export interface ChatRequest {
  id: string;
  speak: boolean;
  body: ChatBody;
}

export type TurnEnd =
  | { status: 'ok'; say: string; marks: ToolMark[] }
  | { status: 'cancelled'; say: string; marks: ToolMark[] }
  | { status: 'failed'; code: string; say: string; marks: ToolMark[] };
