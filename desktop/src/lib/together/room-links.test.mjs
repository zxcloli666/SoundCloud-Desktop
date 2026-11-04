import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasLink, linkBlock, linksOff, linksOpenAt, NEW_MEMBER_MS } from './room-rules.ts';

function room(change = {}) {
  return {
    code: 'K7M2QX',
    hostId: 'host',
    version: 1,
    createdAt: 0,
    members: [
      { userId: 'host', name: 'Host', avatarUrl: null, joinedAt: 1_000, readyUrn: null },
      { userId: 'mod', name: 'Mod', avatarUrl: null, joinedAt: 2_000, readyUrn: null },
      { userId: 'guest', name: 'Guest', avatarUrl: null, joinedAt: 5_000, readyUrn: null },
    ],
    playback: { status: 'idle', track: null, trackUrn: null, positionMs: 0, at: 0, rate: 1 },
    online: ['host', 'mod', 'guest'],
    serverNow: 5_000,
    public: false,
    moderators: ['mod'],
    links: true,
    ...change,
  };
}

test('links are found in plain text, not in look-alikes', () => {
  assert.equal(hasLink('see https://example.com/a'), true);
  assert.equal(hasLink('HTTP://EXAMPLE.COM'), true);
  assert.equal(hasLink('join scd://invite?token=abc'), true);
  assert.equal(hasLink('go to www.example.com now'), true);
  assert.equal(hasLink('no links here, only a dot.com word'), false);
  assert.equal(hasLink('mail me at me@www.example.com'), false);
  assert.equal(hasLink('https://'), false);
});

test('a host switch turns links off for members but never for the host or moderators', () => {
  const off = room({ links: false });
  assert.equal(linksOff(off, 'guest'), true);
  assert.equal(linksOff(off, 'host'), false);
  assert.equal(linksOff(off, 'mod'), false);
  assert.equal(linksOff(room(), 'guest'), false);
});

test('new members of a public room wait a minute before posting links', () => {
  const open = room({ public: true });
  assert.equal(linksOpenAt(open, 'guest'), 5_000 + NEW_MEMBER_MS);
  assert.equal(linksOpenAt(open, 'host'), 0);
  assert.equal(linksOpenAt(open, 'mod'), 0);
  assert.equal(linksOpenAt(open, 'stranger'), 0);
  assert.equal(linksOpenAt(room(), 'guest'), 0);
});

test('the link block names why a member cannot post a link right now', () => {
  const open = room({ public: true });
  assert.equal(linkBlock(open, 'guest', 5_000 + NEW_MEMBER_MS - 1), 'new');
  assert.equal(linkBlock(open, 'guest', 5_000 + NEW_MEMBER_MS), null);
  assert.equal(linkBlock(room({ public: true, links: false }), 'guest', 0), 'off');
  assert.equal(linkBlock(room({ links: false }), 'mod', 0), null);
});
