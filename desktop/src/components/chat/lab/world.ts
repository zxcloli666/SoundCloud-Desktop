import type { MediaConfig, MediaUsage, MyMedia, UploadView } from '../../../lib/chat/media-types';
import type {
  ChatConfig,
  ChatSettings,
  ChatStatus,
  ConversationSummary,
  ConvId,
  Member,
  Message,
} from '../../../lib/chat/types';
import { groupMembers, labConversations, publicStaff } from './convs';
import { labMediaConfig, labMine, labUsage } from './media-data';
import { labThreads } from './messages';
import { ME_ID, person } from './people';

export type CommandHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

export interface LabWorld {
  status: ChatStatus;
  config: ChatConfig;
  settings: ChatSettings;
  conversations: ConversationSummary[];
  threads: Record<ConvId, Message[]>;
  members: Record<ConvId, Member[]>;
  uploads: UploadView[];
  usage: MediaUsage;
  mine: MyMedia[];
  handlers: Record<string, CommandHandler>;
  latencyMs: number;
}

function labStatus(): ChatStatus {
  return {
    phase: 'ready',
    userId: ME_ID,
    deviceId: 'd-lab',
    tier: 'direct',
    online: true,
    visible: true,
    sendPaused: false,
    history: { locked: false, unlocksAt: null },
    keyStorage: 'os',
    unread: 3,
    mentions: 1,
    requests: 0,
  };
}

function labConfig(media: MediaConfig): ChatConfig {
  return {
    enabled: true,
    access: 'all',
    sendPaused: false,
    holdMaxMs: 20_000,
    serverNow: Date.now(),
    incarnation: 'lab',
    ockCurrent: 1,
    limits: {
      textMax: 4000,
      embedsMax: 5,
      groupMembersMax: 50,
      devicesMax: 5,
      envelopeMax: 65536,
      disappearingTtls: [3600, 86400, 604800],
    },
    media,
  };
}

export function createWorld(star = false): LabWorld {
  const threads = labThreads();
  const mine = labMine();
  const usage = labUsage(mine);
  const media = labMediaConfig(star, usage.bytes + usage.reserved);
  return {
    status: labStatus(),
    config: labConfig(media),
    settings: {
      dmPolicy: 'everyone',
      readReceipts: true,
      typing: true,
      presenceShare: true,
      blocked: [],
    },
    conversations: labConversations(threads),
    threads,
    members: {
      'c-group': groupMembers(),
      'c-dm': [me(), other('u-mira')],
      'c-public': publicStaff(),
    },
    uploads: [],
    usage,
    mine,
    handlers: {},
    latencyMs: 20,
  };
}

function me(): Member {
  return other(ME_ID);
}

function other(id: string): Member {
  return {
    user: person(id),
    role: 'member',
    state: 'active',
    accepted: true,
    joinedSeq: 0,
    invitedBy: null,
  };
}

export const world = {} as LabWorld;

export function initWorld() {
  Object.assign(world, createWorld());
}

export function setStar(star: boolean) {
  const media = world.config.media ?? labMediaConfig(star);
  world.config = { ...world.config, media: { ...media, star } };
}

export function conversation(id: ConvId): ConversationSummary | undefined {
  return world.conversations.find((conv) => conv.id === id);
}
