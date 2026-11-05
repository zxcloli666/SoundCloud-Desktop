import type {
  AvatarChange,
  MediaConfig,
  MessageAttachment,
  PublicBackdrop,
  RoomCover,
  RoomImagesPolicy,
} from './media-types';

export type ConvId = string;
export type DeviceId = string;
export type ClientId = string;
export type UserId = string;
export type Seq = number;
export type Millis = number;

export type Tier = 'direct' | 'relay' | 'pro';
export type ChatPhase =
  | 'off'
  | 'signed_out'
  | 'unbound'
  | 'bound_other'
  | 'starting'
  | 'ready'
  | 'revoked'
  | 'keychain_denied'
  | 'keychain_unavailable';
export type KeyStorage = 'os' | 'file';
export type ResetPlan = 'file' | 'probe' | 'in_place';
export type Access = 'beta' | 'all';

export const DISAPPEARING_TTLS = [3_600, 86_400, 604_800] as const;
export type DisappearingTtl = (typeof DISAPPEARING_TTLS)[number];

export interface HistoryGate {
  locked: boolean;
  unlocksAt: Millis | null;
}

export interface ChatStatus {
  phase: ChatPhase;
  userId: UserId | null;
  deviceId: DeviceId | null;
  tier: Tier | null;
  online: boolean;
  visible: boolean;
  sendPaused: boolean;
  history: HistoryGate;
  keyStorage: KeyStorage;
  unread: number;
  mentions: number;
  requests: number;
}

export interface DeviceLimit {
  opensBy: Millis | null;
}

export interface ChatLimits {
  textMax: number;
  embedsMax: number;
  groupMembersMax: number;
  devicesMax: number;
  envelopeMax: number;
  disappearingTtls: number[];
}

export interface ChatConfig {
  enabled: boolean;
  access: Access;
  sendPaused: boolean;
  holdMaxMs: number;
  serverNow: Millis;
  incarnation: string;
  ockCurrent: number;
  limits: ChatLimits;
  media?: MediaConfig;
}

export type ChatErrorCode =
  | 'not_member'
  | 'epoch_stale'
  | 'muted'
  | 'slow_mode'
  | 'unavailable'
  | 'request_limit'
  | 'send_limited'
  | 'read_limited'
  | 'busy'
  | 'clock'
  | 'replay'
  | 'device_revoked'
  | 'relogin_required'
  | 'session_bound_other'
  | 'too_young'
  | 'disabled'
  | 'send_paused'
  | 'quota_exceeded'
  | 'media_star_required'
  | 'room_star_required'
  | 'media_uploads_paused'
  | 'media_missing'
  | 'backdrop_cooldown'
  | 'invalid'
  | 'not_found'
  | 'internal'
  | 'offline'
  | 'not_ready'
  | 'store'
  | 'keychain'
  | 'keychain_denied'
  | 'crypto'
  | 'protocol';

export interface ChatError {
  code: ChatErrorCode;
  until?: Millis;
  retryMs?: number;
  serverNow?: Millis;
  used?: number;
  quota?: number;
  ids?: string[];
}

export type EmbedKind = 'track' | 'playlist' | 'user' | 'room_invite';

export interface EmbedTrack {
  urn: string;
  title: string;
  artist: string;
  durationMs: number;
  artworkUrl: string | null;
}

export interface RoomInvite {
  code: string;
  title: string | null;
  host: string;
}

export interface Embed {
  kind: EmbedKind;
  urn: string;
  permalink: string;
  secretToken: string | null;
  title: string;
  artist: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  access: string | null;
  atMs: number | null;
  tracks: EmbedTrack[];
  room: RoomInvite | null;
}

export interface EmbedsQuery {
  kinds: EmbedKind[];
  before?: Seq | null;
  limit: number;
}

export interface EmbedHit {
  seq: Seq;
  ts: Millis;
  sender: UserId;
  embed: Embed;
}

export interface EmbedPage {
  items: EmbedHit[];
  more: boolean;
}

export type SpanKind = 'bold' | 'italic' | 'code' | 'spoiler' | 'link' | 'mention';

export interface Span {
  kind: SpanKind;
  start: number;
  len: number;
  url: string | null;
  userId: UserId | null;
}

export interface RichText {
  text: string;
  spans: Span[];
}

export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Forwarded {
  userId: UserId;
  name: string;
  sentAtMs: Millis;
}

export type SystemKind =
  | 'created'
  | 'joined'
  | 'left'
  | 'added'
  | 'removed'
  | 'kicked'
  | 'banned'
  | 'muted'
  | 'renamed'
  | 'handoff'
  | 'track'
  | 'ttl'
  | 'role'
  | 'deleted'
  | 'moderator'
  | 'suggest'
  | 'other';

