import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomChanges } from './room-changes.ts';
import {
  exited,
  gone,
  moved,
  NO_ROOM_CHAT,
  nextStep,
  opened,
  opening,
  refused,
  retryDelay,
  showsThread,
} from './room-chat-state.ts';
import { roomRowKind } from './room-rows.ts';
import {
  chatMembers,
  cleanTitle,
  exitOf,
  exitToast,
  isHost,
  memberActions,
  mutedUntil,
  nextHost,
  orderedMembers,
} from './room-rules.ts';

const MINUTE = 60_000;

class Refusal extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

class FakeRooms {
  constructor() {
    this.now = 1_000_000;
    this.room = null;
    this.version = 0;
    this.inbox = new Map();
  }

  tick(ms) {
    this.now += ms;
  }

  bump(change) {
    change(this.room);
    this.room.version = ++this.version;
  }

  create(host) {
    this.room = {
      code: 'K7M2QX',
      hostId: host.userId,
      version: ++this.version,
      createdAt: this.now,
      members: [{ ...host, joinedAt: this.now, readyUrn: null }],
      playback: { status: 'idle', track: null, trackUrn: null, positionMs: 0, at: 0, rate: 1 },
      online: [host.userId],
      public: false,
      title: null,
      chatId: null,
      chatEnabled: true,
      moderators: [],
      muted: [],
      banned: [],
      slowModeS: 0,
      links: true,
    };
    return this.view(host.userId);
  }

  join(member) {
    if (!this.room) throw new Refusal(404, 'not_found');
    if (this.room.banned.includes(member.userId)) throw new Refusal(403, 'room_banned');
    this.tick(1_000);
    this.bump((room) => {
      room.members.push({ ...member, joinedAt: this.now, readyUrn: null });
      room.online.push(member.userId);
    });
    return this.view(member.userId);
  }

  view(userId) {
    if (!this.room) throw new Refusal(404, 'not_found');
    if (!this.room.members.some((m) => m.userId === userId)) {
      throw new Refusal(404, 'room_not_member');
    }
    const { banned, ...shared } = this.room;
    const moderates = shared.hostId === userId || shared.moderators.includes(userId);
    return structuredClone({
      ...shared,
      muted: shared.muted.filter((m) => m.untilMs > this.now),
      serverNow: this.now,
      ...(moderates ? { banned } : {}),
    });
  }

  claimChat(userId) {
    this.view(userId);
    if (!this.room.chatId) this.bump((room) => (room.chatId = 'conv-room-1'));
    return this.room.chatId;
  }

  deliverGone(users) {
    if (!this.room?.chatId) return;
    for (const user of users) {
      this.inbox.set(user, [...(this.inbox.get(user) ?? []), this.room.chatId]);
    }
  }

  depart(userId) {
    this.bump((room) => {
      room.members = room.members.filter((m) => m.userId !== userId);
      room.online = room.online.filter((id) => id !== userId);
      room.moderators = room.moderators.filter((id) => id !== userId);
    });
    this.deliverGone([userId]);
  }

  kick(target) {
    this.depart(target);
  }

  ban(target) {
    this.bump((room) => room.banned.push(target));
    this.depart(target);
  }

  mute(target, seconds) {
    this.bump((room) => {
      room.muted = room.muted.filter((m) => m.userId !== target);
      if (seconds > 0) room.muted.push({ userId: target, untilMs: this.now + seconds * 1000 });
    });
  }

  setModerator(target, on) {
    this.bump((room) => {
      room.moderators = room.moderators.filter((id) => id !== target);
      if (on) room.moderators.push(target);
    });
  }

  rename(title) {
    this.bump((room) => (room.title = cleanTitle(title) || null));
  }

  relocate(code) {
    this.bump((room) => {
      room.code = code;
      room.public = true;
    });
  }

