import i18n from 'i18next';
import type { RoomBackdrop } from '../../../../lib/chat/media-types';
import type { ConversationSummary } from '../../../../lib/chat/types';
import { lookKey, useBackdropStore } from '../../../../stores/chat/backdrop';
import { useChatPrefsStore } from '../../../../stores/chat/prefs';
import { CONV } from '../convs';
import { ME_ID } from '../people';
import { setPictureSize } from '../pictures';
import { sleep } from '../steps';
import type { LabKit, LabScene } from '../types';

const MIN = 60_000;
const IMAGE_ID = 'm-chat-backdrop-1';
const SHORT = 'Привет! Я тут впервые, что слушаете?';
const LONG =
  'Привет всем! Я только что нашёл этот чат и хочу сразу рассказать про свою подборку: там сорок треков, от спокойного эмбиента до быстрого брейкбита, я собирал её всю осень и переслушал каждый трек раз по десять, пока не убрал всё лишнее. Если кому интересно, скину ссылку и расскажу, как подбирал порядок, чтобы переходы звучали ровно и ничего не выбивалось из общего настроения.';

function patch(kit: LabKit, id: string, change: Partial<ConversationSummary>) {
  kit.world.conversations = kit.world.conversations.map((conv) =>
    conv.id === id ? { ...conv, ...change } : conv,
  );
}

function look(kit: LabKit, id: string, backdrop: RoomBackdrop, by = 'u-mira') {
  if (backdrop.kind === 'image') setPictureSize(backdrop.mediaId, 1920, 1080);
  patch(kit, id, { backdrop: { ...backdrop, by } });
}

function preset(id: string): RoomBackdrop {
  return { kind: 'preset', id };
}

function openPicker(kit: LabKit, id: string) {
  kit.waitFor('[data-ui="chat-thread-header"]');
  kit.after(() => useBackdropStore.getState().open('picker', id));
  kit.waitFor('[data-tile]');
  kit.wait(300);
}

function openMenu(kit: LabKit) {
  kit.waitFor('[data-ui="chat-thread-header"]');
  kit.after(async () => {
    const label = i18n.t('chat.thread.menu.more');
    const button = document.querySelector<HTMLElement>(
      `[data-ui="chat-thread-header"] [aria-label="${label}"]`,
    );
    const rect = button?.getBoundingClientRect();
    button?.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: rect ? rect.left + rect.width / 2 : 0,
        clientY: rect ? rect.bottom : 0,
      }),
    );
    await sleep(300);
  });
}

function typeText(kit: LabKit, text: string) {
  kit.waitFor('[data-ui="chat-composer"] textarea');
  kit.after(async () => {
    const input = document.querySelector<HTMLTextAreaElement>('[data-ui="chat-composer"] textarea');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(250);
  });
}

function publicOpen(kit: LabKit, extra: Record<string, unknown>) {
  kit.handle('chat_public_open', () => {
    const conversation = kit.world.conversations.find((conv) => conv.id === CONV.public);
    return { conversation, online: 128, mute: null, newcomer: null, ...extra };
  });
}