export interface SystemEvent {
  kind: SystemKind;
  actor: UserId | null;
  target: UserId | null;
  name: string | null;
  ttlS: number | null;
  until: Millis | null;
  track: Embed | null;
  role: MemberRole | null;
  on: boolean | null;
}

export type MessageBody =
  | ({ type: 'text' } & RichText)
  | ({ type: 'system' } & SystemEvent)
  | { type: 'deleted' }
  | { type: 'locked' }
  | { type: 'unknown' };

export interface Message {
  conversationId: ConvId;
  seq: Seq | null;
  clientId: ClientId;
  sender: UserId;
  senderDevice: DeviceId | null;
  mine: boolean;
  ts: Millis;
  editedAt: Millis | null;
  expiresAt: Millis | null;
  state: DeliveryState;
  body: MessageBody;
  replyTo: Seq | null;
  mentions: UserId[];
  mentionsMe: boolean;
  embeds: Embed[];
  attachments: MessageAttachment[];
  forwardedFrom: Forwarded | null;
  reactions: ReactionGroup[];
  pinned: boolean;
  localOnly: boolean;
}

export type MessageTarget = { seq: Seq } | { pending: ClientId };

export interface MessageRef {
  conversationId: ConvId;
  seq: Seq;
}

export interface SendInput {
  conversationId: ConvId;
  clientId?: ClientId | null;
  text: RichText;
  replyTo?: Seq | null;
  embeds: Embed[];
  forward?: MessageRef | null;
}

export interface HistoryQuery {
  before?: Seq | null;
  after?: Seq | null;
  limit: number;
}

export interface HistoryPage {
  messages: Message[];
  more: boolean;
}

export interface PeerMark {
  userId: UserId;
  readSeq: Seq;
  deliveredSeq: Seq;
}

export interface GoneMessage {
  conversationId: ConvId;
  seq: Seq;
}

export interface SearchQuery {
  text: string;
  conversationId?: ConvId | null;
  limit: number;
}

export interface SearchHit {
  conversationId: ConvId;
  seq: Seq;
  ts: Millis;
  sender: UserId;
  snippet: string;
}

export type ConversationKind = 'direct' | 'group' | 'room' | 'self';
export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberState = 'active' | 'invited' | 'left' | 'kicked' | 'banned';
export type NotifyLevel = 'all' | 'mentions' | 'none';
export type PreviewKind = 'text' | 'embed' | 'image' | 'system' | 'deleted' | 'locked' | 'unknown';

export interface UserRef {
  id: UserId;
  name: string;
  avatarUrl: string | null;
  permalink: string | null;
}

export interface MessagePreview {
  seq: Seq;
  sender: UserId;
  kind: PreviewKind;
  text: string;
  ts: Millis;
  expiresAt: Millis | null;
}

export interface ConversationSummary {
  id: ConvId;
  kind: ConversationKind;
  title: string | null;
  avatarUrl: string | null;
  avatarMediaId: string | null;
  peer: UserRef | null;
  role: MemberRole;
  state: MemberState;
  accepted: boolean;
  memberCount: number;
  lastSeq: Seq;
  lastAt: Millis;
  lastReadSeq: Seq;
  unread: number;
  mentions: number;
  preview: MessagePreview | null;
  mutedUntil: Millis | null;
  notify: NotifyLevel;
  pinnedAt: Millis | null;
  archived: boolean;
  ttlS: number | null;
  roomCode: string | null;
  historyLocked: boolean;
  hasDraft: boolean;
}

export type ListFilter = 'all' | 'direct' | 'groups' | 'unread' | 'requests' | 'archived';

export interface ListQuery {
  filter: ListFilter;
  cursor?: string | null;
  limit: number;
}

export interface ConversationPage {
  items: ConversationSummary[];
  nextCursor: string | null;
}

export interface CreateConversation {
  kind: ConversationKind;
  members: UserId[];
  title?: string | null;
}

export interface MetaPatch {
  title?: string | null;
  description?: string | null;
}

export type Mute = { kind: 'off' } | { kind: 'until'; at: Millis } | { kind: 'forever' };

export interface MyPatch {
  mute?: Mute | null;
  notify?: NotifyLevel | null;
  pinned?: boolean | null;
  archived?: boolean | null;
}

export interface ConversationPatch {
  meta?: MetaPatch | null;
  me?: MyPatch | null;
  avatar?: AvatarChange | null;
}

export type DeleteScope = 'me' | 'everyone';

export interface Member {
  user: UserRef;
  role: MemberRole;
  state: MemberState;
  accepted: boolean;
  joinedSeq: Seq;
  invitedBy: UserId | null;
}

