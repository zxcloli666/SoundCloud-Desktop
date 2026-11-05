import { CONV } from '../convs';
import type { LabKit, LabScene } from '../types';

export const scenes: LabScene[] = [
  { id: 'list', title: 'Chat list', route: '/chats' },
  { id: 'dm', title: 'DM thread', route: `/chats/${CONV.dm}` },
  { id: 'group', title: 'Group thread', route: `/chats/${CONV.group}` },
  { id: 'saved', title: 'Saved messages', route: `/chats/${CONV.self}` },
  {
    id: 'room',
    title: 'Room',
    route: '/chats/room',
    setup: (kit) => kit.room(),
  },
  {
    id: 'dock',
    title: 'Dock on home',
    route: '/home',
    setup: (kit) => kit.dock(CONV.dm),
  },
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
    setup: (kit) => refuseKeychain(kit, 'keychain_unavailable'),
  },
  {
    id: 'keychain-again',
    title: 'Keychain refused again after a retry',
    route: '/chats',
    setup: (kit) => {
      refuseKeychain(kit);
      kit.click('[data-ui="chat-keychain"] button');
      kit.waitFor('[data-ui="chat-keychain"] [role="status"]');
    },
  },
];

function refuseKeychain(
  kit: LabKit,
  phase: 'keychain_denied' | 'keychain_unavailable' = 'keychain_denied',
) {
  kit.world.status = { ...kit.world.status, phase };
  kit.handle('chat_keychain_retry', () => {
    kit.emit('chat:status', { ...kit.world.status, phase: 'starting' });
    setTimeout(() => kit.emit('chat:status', { ...kit.world.status }), 900);
    return null;
  });
}
