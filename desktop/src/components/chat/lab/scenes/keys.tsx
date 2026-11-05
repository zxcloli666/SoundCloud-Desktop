import type { KeyStorage } from '../../../../lib/chat/types';
import { sleep } from '../steps';
import type { LabKit, LabScene } from '../types';
import { openChatSettings, scrollSettled } from './storage';

type Parked = 'keychain_denied' | 'keychain_unavailable';
type Answer = 'done' | 'fails' | 'hangs';

const CARD = '[data-ui="chat-keychain"]';
const OPEN = '[data-ui="chat-keys-reset-open"]';
const DIALOG = '[data-ui="chat-keys-reset"]';
const CONFIRM = '[data-ui="chat-keys-reset-confirm"]';
const WHERE = '[data-ui="chat-keys-reset-where"]:not(.invisible)';
const KEYS = '[data-ui="chat-keys-storage"]';
const HOUR_MS = 3_600_000;

interface Refusal {
  phase?: Parked;
  heals?: boolean;
  storage?: KeyStorage;
}

function refuseKeychain(
  kit: LabKit,
  { phase = 'keychain_denied', heals = false, storage = 'os' }: Refusal = {},
) {
  const ready = { ...kit.world.status };
  const parked = { ...ready, phase, userId: null, deviceId: null, keyStorage: storage };
  kit.world.status = parked;
  kit.handle('chat_config', () => {
    throw { code: 'not_ready' };
  });
  kit.handle('chat_keychain_retry', () => {
    kit.emit('chat:status', { ...parked, phase: 'starting' });
    setTimeout(() => {
      if (heals) {
        delete kit.world.handlers.chat_config;
        kit.world.status = ready;
      }
      kit.emit('chat:status', kit.world.status);
    }, 900);
    return null;
  });
}

function resetAnswers(kit: LabKit, answer: Answer) {
  kit.handle('chat_keys_reset', async () => {
    if (answer === 'hangs') return new Promise(() => undefined);
    await sleep(700);
    if (answer === 'fails') throw { code: 'store' };
    kit.world.status = {
      ...kit.world.status,
      phase: 'unbound',
      userId: null,
      deviceId: null,
      keyStorage: 'file',
    };
    kit.emit('chat:status', kit.world.status);
    return null;
  });
}

function openDialog(kit: LabKit) {
  kit.click(OPEN);
  kit.waitFor(WHERE);
}

function confirmReset(kit: LabKit, answer: Answer, state: string) {
  resetAnswers(kit, answer);
  openDialog(kit);
  kit.click(CONFIRM);
  kit.waitFor(`${DIALOG}[data-state="${state}"]`);
}

function showChatSettings(kit: LabKit, target: string) {
  kit.waitFor('[data-ui="settings-nav-item"]');
  kit.after(openChatSettings);
  kit.waitFor(target);
  kit.after(async () => {
    await document.fonts.ready;
    await scrollSettled();
    document.querySelector(target)?.scrollIntoView({ block: 'center' });
  });
}

export const scenes: LabScene[] = [
  {
    id: 'keychain-denied',
    title: 'Keychain access refused',
    route: '/chats',
    setup: (kit) => refuseKeychain(kit),
  },
  {
    id: 'keychain-unavailable',
    title: 'Keychain not answering',
    route: '/chats',
    setup: (kit) => refuseKeychain(kit, { phase: 'keychain_unavailable' }),
  },
  {
    id: 'keychain-file',
    title: 'Key file in the app folder unreadable',
    route: '/chats',
    setup: (kit) => refuseKeychain(kit, { phase: 'keychain_unavailable', storage: 'file' }),
  },
  {
    id: 'keychain-again',
    title: 'Keychain refused again after a retry',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit);
      kit.click(`${CARD} button`);
      kit.waitFor(`${CARD} [role="status"]`);
    },
  },
  {
    id: 'keychain-heals',
    title: 'Keychain answers on Retry and the chats open',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit, { phase: 'keychain_unavailable', heals: true });
      kit.click(`${CARD} button`);
      kit.waitFor('[data-ui="chat-row"]');
    },
  },
  {
    id: 'keys-reset-dialog',
    title: 'Reset chat keys: confirmation from the keychain card',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit);
      openDialog(kit);
    },
  },
  {
    id: 'keys-reset-working',
    title: 'Reset chat keys: in progress',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit);
      confirmReset(kit, 'hangs', 'working');
    },
  },
  {
    id: 'keys-reset-failed',
    title: 'Reset chat keys: local data could not be cleared',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit);
      confirmReset(kit, 'fails', 'failed');
    },
  },
  {
    id: 'keys-reset-done',
    title: 'Reset chat keys: done, sign-in comes next',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit);
      resetAnswers(kit, 'done');
      openDialog(kit);
      kit.click(CONFIRM);
      kit.waitFor('[data-ui="chat-relogin"]');
    },
  },
  {
    id: 'settings-keys-os',
    title: 'Settings: chat keys in the system store',
    route: '/settings',
    setup: (kit) => showChatSettings(kit, KEYS),
  },
  {
    id: 'settings-keys-file',
    title: 'Settings: chat keys in the app folder file',
    route: '/settings',
    setup: (kit) => {
      kit.world.status = { ...kit.world.status, keyStorage: 'file' };
      showChatSettings(kit, KEYS);
    },
  },
  {
    id: 'settings-keys-dialog',
    title: 'Settings: reset confirmation while chats work',
    route: '/settings',
    setup: (kit) => {
      showChatSettings(kit, KEYS);
      openDialog(kit);
    },
  },
  {
    id: 'settings-keychain',
    title: 'Settings: keychain refused before the chat config arrives',
    route: '/settings',
    setup: (kit) => {
      refuseKeychain(kit);
      showChatSettings(kit, CARD);
    },
  },
  {
    id: 'device-limit',
    title: 'Too many new sign-ins today',
    route: '/chats',
    setup: (kit) => {
      const opensBy = Date.now() + 5 * HOUR_MS;
      kit.world.status = { ...kit.world.status, phase: 'starting', deviceId: null, online: false };
      kit.handle('chat_device_limit', () => ({ opensBy }));
      kit.waitFor('[data-ui="chat-sign-in-limit"]');
    },
  },
];
