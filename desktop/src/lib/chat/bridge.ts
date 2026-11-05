import { trackedInvoke as invoke } from '../diagnostics';
import type {
  BackdropPresetId,
  DeleteAnswer,
  MediaId,
  MediaSelection,
  MediaUsage,
  MinePage,
  MineQuery,
  RestoreAnswer,
  UploadView,
  UrlsAnswer,
} from './media-types';
import type {
  ChatConfig,
  ChatRequest,
  ChatSettings,
  ChatStatus,
  ConversationPage,
  ConversationPatch,
  ConversationSummary,
  ConvId,
  CreateConversation,
  DeleteScope,
  Device,
  DeviceId,
  DeviceLimit,
  Embed,
  EmbedPage,
  EmbedsQuery,
  HistoryPage,
  HistoryQuery,
  Invite,
  InviteOptions,
  LinkClaimed,
  LinkCreated,
  LinkPoll,
  ListQuery,
  LoginBegin,
  LoginPoll,
  LoginTarget,
  Member,
  MemberRole,
  Message,
  MessageTarget,
  NotifyPrefs,
  ReportInput,
  ReportReason,
  ResetPlan,
  RichText,
  RoomModeration,
  RoomPreview,
  RoomSettingsPatch,
  SearchHit,
  SearchQuery,
  SendInput,
  Seq,
  SettingsPatch,
  ThreadSnapshot,
  UserCard,
  UserId,
} from './types';

