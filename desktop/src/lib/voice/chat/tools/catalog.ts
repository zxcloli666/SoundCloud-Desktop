import type { PlayerPort } from '../../execute.ts';
import type { Entity, EntityKind } from '../../types';
import type { AppPort } from '../ports';
import type { Args, ArgsSchema, ChatTool, ToolEnv, ToolRun } from '../types';
import { fail, ok, runIntent } from './intent.ts';

const KINDS: EntityKind[] = ['track', 'artist', 'album', 'playlist'];
const MATCHES = 5;

const BY_NAME: ArgsSchema = {
  type: 'object',
  properties: { query: { type: 'string' }, kind: { type: 'string', enum: KINDS } },
  required: ['query'],
};

function brief(entity: Entity) {
  return { kind: entity.kind, name: entity.name, artist: entity.artist };
}

function keyOf(kind: string, id: string): string {
  return `${kind}:${id}`;
}

async function lookup(app: AppPort, args: Args): Promise<Entity[]> {
  const kinds = typeof args.kind === 'string' ? [args.kind as EntityKind] : KINDS;
  return app.resolve(String(args.query), kinds);
}

async function start(
  env: ToolEnv,
  player: PlayerPort,
  entity: Entity,
  queue: boolean,
): Promise<ToolRun> {
  const run = await runIntent(env, player, queue ? 'queue_add' : 'play', null, entity);
  if (!run.result.ok) return run;
  return { ...run, result: ok({ [queue ? 'queued' : 'started']: brief(entity) }) };
}

function byName(player: PlayerPort, app: AppPort, queue: boolean): ChatTool {
  return {
    name: queue ? 'queue_add' : 'play',
    description: queue
      ? 'Find music by name and add the best match to the queue. Returns what was added.'
      : 'Find music by name (track, artist, album or playlist) and play the best match. Returns what started.',
    args: BY_NAME,
    returns: true,
    run: async (args, env) => {
      const [best] = await lookup(app, args);
      return best ? start(env, player, best, queue) : fail('not_found');
    },
  };
}

function search(app: AppPort, found: Map<string, Entity>): ChatTool {
  return {
    name: 'search',
    description:
      'Search the catalog by name. Returns up to 5 matches with kind, name, artist and id for play_found.',
    args: BY_NAME,
    returns: true,
    run: async (args) => {
      const matches = (await lookup(app, args)).slice(0, MATCHES);
      for (const entity of matches) found.set(keyOf(entity.kind, entity.id), entity);
      return { result: ok({ matches: matches.map((e) => ({ ...brief(e), id: e.id })) }) };
    },
  };
}

function playFound(player: PlayerPort, found: Map<string, Entity>): ChatTool {
  return {
    name: 'play_found',
    description:
      'Play a match returned by search, by its kind and id. queue=true adds it to the queue instead.',
    args: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KINDS },
        id: { type: 'string' },
        queue: { type: 'boolean' },
      },
      required: ['kind', 'id'],
    },
    returns: false,
    run: async (args, env) => {
      const entity = found.get(keyOf(String(args.kind), String(args.id)));
      return entity ? start(env, player, entity, args.queue === true) : fail('unknown_id');
    },
  };
}

export function catalogTools(player: PlayerPort, app: AppPort): ChatTool[] {
  const found = new Map<string, Entity>();
  return [
    byName(player, app, false),
    byName(player, app, true),
    search(app, found),
    playFound(player, found),
  ];
}
