import { CONV } from '../convs';
import type { LabScene } from '../types';

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
];