export const scenes: LabScene[] = [
  {
    id: 'chat-backdrop-dm',
    title: 'Chat backdrop: DM with a preset',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => look(kit, CONV.dm, preset('aurora')),
  },
  {
    id: 'chat-backdrop-dm-light',
    title: 'Chat backdrop: DM with a light preset',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => look(kit, CONV.dm, preset('peach-clouds')),
  },
  {
    id: 'chat-backdrop-group',
    title: 'Chat backdrop: group with an image',
    route: `/chats/${CONV.group}`,
    setup: (kit) => look(kit, CONV.group, { kind: 'image', mediaId: IMAGE_ID }),
  },
  {
    id: 'chat-backdrop-saved',
    title: 'Chat backdrop: Saved',
    route: `/chats/${CONV.self}`,
    setup: (kit) => look(kit, CONV.self, preset('misty-forest'), ME_ID),
  },
  {
    id: 'chat-backdrop-public',
    title: 'Chat backdrop: public chat with a preset',
    route: `/chats/${CONV.public}`,
    setup: (kit) => look(kit, CONV.public, preset('ocean-rays'), 'u-owner'),
  },
  {
    id: 'chat-backdrop-dock',
    title: 'Chat backdrop: dock',
    route: '/home',
    setup: (kit) => {
      look(kit, CONV.dm, preset('vinyl'));
      kit.dock(CONV.dm);
      kit.wait(400);
      kit.after(() => useChatPrefsStore.getState().openInDock(CONV.dm));
      kit.waitFor('[data-ui="chat-thread"]');
    },
  },
  {
    id: 'chat-backdrop-picker-star',
    title: 'Chat backdrop picker: STAR',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      look(kit, CONV.group, preset('aurora'), ME_ID);
      openPicker(kit, CONV.group);
    },
  },
  {
    id: 'chat-backdrop-picker-free',
    title: 'Chat backdrop picker: free, upsell',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => {
      kit.star(false);
      openPicker(kit, CONV.dm);
    },
  },
  {
    id: 'chat-backdrop-picker-public-free',
    title: 'Chat backdrop picker: public staff without STAR',
    route: `/chats/${CONV.public}`,
    setup: (kit) => {
      kit.star(false);
      patch(kit, CONV.public, { role: 'admin' });
      look(kit, CONV.public, preset('ocean-rays'), 'u-owner');
      openPicker(kit, CONV.public);
    },
  },
  {
    id: 'chat-backdrop-picker-locked',
    title: 'Chat backdrop picker: role-locked',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      patch(kit, CONV.group, { role: 'member' });
      look(kit, CONV.group, preset('dunes'));
      openPicker(kit, CONV.group);
    },
  },
  {
    id: 'chat-backdrop-picker-pending',
    title: 'Chat backdrop picker: the peer has not accepted yet',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => {
      kit.star(true);
      kit.world.members[CONV.dm] = kit.world.members[CONV.dm].map((member) =>
        member.user.id === ME_ID ? member : { ...member, state: 'invited', accepted: false },
      );
      openPicker(kit, CONV.dm);
    },
  },
  {
    id: 'chat-backdrop-picker-limited',
    title: 'Chat backdrop picker: rate-limited',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      look(kit, CONV.group, preset('satin'), ME_ID);
      kit.after(() => useBackdropStore.getState().limit(CONV.group, Date.now() + 7 * MIN + 42_000));
      openPicker(kit, CONV.group);
    },
  },
  {
    id: 'chat-backdrop-info',
    title: 'Chat backdrop: row in chat info',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      look(kit, CONV.group, preset('aurora'), ME_ID);
      kit.waitFor('[data-ui="chat-thread-header"]');
      kit.after(() => {
        const label = i18n.t('chat.thread.menu.info');
        document.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click();
      });
      kit.waitFor('[data-ui="chat-info-backdrop"]');
      kit.wait(300);
    },
  },
  {
    id: 'chat-backdrop-hide',
    title: 'Chat backdrop: hide in the chat menu',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => {
      look(kit, CONV.dm, { kind: 'image', mediaId: IMAGE_ID });
      openMenu(kit);
    },
  },
  {
    id: 'chat-backdrop-hidden',
    title: 'Chat backdrop: hidden locally',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => {
      const backdrop = preset('aurora');
      look(kit, CONV.dm, backdrop);
      kit.after(() => useBackdropStore.getState().hide(CONV.dm, lookKey(backdrop) ?? ''));
      openMenu(kit);
    },
  },
  {
    id: 'chat-backdrop-report',
    title: 'Chat backdrop: report',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      look(kit, CONV.group, { kind: 'image', mediaId: IMAGE_ID });
      kit.handle('chat_room_backdrop_report', () => null);
      kit.waitFor('[data-ui="chat-thread-header"]');
      kit.after(() => useBackdropStore.getState().open('report', CONV.group));
      kit.waitFor('[role="radio"]');
      kit.click('[role="radio"]');
    },
  },
  {
    id: 'chat-backdrop-staff-menu',
    title: 'Chat backdrop: public staff can clear it',
    route: `/chats/${CONV.public}`,
    setup: (kit) => {
      patch(kit, CONV.public, { role: 'admin' });
      look(kit, CONV.public, { kind: 'image', mediaId: IMAGE_ID }, 'u-owner');
      openMenu(kit);
    },
  },
  {
    id: 'public-mute-open',
    title: 'Public chat: muted on open, with the reason',
    route: `/chats/${CONV.public}`,
    setup: (kit) => {
      publicOpen(kit, {
        mute: { until: Date.now() + 47 * MIN + 12_000, reason: 'Реклама в каждом сообщении' },
      });
      kit.waitFor('[data-ui="chat-public-sanction"]');
    },
  },
  {
    id: 'public-newcomer',
    title: 'Public chat: newcomer counter under the limit',
    route: `/chats/${CONV.public}`,
    setup: (kit) => {
      publicOpen(kit, { newcomer: { until: null, bodyMax: 512 } });
      typeText(kit, SHORT);
      kit.waitFor('[data-ui="chat-newcomer"]');
    },
  },
  {
    id: 'public-newcomer-near',
    title: 'Public chat: newcomer counter close to the limit',
    route: `/chats/${CONV.public}`,
    setup: (kit) => {
      publicOpen(kit, { newcomer: { until: null, bodyMax: 512 } });
      typeText(kit, LONG.slice(0, 240));
      kit.waitFor('[data-ui="chat-newcomer"]');
    },
  },
  {
    id: 'public-newcomer-over',
    title: 'Public chat: newcomer counter over the limit',
    route: `/chats/${CONV.public}`,
    setup: (kit) => {
      publicOpen(kit, { newcomer: { until: Date.now() + 6 * MIN, bodyMax: 512 } });
      typeText(kit, LONG);
      kit.waitFor('[data-ui="chat-newcomer"][data-over]');
    },
  },
];
