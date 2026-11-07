import i18n from 'i18next';
import type { ConversationSummary, PublicLogEntry } from '../../../../lib/chat/types';
import { queryClient } from '../../../../lib/query-client';
import { usePublicStore } from '../../../../stores/chat/public';
import { CONV, NOW, OWNER_ID, publicStaff } from '../convs';
import { ME_ID, person } from '../people';
import { sleep, waitUntil } from '../steps';
import type { LabKit, LabScene } from '../types';

const ROUTE = `/chats/${CONV.public}`;
const MIN = 60_000;
const FOLLOWINGS_LIMIT = 50;

function patchPublic(kit: LabKit, patch: Partial<ConversationSummary>) {
  kit.world.conversations = kit.world.conversations.map((conv) =>
    conv.id === CONV.public ? { ...conv, ...patch } : conv,
  );
}

function asOwner(kit: LabKit) {
  patchPublic(kit, { role: 'owner' });
  kit.world.members[CONV.public] = publicStaff(['u-mira', 'u-kai']).map((member) =>
    member.user.id === OWNER_ID ? { ...member, user: person(ME_ID) } : member,
  );
}

function entry(
  index: number,
  action: PublicLogEntry['action'],
  by: string,
  user: string | null,
  ago: number,
  extra: Partial<PublicLogEntry> = {},
): PublicLogEntry {
  return {
    id: `log-${index}`,
    by: person(by),
    action,
    user: user ? person(user) : null,
    seq: null,
    until: null,
    seconds: null,
    reason: null,
    ts: NOW - ago * MIN,
    ...extra,
  };
}

function labLog(): PublicLogEntry[] {
  return [
    entry(1, 'delete', 'u-mira', 'u-roma', 4, { seq: 42 }),
    entry(2, 'mute', ME_ID, 'u-roma', 9, {
      seconds: 3600,
      until: NOW + 51 * MIN,
      reason: 'Реклама в каждом сообщении',
    }),
    entry(3, 'slow_mode', ME_ID, null, 30, { seconds: 15 }),
    entry(4, 'ban', 'u-kai', 'u-tim', 95, { reason: 'Спам ссылками' }),
    entry(5, 'moderator_add', ME_ID, 'u-kai', 180),
    entry(6, 'unmute', 'u-mira', 'u-vera', 400),
    entry(7, 'mute', 'u-mira', 'u-vera', 520, { seconds: 600, until: NOW - 510 * MIN }),
    entry(8, 'unban', ME_ID, 'u-sasha', 2000),
  ];
}

function openInfo(kit: LabKit, tab: number) {
  kit.waitFor('[data-ui="chat-thread-header"]');
  kit.after(() => {
    const label = i18n.t('chat.thread.menu.info');
    document.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click();
  });
  kit.waitFor('[data-ui="chat-info"] [role="tab"]');
  kit.click(`[data-ui="chat-info"] [role="tablist"] > [role="tab"]:nth-child(${tab})`);
  kit.wait(300);
}

function seedFollowings() {
  const users = ['u-vera', 'u-roma', 'u-sasha', 'u-tim', 'u-danil', 'u-lena'].map((id, index) => {
    const ref = person(id);
    return {
      id: 7100 + index,
      urn: `soundcloud:users:${7100 + index}`,
      username: ref.name,
      avatar_url: ref.avatarUrl,
      permalink_url: ref.permalink,
    };
  });
  queryClient.setQueryData(['me', 'followings', FOLLOWINGS_LIMIT], {
    pages: [{ collection: users, has_more: false, page: 0 }],
    pageParams: [0],
  });
}

const LAST_BUBBLE = '[data-ui="chat-bubble"]:not([data-mine])';

async function lastOf(selector: string): Promise<HTMLElement> {
  await waitUntil(() => document.querySelector(selector) !== null);
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  const target = nodes[nodes.length - 1];
  if (!target) throw new Error(`lab: ${selector} did not appear`);
  return target;
}

async function mouseOn(selector: string, type: 'contextmenu' | 'click') {
  const placeholder = i18n.t('chat.thread.someone');
  await waitUntil(() => {
    const chips = document.querySelectorAll<HTMLElement>('[data-ui="chat-sender"]');
    return chips.length > 0 && [...chips].every((chip) => chip.textContent !== placeholder);
  });
  const target = await lastOf(selector);
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.min(48, rect.width / 2),
      clientY: rect.top + rect.height / 2,
    }),
  );
  await sleep(300);
}

