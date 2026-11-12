import type { PlayerPort } from '../../execute.ts';
import type { Entity, VoiceCommand } from '../../types';
import { readArgs } from '../args.ts';
import { candidatesOf } from '../context.ts';
import type { AppPort } from '../ports';
import type { ChatTool, Ran, ToolEnv, ToolRun } from '../types';
import { appTools } from './app.ts';
import { catalogTools } from './catalog.ts';
import { memoryTools } from './memory.ts';
import { playerTools } from './player.ts';

export function chatTools(player: PlayerPort, app: AppPort, offered: Entity[]): ChatTool[] {
  return [
    ...playerTools(player, app),
    ...catalogTools(player, app, offered),
    ...appTools(player, app),
    ...memoryTools(app),
  ];
}

export function toolsOf(cmd: VoiceCommand, player: PlayerPort, app: AppPort): ChatTool[] {
  return cmd.talk ? [] : chatTools(player, app, candidatesOf(cmd));
}

function missed(name: string, reason: string, returns: boolean): Ran {
  const result = { ok: false, reason };
  return { name, args: {}, result, returns, mark: { tool: name, ok: false } };
}

async function attempt(tool: ChatTool, args: Ran['args'], env: ToolEnv): Promise<ToolRun> {
  try {
    return await tool.run(args, env);
  } catch {
    return { result: { ok: false, reason: 'failed' } };
  }
}

export async function runTool(
  tools: ChatTool[],
  name: string,
  raw: unknown,
  env: ToolEnv,
): Promise<Ran> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return missed(name, 'unknown_tool', false);
  const read = readArgs(tool.args, raw);
  if (!read.ok) return missed(name, read.reason, true);
  const { result, intent, kind, text } = await attempt(tool, read.args, env);
  return {
    name,
    args: read.args,
    result,
    returns: tool.returns || !result.ok,
    mark: { tool: name, ok: result.ok, intent, kind, text },
  };
}