  leave(userId) {
    const room = this.room;
    if (room.members.length === 1) return this.end();
    if (room.hostId !== userId) return this.depart(userId);
    const heir = nextHost(this.view(userId), userId);
    if (!heir) return this.end();
    this.bump((next) => {
      next.hostId = heir.userId;
      next.moderators = next.moderators.filter((id) => id !== heir.userId);
    });
    this.depart(userId);
  }

  end() {
    this.deliverGone(this.room.members.map((m) => m.userId));
    this.room = null;
  }

  take(userId) {
    const ids = this.inbox.get(userId) ?? [];
    this.inbox.delete(userId);
    return ids;
  }
}

class Client {
  constructor(server, userId, name) {
    this.server = server;
    this.member = { userId, name, avatarUrl: null };
    this.userId = userId;
    this.phase = 'idle';
    this.room = null;
    this.role = null;
    this.chat = NO_ROOM_CHAT;
    this.handoff = null;
    this.toasts = [];
    this.stored = new Set();
  }

  host() {
    this.enter(this.server.create(this.member));
  }

  join() {
    this.enter(this.server.join(this.member));
  }

  enter(view) {
    this.phase = 'live';
    this.room = view;
    this.role = isHost(view, this.userId) ? 'host' : 'guest';
    this.sync();
  }

  poll() {
    if (this.phase === 'idle') return;
    try {
      this.accept(this.server.view(this.userId));
    } catch (error) {
      const exit = exitOf(error.status, error.code, this.phase === 'live');
      if (!exit) throw error;
      this.end(exit);
    }
    this.receiveGone();
  }

  accept(view) {
    for (const change of roomChanges(this.room, view, this.userId, this.server.now)) {
      if (change.kind === 'handoff') {
        this.role = change.mine ? 'host' : 'guest';
        this.handoff = change;
        if (change.mine) this.toasts.push('youLead');
      }
    }
    this.room = view;
    this.sync();
  }

  wish() {
    if (!this.room || this.phase === 'idle' || this.room.chatEnabled !== true) return null;
    return { code: this.room.code, chatId: this.room.chatId ?? null };
  }

  sync() {
    const step = nextStep(this.chat, this.wish());
    if (step.kind === 'clear') this.chat = NO_ROOM_CHAT;
    if (step.kind === 'move') this.chat = moved(this.chat, step.code);
    if (step.kind !== 'open') return;
    this.chat = opening(step.code);
    try {
      const id = this.server.claimChat(this.userId);
      this.chat = opened(this.chat, step.code, id);
      this.stored.add(id);
    } catch {
      this.chat = refused(this.chat, step.code, false);
    }
  }

  receiveGone() {
    const ids = this.server.take(this.userId);
    if (ids.length === 0) return;
    this.chat = gone(this.chat, ids);
    for (const id of ids) this.stored.delete(id);
  }

  leave() {
    this.server.leave(this.userId);
    this.end('left');
    this.receiveGone();
  }

  end(reason) {
    if (reason !== 'left') this.chat = exited(this.chat, reason);
    this.handoff = null;
    this.phase = 'idle';
    this.room = null;
    this.role = null;
    this.sync();
  }

  dismiss() {
    this.chat = NO_ROOM_CHAT;
  }

  actionsOn(target) {
    return memberActions(this.room, this.userId, target.userId);
  }

  mutedNow() {
    return mutedUntil(this.room, this.userId, this.server.now);
  }
}

function pollAll(clients) {
  for (const client of clients) client.poll();
}

