const TITLES = [
  'Night Drive',
  'Glass Rooms',
  'Low Tide',
  'Paper Moons',
  'Afterglow',
  'Static Bloom',
  'Slow Orbit',
  'Neon Rain',
  'Soft Machines',
  'Northern Lights',
  'Velvet Hours',
  'Echo Park',
  'Silver Lining',
  'Undertow',
  'Lantern',
  'Cold Coffee',
  'Satellite Hearts',
  'Midnight Swim',
  'Daydream',
  'Polaroid',
  'Blue Hour',
  'Faraway',
  'Wildflower',
  'Stardust',
];

const ARTISTS = ['Luma Vale', 'Okto', 'Mira Sol', 'Hollow Pines', 'Kairo', 'Eastside Tapes'];
const GENRES = ['Electronic', 'Lo-fi', 'Indie', 'Ambient', 'House', 'Synthwave'];

const user = (index) => ({
  id: 9000 + index,
  urn: `soundcloud:users:${9000 + index}`,
  username: ARTISTS[index],
  avatar_url: `https://i1.sndcdn.com/avatars-preview-${index}-large.jpg`,
  permalink_url: `https://soundcloud.com/preview-${index}`,
  followers_count: 12000 + index * 3100,
  followings_count: 80,
  track_count: 40,
  playlist_count: 6,
});

export const tracks = TITLES.map((title, index) => ({
  id: 1000 + index,
  urn: `soundcloud:tracks:${1000 + index}`,
  title,
  duration: 150000 + ((index * 37000) % 120000),
  artwork_url: `https://i1.sndcdn.com/artworks-preview-${index}-large.jpg`,
  permalink_url: `https://soundcloud.com/preview/track-${index}`,
  genre: GENRES[index % GENRES.length],
  created_at: `2026-0${1 + (index % 9)}-1${index % 10}T12:00:00Z`,
  playback_count: 48000 + index * 7300,
  likes_count: 2100 + index * 340,
  reposts_count: 120 + index * 11,
  comment_count: 40 + index,
  access: 'playable',
  user_favorite: true,
  user: user(index % ARTISTS.length),
}));

const page = (collection) => ({
  collection,
  page: 0,
  page_size: collection.length,
  has_more: false,
});
const cluster = (id, from, to) => {
  const picked = tracks.slice(from, to);
  return { id, track_ids: picked.map((track) => String(track.id)), tracks: picked };
};

export const api = {
  '/me/cold': {
    ...user(0),
    username: 'preview',
    likes_count: tracks.length,
    public_favorites_count: tracks.length,
  },
  '/me/subscription': { premium: false },
  '/dislikes/ids': { urns: [] },
  '/me/likes/tracks': page(tracks),
  '/recommendations': {
    clusters: [
      cluster('wave', 4, 12),
      cluster('for_you', 12, 18),
      cluster('fresh_drops', 18, 24),
      cluster('top_artists', 0, 6),
    ],
  },
};

export const player = {
  state: {
    volume: 0.8,
    currentTrack: tracks[4],
    queue: tracks.slice(0, 12),
    queueIndex: 4,
    shuffle: false,
    repeat: 'off',
  },
  version: 3,
};
