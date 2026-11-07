import type { MessageAttachment } from '../../../lib/chat/media-types';
import type { Embed, Message } from '../../../lib/chat/types';
import { CONV, NOW } from './convs';
import { ME_ID } from './people';
import { setPictureSize, thumbhashOf } from './pictures';

const MIN = 60_000;

export function labEmbed(title: string, artist: string, index: number): Embed {
  return {
    kind: 'track',
    urn: `soundcloud:tracks:${9000 + index}`,
    permalink: `https://soundcloud.com/lab/${index}`,
    secretToken: null,
    title,
    artist,
    artworkUrl: null,
    durationMs: 184_000 + index * 9_000,
    access: 'playable',
    atMs: null,
    tracks: [],
    room: null,
  };
}

export function attachment(id: string, w: number, h: number, size = 240_000): MessageAttachment {
  setPictureSize(id, w, h);
  return { mediaId: id, kind: 'image', size, w, h, thumbhash: thumbhashOf(id) };
}

interface Draft {
  conv: string;
  seq: number;
  from: string;
  ago: number;
  text: string;
  embeds?: Embed[];
  attachments?: MessageAttachment[];
  state?: Message['state'];
}

function message(draft: Draft): Message {
  const mine = draft.from === ME_ID;
  return {
    conversationId: draft.conv,
    seq: draft.seq,
    clientId: `${draft.conv}-${draft.seq}`,
    sender: draft.from,
    senderDevice: null,
    mine,
    ts: NOW - draft.ago * MIN,
    editedAt: null,
    expiresAt: null,
    state: draft.state ?? (mine ? 'read' : 'delivered'),
    body: { type: 'text', text: draft.text, spans: [] },
    replyTo: null,
    mentions: [],
    mentionsMe: false,
    embeds: draft.embeds ?? [],
    attachments: draft.attachments ?? [],
    forwardedFrom: null,
    reactions: [],
    pinned: false,
    localOnly: false,
  };
}

function thread(conv: string, drafts: Omit<Draft, 'conv' | 'seq'>[]): Message[] {
  return drafts.map((draft, index) => message({ ...draft, conv, seq: index + 1 }));
}

function publicThread(): Message[] {
  const posts = thread(CONV.public, [
    { from: 'u-tim', ago: 95, text: 'Кто-нибудь слушал новый альбом Burial? Это что-то' },
    { from: 'u-sasha', ago: 90, text: 'Да! Трек 3 просто уносит' },
    { from: 'u-kai', ago: 70, text: 'Собираю плейлист на вечер, кидайте идеи' },
    {
      from: 'u-mira',
      ago: 64,
      text: 'Вот это в тему',
      embeds: [labEmbed('Archangel', 'Burial', 7)],
    },
    { from: ME_ID, ago: 40, text: 'Добавил бы ещё что-то из Four Tet' },
    { from: 'u-vera', ago: 22, text: '@Астольфо согласна, Two Thousand and Seventeen идеально' },
    { from: 'u-roma', ago: 12, text: 'Ребята, а эквалайзер в новой версии кто пробовал?' },
    { from: 'u-tim', ago: 3, text: 'Пробовал, пресеты сохраняются, удобно' },
  ]);
  posts[5] = { ...posts[5], mentions: [ME_ID], mentionsMe: true, replyTo: 5 };
  return posts;
}

export function labThreads(): Record<string, Message[]> {
  return {
    [CONV.dm]: thread(CONV.dm, [
      { from: 'u-mira', ago: 190, text: 'Слушала вчера твой микс до утра' },
      { from: ME_ID, ago: 185, text: 'Спасибо! Там ещё половина не вошла' },
      {
        from: 'u-mira',
        ago: 120,
        text: 'Вот это вообще космос',
        embeds: [labEmbed('Night Drive', 'Kavinsky Echo', 1)],
      },
      {
        from: ME_ID,
        ago: 60,
        text: 'Смотри, что нашёл на выходных',
        attachments: [attachment('m-dm-1', 1600, 1000), attachment('m-dm-2', 900, 1200)],
      },
      { from: 'u-mira', ago: 30, text: 'Красота! Где это?', attachments: [] },
      { from: 'u-mira', ago: 4, text: 'Скинь ещё фото, если есть' },
      { from: 'u-mira', ago: 2, text: 'И тот трек тоже' },
    ]),
    [CONV.group]: thread(CONV.group, [
      { from: 'u-sasha', ago: 400, text: 'Кто едет на дачу в субботу?' },
      { from: 'u-kai', ago: 380, text: 'Я за. Беру колонку' },
      {
        from: ME_ID,
        ago: 300,
        text: 'Фото с прошлого раза',
        attachments: [
          attachment('m-g-1', 1400, 1000),
          attachment('m-g-2', 1000, 1000),
          attachment('m-g-3', 800, 1200),
          attachment('m-g-4', 1600, 900),
        ],
      },
      {
        from: 'u-danil',
        ago: 90,
        text: 'Плейлист для дороги собрал',
        embeds: [labEmbed('Road Mix', 'Данил', 2)],
      },
      { from: 'u-mira', ago: 20, text: 'Супер, добавляю в общий' },
    ]),
    [CONV.public]: publicThread(),
    [CONV.self]: thread(CONV.self, [
      { from: ME_ID, ago: 1500, text: 'Идеи для обложки: туман, неон, плёнка' },
      {
        from: ME_ID,
        ago: 900,
        text: 'Референс',
        attachments: [attachment('m-self-1', 1200, 1600)],
      },
    ]),
    [CONV.dm2]: thread(CONV.dm2, [
      { from: 'u-danil', ago: 2900, text: 'Созвонимся вечером?' },
      { from: ME_ID, ago: 2880, text: 'Да, после девяти' },
    ]),
    [CONV.dm3]: thread(CONV.dm3, [
      { from: 'u-lena', ago: 6000, text: 'Скинула тебе сет с фестиваля' },
    ]),
    [CONV.room]: thread(CONV.room, [
      { from: 'u-danil', ago: 25, text: 'Включайте громче' },
      { from: 'u-sasha', ago: 18, text: 'Этот переход огонь' },
      { from: ME_ID, ago: 10, text: 'Сейчас добавлю следующий' },
    ]),
  };
}