test('three clients go through rename, mute, moderators, kick, ban, handoff and end', () => {
  const server = new FakeRooms();
  const a = new Client(server, '101', 'Ann');
  const b = new Client(server, '102', 'Bob');
  const c = new Client(server, '103', 'Cat');
  const everyone = [a, b, c];

  a.host();
  b.join();
  c.join();
  pollAll(everyone);
  for (const client of everyone) {
    assert.equal(client.chat.conversationId, 'conv-room-1');
    assert.ok(showsThread(client.chat));
    assert.ok(client.stored.has('conv-room-1'));
  }
  assert.equal(a.role, 'host');
  assert.deepEqual(
    orderedMembers(a.room).map((m) => m.name),
    ['Ann', 'Bob', 'Cat'],
  );

  server.rename('  Night​   drive  ');
  pollAll(everyone);
  for (const client of everyone) assert.equal(client.room.title, 'Night drive');

  server.relocate('PUB777');
  pollAll(everyone);
  for (const client of everyone) {
    assert.equal(client.chat.code, 'PUB777');
    assert.equal(client.chat.conversationId, 'conv-room-1');
    assert.ok(showsThread(client.chat));
  }

  assert.deepEqual(a.actionsOn(c.member), {
    kick: true,
    mute: true,
    ban: true,
    moderator: 'add',
    moderatorsFull: false,
  });
  assert.equal(b.actionsOn(c.member), null);
  server.mute(c.userId, 5 * 60);
  pollAll(everyone);
  assert.equal(c.mutedNow(), server.now + 5 * MINUTE);
  assert.equal(mutedUntil(b.room, c.userId, server.now), server.now + 5 * MINUTE);
  server.tick(5 * MINUTE + 1);
  pollAll(everyone);
  assert.equal(c.mutedNow(), null);

  server.setModerator(b.userId, true);
  pollAll(everyone);
  assert.deepEqual(b.actionsOn(c.member), {
    kick: true,
    mute: true,
    ban: false,
    moderator: null,
    moderatorsFull: false,
  });
  assert.equal(b.actionsOn(a.member), null);
  assert.equal(c.actionsOn(b.member), null);
  assert.equal(a.actionsOn(b.member).moderator, 'remove');
  assert.deepEqual(
    chatMembers(c.room).map((m) => [m.user.name, m.role]),
    [
      ['Ann', 'owner'],
      ['Bob', 'admin'],
      ['Cat', 'member'],
    ],
  );
  assert.deepEqual(b.room.banned, []);
  assert.equal(c.room.banned, undefined);

  server.kick(c.userId);
  pollAll(everyone);
  assert.equal(c.chat.exit, 'kicked');
  assert.equal(c.chat.purged, true);
  assert.equal(showsThread(c.chat), false);
  assert.equal(c.stored.has('conv-room-1'), false);
  assert.equal(c.room, null);
  assert.deepEqual(
    a.room.members.map((m) => m.userId),
    [a.userId, b.userId],
  );

  c.join();
  pollAll(everyone);
  assert.equal(c.chat.exit, null);
  assert.ok(showsThread(c.chat));
  assert.ok(c.stored.has('conv-room-1'));

  server.ban(c.userId);
  pollAll(everyone);
  assert.equal(c.chat.exit, 'kicked');
  assert.equal(c.stored.has('conv-room-1'), false);
  assert.deepEqual(b.room.banned, [c.userId]);
  assert.throws(() => c.join(), { code: 'room_banned', status: 403 });
  c.dismiss();
  assert.deepEqual(c.chat, NO_ROOM_CHAT);

  a.leave();
  assert.equal(a.chat, NO_ROOM_CHAT);
  assert.equal(a.stored.has('conv-room-1'), false);
  b.poll();
  assert.equal(b.role, 'host');
  assert.deepEqual(b.handoff, { kind: 'handoff', hostId: b.userId, name: 'Bob', mine: true });
  assert.deepEqual(b.toasts, ['youLead']);
  assert.ok(showsThread(b.chat));
  assert.equal(b.actionsOn(a.member), null);

  b.leave();
  assert.equal(server.room, null);
  assert.equal(b.chat, NO_ROOM_CHAT);
  assert.equal(b.stored.has('conv-room-1'), false);
});

