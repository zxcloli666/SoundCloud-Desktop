import { CONV } from '../convs';
import { labUploadSet } from '../media-data';
import type { LabScene } from '../types';

export const scenes: LabScene[] = [
  {
    id: 'dm-star',
    title: 'DM, STAR',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => kit.star(true),
  },
  {
    id: 'dm-uploads',
    title: 'DM, uploads in every state',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => kit.uploads(labUploadSet(CONV.dm)),
  },
  {
    id: 'group-broken-media',
    title: 'Group, deleted and lost pictures',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.mark('m-g-2', 'deleted');
      kit.mark('m-g-3', 'lost');
      kit.mark('m-g-4', 'failed');
    },
  },
  {
    id: 'room-star',
    title: 'Room, STAR host',
    route: '/chats/room',
    setup: (kit) => {
      kit.star(true);
      kit.room({ star: true, cover: true, backdrop: { kind: 'preset', id: 'aurora' } });
    },
  },
];
