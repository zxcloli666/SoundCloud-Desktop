import type { MediaUsage, MyMedia } from '../../../lib/chat/media-types';
import { CONV, NOW } from './convs';
import { setPictureSize } from './pictures';
import type { LabKit } from './types';

const GIB = 1073741824;
const DAY = 86_400_000;
const WINDOW_MS = 15_000;
const ORIGINS = [CONV.group, CONV.dm, CONV.self, CONV.dm2, 'c-gone', CONV.dm3, CONV.group, CONV.dm];

export interface StorageLab {
  star: boolean;
  count?: number;
  base?: number;
  reserved?: number;
}

function labImages(count: number): MyMedia[] {
  const out: MyMedia[] = [];
  for (let i = 0; i < count; i++) {
    const id = `m-store-${i}`;
    setPictureSize(id, 900 + (i % 5) * 220, 800 + (i % 3) * 260);
    out.push({
      id,
      kind: i % 41 === 7 ? 'avatar' : 'image',
      conversation_id: ORIGINS[i % ORIGINS.length],
      thumb_id: `${id}-t`,
      bytes: (45 + ((i * 23) % 105)) * 4096,
      status: i % 23 === 11 ? 'lost' : i % 31 === 3 ? 'uploaded' : 'attached',
      chats: i % 31 === 3 ? 0 : 1 + (i % 7 === 0 ? 3 : 0),
      created_at: NOW - i * 0.21 * DAY,
    });
  }
  return out;
}

function usageOf(mine: MyMedia[], base: number, reserved: number): MediaUsage {
  const rows = new Map<string, { bytes: number; files: number }>();
  for (const item of mine) {
    if (item.status === 'lost') continue;
    const row = rows.get(item.conversation_id) ?? { bytes: 0, files: 0 };
    row.bytes += item.bytes;
    row.files += 1;
    rows.set(item.conversation_id, row);
  }
  const live = mine.filter((item) => item.status !== 'lost');
  const bytes = live.reduce((sum, item) => sum + item.bytes, 0) + (live.length > 0 ? base : 0);
  return {
    bytes,
    reserved,
    quota: GIB,
    files: live.length,
    conversations: [...rows.entries()]
      .map(([conversation_id, row]) => ({
        conversation_id,
        ...row,
        gone: conversation_id === 'c-gone',
      }))
      .sort((a, b) => b.bytes - a.bytes),
  };
}

export function storageWorld(kit: LabKit, options: StorageLab) {
  const { world } = kit;
  const base = options.base ?? 0;
  let reserved = options.reserved ?? 0;
  let mine = labImages(options.count ?? 0);
  const trash = new Map<string, { item: MyMedia; at: number }>();

  kit.star(options.star);
  const usage = () => usageOf(mine, base, reserved);
  const media = world.config.media;
  if (media) {
    const now = usage();
    world.config = {
      ...world.config,
      media: {
        ...media,
        star: options.star,
        quota: GIB,
        used: now.bytes + now.reserved,
        limits: { ...media.limits, imageMaxBytes: 614400, restoreWindowS: 15 },
      },
    };
  }
  world.mine = mine;
  world.usage = usage();

  kit.handle('chat_media_usage', () => usage());
  kit.handle('chat_media_cache_size', () => 87 * 1024 * 1024 + 412 * 1024);
  kit.handle('chat_media_cache_clear', () => 87 * 1024 * 1024 + 412 * 1024);
  kit.handle('chat_media_delete', (args) => {
    const selection = args.selection as { ids?: string[]; all?: boolean };
    const wanted = new Set(selection.ids ?? []);
    const gone = mine.filter((item) => selection.all || wanted.has(item.id));
    const now = Date.now();
    for (const item of gone) trash.set(item.id, { item, at: now });
    mine = mine.filter((item) => !gone.includes(item));
    world.mine = mine;
    if (selection.all) reserved = 0;
    const live = gone.filter((item) => item.status !== 'lost');
    const after = usage();
    return {
      deleted: gone.length,
      freed: live.reduce((sum, item) => sum + item.bytes, 0),
      used: after.bytes + after.reserved,
      quota: GIB,
    };
  });
  kit.handle('chat_media_restore', (args) => {
    const selection = args.selection as { ids?: string[]; all?: boolean };
    const now = Date.now();
    const asked = selection.all ? [...trash.keys()] : (selection.ids ?? []);
    let restored = 0;
    let missed = 0;
    for (const id of asked) {
      const entry = trash.get(id);
      if (!entry || now - entry.at > WINDOW_MS || entry.item.status === 'lost') {
        missed += 1;
        continue;
      }
      trash.delete(id);
      mine = [...mine, entry.item];
      restored += 1;
    }
    world.mine = mine;
    const after = usage();
    return { restored, missed, used: after.bytes + after.reserved, quota: GIB };
  });
}

export function never(): Promise<never> {
  return new Promise(() => undefined);
}

export function typeInto(selector: string, text: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`lab: ${selector} did not appear`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