export const scenes: LabScene[] = [
  { id: 'public-list', title: 'Public chat pinned in the list', route: '/chats' },
  {
    id: 'public-ping',
    title: 'Public chat: ping badge',
    route: '/chats',
    setup: (kit) => {
      patchPublic(kit, { pinged: true, unread: 3, lastReadSeq: 5 });
    },
  },
  { id: 'public-thread', title: 'Public chat open', route: ROUTE },
  {
    id: 'public-slow',
    title: 'Public chat: slow mode hold',
    route: ROUTE,
    setup: (kit) => {
      patchPublic(kit, { slowModeS: 30 });
      kit.waitFor('[data-ui="chat-composer"]');
      kit.after(() => usePublicStore.setState({ slowUntil: Date.now() + 22_000 }));
      kit.wait(200);
    },
  },
  {
    id: 'public-muted',
    title: 'Public chat: muted',
    route: ROUTE,
    setup: (kit) => {
      kit.waitFor('[data-ui="chat-thread-header"]');
      kit.after(() => usePublicStore.setState({ mutedUntil: Date.now() + 9 * MIN + 14_000 }));
      kit.wait(200);
    },
  },
  {
    id: 'public-banned',
    title: 'Public chat: banned',
    route: ROUTE,
    setup: (kit) => patchPublic(kit, { state: 'banned' }),
  },
  {
    id: 'public-restricted',
    title: 'Public chat: cannot open',
    route: ROUTE,
    setup: (kit) => {
      kit.handle('chat_public_open', () => {
        throw { code: 'muted', until: Date.now() + 47 * MIN };
      });
    },
  },
  {
    id: 'public-off',
    title: 'Public chat: kill switch',
    route: ROUTE,
    setup: (kit) => {
      kit.handle('chat_public_open', () => {
        throw { code: 'disabled' };
      });
    },
  },
  {
    id: 'public-mod-menu',
    title: 'Public chat: moderator menu on a message',
    route: ROUTE,
    setup: (kit) => {
      asOwner(kit);
      kit.waitFor('[data-ui="chat-bubble"]');
      kit.after(() => mouseOn(LAST_BUBBLE, 'contextmenu'));
    },
  },
  {
    id: 'public-mod-sender',
    title: 'Public chat: author chip menu',
    route: ROUTE,
    setup: (kit) => {
      asOwner(kit);
      kit.waitFor('[data-ui="chat-sender"]');
      kit.after(() => mouseOn('[data-ui="chat-sender"]', 'click'));
    },
  },
  {
    id: 'public-mute-dialog',
    title: 'Public chat: mute with a reason',
    route: ROUTE,
    setup: (kit) => {
      asOwner(kit);
      kit.waitFor('[data-ui="chat-bubble"]');
      kit.after(() => mouseOn(LAST_BUBBLE, 'contextmenu'));
      kit.after(async () => {
        const label = i18n.t('chat.public.menu.mute', {
          duration: i18n.t('chat.public.duration.hours', { count: 1 }),
        });
        const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          (node) => node.textContent?.trim() === label,
        );
        item?.click();
        await sleep(350);
      });
    },
  },
  {
    id: 'public-log',
    title: 'Public chat: moderation log',
    route: ROUTE,
    setup: (kit) => {
      asOwner(kit);
      kit.handle('chat_public_log', () => ({ entries: labLog(), next: null }));
      openInfo(kit, 3);
    },
  },
  {
    id: 'public-staff',
    title: 'Public chat: moderators tab',
    route: ROUTE,
    setup: (kit) => {
      asOwner(kit);
      openInfo(kit, 2);
    },
  },
  {
    id: 'public-add-moderator',
    title: 'Public chat: owner adds a moderator',
    route: ROUTE,
    setup: (kit) => {
      asOwner(kit);
      seedFollowings();
      openInfo(kit, 2);
      kit.click('[data-ui="chat-public-add-moderator"]');
      kit.waitFor('[data-ui="chat-info"], [role="dialog"]');
      kit.wait(400);
      kit.after(async () => {
        const row = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find(
          (node) => node.textContent?.includes(person('u-vera').name),
        );
        row?.click();
        await sleep(250);
      });
    },
  },
  {
    id: 'public-empty',
    title: 'Public chat: nobody wrote yet',
    route: ROUTE,
    setup: (kit) => {
      kit.world.threads[CONV.public] = [];
      patchPublic(kit, { preview: null, lastSeq: 0 });
    },
  },
];
