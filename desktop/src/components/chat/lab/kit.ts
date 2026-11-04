import { DOCK_LIST, DOCK_ROOM, useChatPrefsStore } from '../../../stores/chat/prefs';
import { useChatRoomStore } from '../../../stores/chat/room';
import { useTogetherStore } from '../../../stores/together';
import { emitChat } from './bus';
import { CONV, ROOM_CODE } from './convs';
import { cooldown } from './media-writes';
import { ME_ID } from './people';
import { markMedia } from './pictures';
import { labRoomView } from './room-data';
import { runStep, type Step } from './steps';
import type { LabKit } from './types';
import { faults, setUploads } from './uploads-sim';
import { setStar, world } from './world';

export interface KitRun {
  kit: LabKit;
  steps: Step[];
}

export function createKit(): KitRun {
  const steps: Step[] = [];
  const kit: LabKit = {
    world,
    star: setStar,
    handle: (command, handler) => {
      world.handlers[command] = handler;
    },
    emit: emitChat,
    mark: (ids, mark) => markMedia(Array.isArray(ids) ? ids : [ids], mark),
    uploads: (views) => {
      world.uploads = views;
      steps.push({ kind: 'run', run: () => setUploads(views) });
    },
    uploadFault: (error) => {
      faults.upload = error;
    },
    backdropCooldown: (until) => {
      cooldown.until = until;
    },
    room: (options = {}) => {
      const view = labRoomView({ star: world.config.media?.star ?? false, host: true, ...options });
      useTogetherStore.setState({ phase: 'live', room: view, selfId: ME_ID, sync: 'synced' });
      useChatRoomStore.getState().setRoom(ROOM_CODE, CONV.room);
    },
    dock: (view) => {
      const prefs = useChatPrefsStore.getState();
      if (view === null) prefs.setDockOpen(false);
      else if (view === DOCK_LIST || view === DOCK_ROOM) prefs.show(view);
      else prefs.openInDock(view);
    },
    after: (run) => steps.push({ kind: 'run', run }),
    click: (selector) => steps.push({ kind: 'click', selector }),
    waitFor: (selector) => steps.push({ kind: 'wait-for', selector }),
    wait: (ms) => steps.push({ kind: 'wait', ms }),
  };
  return { kit, steps };
}

export async function runSteps(steps: Step[]) {
  for (const step of steps) await runStep(step);
}