test('a room that ends while members are inside shows the end card and purges locally', () => {
  const server = new FakeRooms();
  const a = new Client(server, '201', 'Ann');
  const b = new Client(server, '202', 'Bob');
  const c = new Client(server, '203', 'Cat');
  a.host();
  b.join();
  c.join();
  pollAll([a, b, c]);
  server.end();
  pollAll([a, b, c]);
  for (const client of [a, b, c]) {
    assert.equal(client.chat.exit, 'ended');
    assert.equal(client.chat.purged, true);
    assert.equal(client.stored.size, 0);
    assert.equal(showsThread(client.chat), false);
    assert.equal(nextStep(client.chat, null).kind, 'none');
  }
});

test('a member who was away and lost the seat is evicted, not kicked', () => {
  assert.equal(exitOf(404, 'room_not_member', false), 'evicted');
  assert.equal(exitOf(404, 'room_not_member', true), 'kicked');
  assert.equal(exitOf(404, 'not_found', true), 'ended');
  assert.equal(exitOf(503, null, true), null);
});

test('a refused room chat backs off and never retries faster than the server asks', () => {
  assert.equal(retryDelay('not_member', undefined, 0), 1_500);
  assert.equal(retryDelay('not_member', undefined, 3), 12_000);
  assert.equal(retryDelay('busy', 500, 0), 1_500);
  assert.equal(retryDelay('busy', 4_000, 1), 8_000);
  assert.equal(retryDelay(null, undefined, 0), 15_000);
  assert.equal(retryDelay(null, undefined, 50), 120_000);
  let total = 0;
  for (let failure = 0; failure < 20; failure++)
    total += retryDelay('not_member', undefined, failure);
  assert.ok(total > 25 * MINUTE);
});

test('the end toast speaks of the chat only to those who had it', () => {
  assert.equal(exitToast('ended', true, true), 'chat.room.toast.ended');
  assert.equal(exitToast('ended', false, true), 'together.toast.ended');
  assert.equal(exitToast('ended', false, false), null);
  assert.equal(exitToast('kicked', false, true), 'chat.room.toast.kicked');
  assert.equal(exitToast('evicted', true, true), 'together.toast.evicted');
});

test('the host chat switch closes the tab without an exit card', () => {
  const open = opened(opening('K7M2QX'), 'K7M2QX', 'conv-1');
  assert.deepEqual(nextStep(open, null), { kind: 'clear' });
  assert.equal(refused(opening('K7M2QX'), 'K7M2QX', true).link, 'off');
  assert.equal(opened(opening('OTHER1'), 'K7M2QX', 'conv-1').link, 'opening');
});

test('titles are cleaned like the server does', () => {
  assert.equal(cleanTitle('‮  late\tnight \n⁠mix '), 'late night mix');
  assert.equal(cleanTitle('x'.repeat(60)).length, 48);
  assert.equal(cleanTitle('   '), '');
  assert.equal(Array.from(cleanTitle('🎧'.repeat(50))).length, 48);
  assert.equal(cleanTitle('a\ufeffb\u0085c\u00a0d'), 'ab c d');
});

test('room rows pick out track changes, suggestions and moderator changes', () => {
  const track = { kind: 'track', urn: 'soundcloud:tracks:1', title: 'Song' };
  const base = {
    actor: null,
    target: null,
    name: null,
    ttlS: null,
    until: null,
    track: null,
    role: null,
    on: null,
  };
  assert.equal(roomRowKind({ ...base, kind: 'track', track }), 'track');
  assert.equal(roomRowKind({ ...base, kind: 'suggest', actor: '7', track }), 'suggest');
  assert.equal(
    roomRowKind({ ...base, kind: 'moderator', actor: '7', target: '8', on: false }),
    'moderator',
  );
  assert.equal(roomRowKind({ ...base, kind: 'other', actor: '7', track }), null);
  assert.equal(roomRowKind({ ...base, kind: 'deleted', actor: '7' }), null);
  assert.equal(roomRowKind({ ...base, kind: 'muted', actor: '7', target: '8' }), null);
  assert.equal(roomRowKind({ ...base, kind: 'other' }), null);
});
