import { execute, needsTrack, type PlayerPort } from '../../execute.ts';
import type { Entity, Intent, VoiceCommand } from '../../types';
import type { ArgsSchema, ChatTool, ToolEnv, ToolResult, ToolRun } from '../types';

export const NO_ARGS: ArgsSchema = { type: 'object', properties: {}, required: [] };

export function fail(reason: string, extra: Record<string, unknown> = {}): ToolRun {
  return { result: { ok: false, reason, ...extra } };
}

export function ok(extra: Record<string, unknown> = {}): ToolResult {
  return { ok: true, ...extra };
}

function stepOf(env: ToolEnv, intent: Intent, number: number | null, entity: Entity | null) {
  const step: VoiceCommand = {
    ...env.cmd,
    group: env.cmd.group ?? env.cmd.id,
    intent,
    number,
    decision: entity ? { decision: 'act', pick: { entity, score: 1 } } : null,
  };
  return step;
}

export async function runIntent(
  env: ToolEnv,
  player: PlayerPort,
  intent: Intent,
  number: number | null = null,
  entity: Entity | null = null,
): Promise<ToolRun> {
  const idle = needsTrack(intent) && !player.shot().track;
  const res = await execute(stepOf(env, intent, number, entity), player, {
    lang: env.lang,
    now: env.now,
    stack: env.stack,
  });
  env.stack = res.stack;
  env.undo = env.undo || res.outcome.undo;
  const mark = { intent, kind: entity?.kind, text: res.outcome.display };
  if (res.kind === 'done') return { result: ok(), ...mark };
  return { result: { ok: false, reason: idle ? 'nothing_playing' : 'failed' }, ...mark };
}

export function intentTool(
  player: PlayerPort,
  name: string,
  description: string,
  intent: Intent,
): ChatTool {
  return {
    name,
    description,
    args: NO_ARGS,
    returns: false,
    run: (_args, env) => runIntent(env, player, intent),
  };
}
