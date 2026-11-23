import type { PlayerPort } from '../../execute.ts';
import type { Entity, VoiceCommand } from '../../types';
import { readArgs } from '../args.ts';
import { candidatesOf } from '../context.ts';
import type { AppPort } from '../ports';
import type { ChatTool, Ran, ToolEnv, ToolRun } from '../types';
import { appTools } from './app.ts';
import { buttonTools } from './buttons.ts';
import { catalogTools } from './catalog.ts';
import { listTools } from './lists.ts';
import { memoryTools } from './memory.ts';
import { playerTools } from './player.ts';
import { screenTools } from './screen.ts';
import { soundTools } from './sound.ts';
import { stationTools } from './stations.ts';
import { talkTools } from './talk.ts';
import { tasteTools } from './taste.ts';
import { togetherTools } from './together.ts';

export function chatTools(player: PlayerPort, app: AppPort, offered: Entity[]): ChatTool[] {
  return [
    ...playerTools(player, app),
    ...catalogTools(player, app, offered),
    ...listTools(player, app),
    ...appTools(player, app),
    ...screenTools(player, app),
    ...soundTools(player, app),
    ...buttonTools(app),
    ...stationTools(app),
    ...tasteTools(app),
    ...togetherTools(app),
    ...talkTools(),
    ...memoryTools(app),
  ];
}

export function toolsOf(cmd: VoiceCommand, player: PlayerPort, app: AppPort): ChatTool[] {
  return chatTools(player, app, candidatesOf(cmd));
}

function missed(name: string, reason: string, returns: boolean): Ran {
  const result = { ok: false, reason };
  return { name, args: {}, result, returns, mark: { tool: name, ok: false } };
}

async function attempt(tool: ChatTool, args: Ran['args'], env: ToolEnv): Promise<ToolRun | null> {
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
): Promise<Ran | null> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return missed(name, 'unknown_tool', false);
  const read = readArgs(tool.args, raw);
  if (!read.ok) return missed(name, read.reason, true);
  const run = await attempt(tool, read.args, env);
  if (!run) return null;
  const { result, intent, kind, text } = run;
  return {
    name,
    args: read.args,
    result,
    returns: tool.returns || !result.ok,
    mark: { tool: name, ok: result.ok, intent, kind, text },
  };
}
