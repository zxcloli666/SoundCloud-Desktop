import type { DeleteAnswer, MyMedia, RestoreAnswer } from '../../../lib/chat/media-types';
import { labUsage } from './media-data';
import { world } from './world';

export interface Selection {
  ids?: string[];
  all?: boolean;
}

const trash = new Map<string, { item: MyMedia; at: number }>();

function refresh(reserved: number) {
  world.usage = labUsage(world.mine, reserved);
  const media = world.config.media;
  if (media) {
    world.config = {
      ...world.config,
      media: { ...media, used: world.usage.bytes + world.usage.reserved },
    };
  }
}

function windowMs(): number {
  return (world.config.media?.limits.restoreWindowS ?? 15) * 1000;
}

export function deleteSelection(selection: Selection): DeleteAnswer {
  const wanted = new Set(selection.ids ?? []);
  const gone = world.mine.filter((item) => selection.all || wanted.has(item.id));
  const now = Date.now();
  for (const item of gone) trash.set(item.id, { item, at: now });
  world.mine = world.mine.filter((item) => !gone.includes(item));
  const before = world.usage.bytes + world.usage.reserved;
  refresh(selection.all ? 0 : world.usage.reserved);
  const used = world.usage.bytes + world.usage.reserved;
  return { deleted: gone.length, freed: before - used, used, quota: world.usage.quota };
}

export function restoreSelection(selection: Selection): RestoreAnswer {
  const now = Date.now();
  const asked = selection.all ? [...trash.keys()] : (selection.ids ?? []);
  let restored = 0;
  let missed = 0;
  for (const id of asked) {
    const entry = trash.get(id);
    if (!entry || now - entry.at > windowMs() || entry.item.status === 'lost') {
      missed += 1;
      continue;
    }
    trash.delete(id);
    world.mine = [...world.mine, entry.item];
    restored += 1;
  }
  refresh(world.usage.reserved);
  return {
    restored,
    missed,
    used: world.usage.bytes + world.usage.reserved,
    quota: world.usage.quota,
  };
}