export interface ChatRequest {
  conversation: ConversationSummary;
  from: UserRef;
  messages: number;
}

export interface InviteOptions {
  expiresInS?: number | null;
  uses?: number | null;
}

export interface Invite {
  token: string;
  url: string;
  expiresAt: Millis;
  usesLeft: number | null;
}

export interface ThreadSnapshot {
  conversation: ConversationSummary;
  messages: Message[];
  moreBefore: boolean;
  marks: PeerMark[];
  pins: Seq[];
  typing: UserId[];
  draft: RichText | null;
}

export type DeviceStatus = 'active' | 'revoked';

export interface DeviceActions {
  confirm: boolean;
  notMe: boolean;
  remove: boolean;
}

export interface Device {
  id: DeviceId;
  platform: string;
  name: string;
  appVersion: string;
  tier: Tier;
  status: DeviceStatus;
  createdAt: Millis;
  lastSeenAt: Millis;
  historyUnlocked: boolean;
  current: boolean;
  actions: DeviceActions;
}

export type ReportReason = 'spam' | 'harassment' | 'doxxing' | 'illegal' | 'other';

export interface ReportInput {
  conversationId: ConvId;
  seqFrom: Seq;
  seqTo: Seq;
  reason: ReportReason;
  comment?: string | null;
}

export type DmPolicy = 'everyone' | 'following' | 'nobody';

export interface ChatSettings {
  dmPolicy: DmPolicy;
  readReceipts: boolean;
  typing: boolean;
  presenceShare: boolean;
  blocked: UserRef[];
}

export interface SettingsPatch {
  dmPolicy?: DmPolicy | null;
  readReceipts?: boolean | null;
  typing?: boolean | null;
  presenceShare?: boolean | null;
}

export interface Presence {
  online: boolean;
  lastSeenAt: Millis | null;
  listening: Embed | null;
}

export interface UserCard {
  user: UserRef;
  contact: boolean;
  blocked: boolean;
  canMessage: boolean;
  presence: Presence | null;
}

export interface RoomPreview {
  code: string;
  title: string | null;
  host: UserRef;
  track: Embed | null;
  listeners: number;
  capacity: number;
  starHost: boolean;
  cover: RoomCover | null;
  backdrop?: PublicBackdrop | null;
  alive: boolean;
}

export type RoomModeration =
  | { action: 'kick'; userId: UserId }
  | { action: 'ban'; userId: UserId }
  | { action: 'mute'; userId: UserId; seconds: number }
  | { action: 'moderator'; userId: UserId; on: boolean };

export interface RoomSettingsPatch {
  title?: string | null;
  slowModeS?: number | null;
  chatEnabled?: boolean | null;
  links?: boolean | null;
  cover?: RoomCover | null;
  roomImages?: RoomImagesPolicy;
}

export type LoginTarget = 'fresh' | 'current';
export type LoginState = 'pending' | 'completed' | 'failed' | 'expired';
export type LoginStep = 'token' | 'extract' | 'finalizing';

export interface LoginBegin {
  url: string;
  loginRequestId: string;
}

export interface LoginPoll {
  status: LoginState;
  step: LoginStep | null;
  sessionId: string | null;
  username: string | null;
  error: string | null;
  redirectUrl: string | null;
}

export type LinkMode = 'pull' | 'push';
export type LinkState = 'pending' | 'claimed' | 'failed' | 'expired';

export interface LinkCreated {
  linkRequestId: string;
  claimToken: string;
  expiresAt: Millis;
  mode: LinkMode;
}

export interface LinkPoll {
  status: LinkState;
  mode: LinkMode;
  sessionId: string | null;
  error: string | null;
}

export interface LinkClaimed {
  sessionId: string;
  mode: LinkMode;
}

export type PreviewMode = 'full' | 'name_only' | 'hidden';

export interface NotifyPrefs {
  enabled: boolean;
  preview: PreviewMode;
  sound: boolean;
  streamMode: boolean;
}

export type MessagesOrigin = 'sync' | 'history' | 'local';

export interface MessagesEvent {
  conversationId: ConvId;
  origin: MessagesOrigin;
  messages: Message[];
}

export interface ConversationMarks {
  conversationId: ConvId;
  marks: PeerMark[];
}

export interface SyncEvent {
  reset: boolean;
  conversations: ConversationSummary[];
  marks: ConversationMarks[];
  requests: number;
}

export interface TypingEvent {
  conversationId: ConvId;
  users: UserId[];
}

export interface GoneEvent {
  conversations: ConvId[];
  messages: GoneMessage[];
}

export interface DeviceAddedEvent {
  device: Device;
}

export interface NotifyOpenEvent {
  conversationId: ConvId;
}
