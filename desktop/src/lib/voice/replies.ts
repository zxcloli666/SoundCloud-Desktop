import type { Entity, VoiceLanguage } from './types';

export type ReplyKey =
  | 'play_artist'
  | 'play_track'
  | 'play_album'
  | 'play_playlist'
  | 'queue_add'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'next'
  | 'previous'
  | 'seek_forward'
  | 'seek_backward'
  | 'seek_to'
  | 'volume_set'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'unmute'
  | 'like'
  | 'unlike'
  | 'shuffle_on'
  | 'shuffle_off'
  | 'repeat_one'
  | 'repeat_all'
  | 'repeat_off'
  | 'play_likes'
  | 'play_wave'
  | 'play_similar'
  | 'now_playing'
  | 'nothing_playing'
  | 'undo'
  | 'nothing_to_undo'
  | 'help'
  | 'ask'
  | 'not_found'
  | 'failed';

export interface Reply {
  speech: string;
  display: string;
}

export interface ReplyVars {
  name?: string;
  artist?: string;
  n?: number;
  first?: string;
  second?: string;
  heard?: string;
}

type Line = (v: ReplyVars) => Reply;

function ruSeconds(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} секунду`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} секунды`;
  return `${n} секунд`;
}

function clock(n: number): string {
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function same(text: string): Reply {
  return { speech: text, display: text };
}

const RU: Record<ReplyKey, Line> = {
  play_artist: (v) => ({ speech: `Включаю ${v.name}`, display: v.name ?? '' }),
  play_track: (v) => ({
    speech: `Включаю ${v.artist} — ${v.name}`,
    display: `${v.artist} — ${v.name}`,
  }),
  play_album: (v) => ({ speech: `Включаю альбом ${v.name}`, display: `${v.artist} — ${v.name}` }),
  play_playlist: (v) => ({ speech: `Включаю плейлист ${v.name}`, display: v.name ?? '' }),
  queue_add: (v) => ({ speech: `Добавлено в очередь: ${v.name}`, display: `+ ${v.name}` }),
  pause: () => same('Пауза'),
  resume: () => same('Продолжаю'),
  stop: () => same('Стоп'),
  next: () => ({ speech: 'Следующий трек', display: 'Дальше' }),
  previous: () => ({ speech: 'Предыдущий трек', display: 'Назад' }),
  seek_forward: (v) => ({ speech: `Вперёд на ${ruSeconds(v.n ?? 0)}`, display: `+${v.n} с` }),
  seek_backward: (v) => ({ speech: `Назад на ${ruSeconds(v.n ?? 0)}`, display: `−${v.n} с` }),
  seek_to: (v) => ({ speech: `Перематываю на ${clock(v.n ?? 0)}`, display: clock(v.n ?? 0) }),
  volume_set: (v) => same(`Громкость ${v.n}`),
  volume_up: (v) => ({ speech: `Громче, ${v.n}`, display: `Громкость ${v.n}` }),
  volume_down: (v) => ({ speech: `Тише, ${v.n}`, display: `Громкость ${v.n}` }),
  mute: () => same('Без звука'),
  unmute: () => same('Звук включён'),
  like: () => same('Лайк'),
  unlike: () => same('Лайк убран'),
  shuffle_on: () => ({ speech: 'Перемешиваю', display: 'Перемешано' }),
  shuffle_off: () => same('По порядку'),
  repeat_one: () => ({ speech: 'Повторяю этот трек', display: 'Повтор трека' }),
  repeat_all: () => ({ speech: 'Повторяю всё', display: 'Повтор всего' }),
  repeat_off: () => ({ speech: 'Повтор выключен', display: 'Повтор выкл' }),
  play_likes: () => ({ speech: 'Включаю любимое', display: 'Мои лайки' }),
  play_wave: () => ({ speech: 'Включаю волну', display: 'Моя волна' }),
  play_similar: () => ({ speech: 'Включаю похожее', display: 'Похожее' }),
  now_playing: (v) => ({
    speech: `Сейчас играет ${v.artist} — ${v.name}`,
    display: `${v.artist} — ${v.name}`,
  }),
  nothing_playing: () => same('Сейчас ничего не играет'),
  undo: () => ({ speech: 'Возвращаю как было', display: 'Отменено' }),
  nothing_to_undo: () => same('Нечего отменять'),
  help: () => ({
    speech:
      'Скажите: включи Скриптонита, пауза, дальше, громкость пятьдесят, лайк, перемешай, мои лайки, что играет',
    display: 'Включи…, пауза, дальше, громкость 50, лайк',
  }),
  ask: (v) => ({
    speech: `Кого включить: ${v.first} или ${v.second}?`,
    display: `${v.first} или ${v.second}?`,
  }),
  not_found: (v) => ({ speech: `Не нашлось «${v.heard}»`, display: v.heard ?? '' }),
  failed: () => same('Не получилось'),
};

const EN: Record<ReplyKey, Line> = {
  play_artist: (v) => ({ speech: `Playing ${v.name}`, display: v.name ?? '' }),
  play_track: (v) => ({
    speech: `Playing ${v.name} by ${v.artist}`,
    display: `${v.artist} — ${v.name}`,
  }),
  play_album: (v) => ({
    speech: `Playing the album ${v.name}`,
    display: `${v.artist} — ${v.name}`,
  }),
  play_playlist: (v) => ({ speech: `Playing the playlist ${v.name}`, display: v.name ?? '' }),
  queue_add: (v) => ({ speech: `Added ${v.name} to the queue`, display: `+ ${v.name}` }),
  pause: () => same('Paused'),
  resume: () => same('Resuming'),
  stop: () => same('Stopped'),
  next: () => ({ speech: 'Next track', display: 'Next' }),
  previous: () => ({ speech: 'Previous track', display: 'Back' }),
  seek_forward: (v) => ({ speech: `Forward ${v.n} seconds`, display: `+${v.n} s` }),
  seek_backward: (v) => ({ speech: `Back ${v.n} seconds`, display: `−${v.n} s` }),
  seek_to: (v) => ({ speech: `Jumping to ${clock(v.n ?? 0)}`, display: clock(v.n ?? 0) }),
  volume_set: (v) => same(`Volume ${v.n}`),
  volume_up: (v) => ({ speech: `Louder, ${v.n}`, display: `Volume ${v.n}` }),
  volume_down: (v) => ({ speech: `Quieter, ${v.n}`, display: `Volume ${v.n}` }),
  mute: () => same('Muted'),
  unmute: () => same('Sound on'),
  like: () => same('Liked'),
  unlike: () => same('Like removed'),
  shuffle_on: () => same('Shuffled'),
  shuffle_off: () => same('In order'),
  repeat_one: () => ({ speech: 'Repeating this track', display: 'Repeat one' }),
  repeat_all: () => ({ speech: 'Repeating all', display: 'Repeat all' }),
  repeat_off: () => same('Repeat off'),
  play_likes: () => ({ speech: 'Playing your likes', display: 'My likes' }),
  play_wave: () => ({ speech: 'Starting your wave', display: 'My wave' }),
  play_similar: () => ({ speech: 'Playing something similar', display: 'Similar' }),
  now_playing: (v) => ({
    speech: `This is ${v.name} by ${v.artist}`,
    display: `${v.artist} — ${v.name}`,
  }),
  nothing_playing: () => same('Nothing is playing'),
  undo: () => ({ speech: 'Back as it was', display: 'Undone' }),
  nothing_to_undo: () => same('Nothing to undo'),
  help: () => ({
    speech:
      "Say: play Billie Eilish, pause, next, volume fifty, like, shuffle, my likes, what's playing",
    display: 'Play…, pause, next, volume 50, like',
  }),
  ask: (v) => ({ speech: `${v.first} or ${v.second}?`, display: `${v.first} or ${v.second}?` }),
  not_found: (v) => ({ speech: `I couldn't find "${v.heard}"`, display: v.heard ?? '' }),
  failed: () => same("Couldn't do that"),
};

export function reply(lang: VoiceLanguage, key: ReplyKey, vars: ReplyVars = {}): Reply {
  return (lang === 'en' ? EN : RU)[key](vars);
}

export function entityReply(lang: VoiceLanguage, entity: Entity): Reply {
  const vars = { name: entity.name, artist: entity.artist };
  if (entity.kind === 'artist') return reply(lang, 'play_artist', vars);
  if (entity.kind === 'album') return reply(lang, 'play_album', vars);
  if (entity.kind === 'playlist') return reply(lang, 'play_playlist', vars);
  return reply(lang, 'play_track', vars);
}

export function entityTitle(entity: Entity): string {
  if (entity.kind === 'artist' || entity.kind === 'playlist' || !entity.artist) return entity.name;
  return `${entity.artist} — ${entity.name}`;
}