export const chatBridge = {
  status: () => invoke<ChatStatus>('chat_status'),
  keychainRetry: () => invoke<void>('chat_keychain_retry'),
  keysReset: () => invoke<void>('chat_keys_reset'),
  keysResetPlan: () => invoke<ResetPlan>('chat_keys_reset_plan'),
  deviceLimit: () => invoke<DeviceLimit>('chat_device_limit'),
  config: () => invoke<ChatConfig>('chat_config'),

  loginBegin: (target: LoginTarget) => invoke<LoginBegin>('chat_login_begin', { target }),
  loginPoll: (loginRequestId: string) => invoke<LoginPoll>('chat_login_poll', { loginRequestId }),
  linkCreatePull: () => invoke<LinkCreated>('chat_link_create_pull'),
  linkClaimPush: (claimToken: string) =>
    invoke<LinkClaimed>('chat_link_claim_push', { claimToken }),
  linkClaimPull: (claimToken: string) =>
    invoke<LinkClaimed>('chat_link_claim_pull', { claimToken }),
  linkPoll: (linkRequestId: string) => invoke<LinkPoll>('chat_link_poll', { linkRequestId }),

  list: (query: ListQuery) => invoke<ConversationPage>('chat_list', { query }),
  open: (conversationId: ConvId) => invoke<ThreadSnapshot>('chat_open', { conversationId }),
  history: (conversationId: ConvId, query: HistoryQuery) =>
    invoke<HistoryPage>('chat_history', { conversationId, query }),
  images: (conversationId: ConvId, before: Seq | null, limit: number) =>
    invoke<HistoryPage>('chat_images', { conversationId, before, limit }),
  create: (input: CreateConversation) => invoke<ConversationSummary>('chat_create', { input }),
  conversationUpdate: (conversationId: ConvId, patch: ConversationPatch) =>
    invoke<ConversationSummary>('chat_conversation_update', { conversationId, patch }),
  conversationDelete: (conversationId: ConvId, scope: DeleteScope) =>
    invoke<void>('chat_conversation_delete', { conversationId, scope }),
  setTtl: (conversationId: ConvId, ttlS: number | null) =>
    invoke<ConversationSummary>('chat_set_ttl', { conversationId, ttlS }),

  send: (input: SendInput) => invoke<Message>('chat_send', { input }),
  edit: (conversationId: ConvId, seq: Seq, text: RichText) =>
    invoke<Message>('chat_edit', { conversationId, seq, text }),
  remove: (conversationId: ConvId, target: MessageTarget, scope: DeleteScope) =>
    invoke<void>('chat_delete', { conversationId, target, scope }),
  react: (conversationId: ConvId, seq: Seq, emoji: string, on: boolean) =>
    invoke<void>('chat_react', { conversationId, seq, emoji, on }),
  pin: (conversationId: ConvId, seq: Seq, on: boolean) =>
    invoke<void>('chat_pin', { conversationId, seq, on }),
  markRead: (conversationId: ConvId, seq: Seq) =>
    invoke<void>('chat_mark_read', { conversationId, seq }),
  typing: (conversationId: ConvId) => invoke<void>('chat_typing', { conversationId }),
  focus: (conversationId: ConvId | null) => invoke<void>('chat_focus', { conversationId }),
  draftSave: (conversationId: ConvId, draft: RichText | null) =>
    invoke<void>('chat_draft_save', { conversationId, draft }),
  search: (query: SearchQuery) => invoke<SearchHit[]>('chat_search', { query }),
  embeds: (conversationId: ConvId, query: EmbedsQuery) =>
    invoke<EmbedPage>('chat_embeds', { conversationId, query }),

  members: (conversationId: ConvId) => invoke<Member[]>('chat_members', { conversationId }),
  memberAdd: (conversationId: ConvId, userIds: UserId[]) =>
    invoke<Member[]>('chat_member_add', { conversationId, userIds }),
  memberRemove: (conversationId: ConvId, userId: UserId) =>
    invoke<void>('chat_member_remove', { conversationId, userId }),
  memberRole: (conversationId: ConvId, userId: UserId, role: MemberRole) =>
    invoke<Member>('chat_member_role', { conversationId, userId, role }),
  accept: (conversationId: ConvId) =>
    invoke<ConversationSummary>('chat_accept', { conversationId }),
  decline: (conversationId: ConvId) => invoke<void>('chat_decline', { conversationId }),
  requests: () => invoke<ChatRequest[]>('chat_requests'),
  inviteCreate: (conversationId: ConvId, options: InviteOptions) =>
    invoke<Invite>('chat_invite_create', { conversationId, options }),
  inviteRevoke: (token: string) => invoke<void>('chat_invite_revoke', { token }),
  inviteJoin: (token: string) => invoke<ConversationSummary>('chat_invite_join', { token }),
  block: (userId: UserId) => invoke<void>('chat_block', { userId }),
  unblock: (userId: UserId) => invoke<void>('chat_unblock', { userId }),
  report: (report: ReportInput) => invoke<void>('chat_report', { report }),
  settingsGet: () => invoke<ChatSettings>('chat_settings_get'),
  settingsPut: (patch: SettingsPatch) => invoke<ChatSettings>('chat_settings_put', { patch }),
  userCard: (userId: UserId) => invoke<UserCard>('chat_user_card', { userId }),

  devices: () => invoke<Device[]>('chat_devices'),
  deviceConfirm: (deviceId: DeviceId) => invoke<void>('chat_device_confirm', { deviceId }),
  deviceNotMe: (deviceId: DeviceId) => invoke<void>('chat_device_not_me', { deviceId }),
  deviceRemove: (deviceId: DeviceId) => invoke<void>('chat_device_remove', { deviceId }),

  roomChat: (code: string) => invoke<ConversationSummary>('chat_room_chat', { code }),
  roomPreview: (code: string) => invoke<RoomPreview>('chat_room_preview', { code }),
  roomModerate: (code: string, action: RoomModeration) =>
    invoke<void>('chat_room_moderate', { code, action }),
  roomSettings: (code: string, patch: RoomSettingsPatch) =>
    invoke<void>('chat_room_settings', { code, patch }),
  roomSuggest: (code: string, track: Embed) => invoke<void>('chat_room_suggest', { code, track }),

  mediaUsage: () => invoke<MediaUsage>('chat_media_usage'),
  mediaMine: (query: MineQuery) => invoke<MinePage>('chat_media_mine', { query }),
  mediaDelete: (selection: MediaSelection) =>
    invoke<DeleteAnswer>('chat_media_delete', { selection }),
  mediaRestore: (selection: MediaSelection) =>
    invoke<RestoreAnswer>('chat_media_restore', { selection }),
  mediaUrls: (conversationId: ConvId | null, ids: MediaId[]) =>
    invoke<UrlsAnswer>('chat_media_urls', { conversationId, ids }),
  mediaAttach: (conversationId: ConvId, paths: string[], album: string | null = null) =>
    invoke<UploadView[]>('chat_media_attach', { conversationId, album, paths }),
  mediaAttachData: (conversationId: ConvId, data: Uint8Array, album: string | null = null) =>
    invoke<UploadView[]>('chat_media_attach_data', data, undefined, {
      headers: { 'x-chat-conversation': conversationId, 'x-chat-album': album ?? '' },
    }),
  mediaSend: (input: SendInput, album: string) =>
    invoke<Message>('chat_media_send', { input, album }),
  mediaAlbumCancel: (album: string) => invoke<void>('chat_media_album_cancel', { album }),
  mediaAvatar: (conversationId: ConvId, path: string) =>
    invoke<UploadView>('chat_media_avatar', { conversationId, path }),
  mediaUploads: () => invoke<UploadView[]>('chat_media_uploads'),
  mediaParked: () => invoke<string[]>('chat_media_parked'),
  mediaUploadRetry: (id: string) => invoke<void>('chat_media_upload_retry', { id }),
  mediaUploadCancel: (id: string) => invoke<void>('chat_media_upload_cancel', { id }),
  mediaCacheSize: () => invoke<number>('chat_media_cache_size'),
  mediaCacheClear: () => invoke<number>('chat_media_cache_clear'),
  mediaRetry: (mediaId: MediaId) => invoke<void>('chat_media_retry', { mediaId }),
  roomBackdrop: (code: string, conversationId: ConvId, preset: BackdropPresetId | null) =>
    invoke<void>('chat_room_backdrop', { code, conversationId, preset }),
  roomBackdropUpload: (code: string, conversationId: ConvId, path: string) =>
    invoke<UploadView>('chat_room_backdrop_upload', { code, conversationId, path }),
  roomBackdropReport: (
    conversationId: ConvId,
    mediaId: MediaId,
    reason: ReportReason,
    comment: string | null,
  ) => invoke<void>('chat_room_backdrop_report', { conversationId, mediaId, reason, comment }),

  logout: () => invoke<void>('chat_logout'),
  notifyPrefs: (prefs: NotifyPrefs | null) => invoke<NotifyPrefs>('chat_notify_prefs', { prefs }),
} as const;
