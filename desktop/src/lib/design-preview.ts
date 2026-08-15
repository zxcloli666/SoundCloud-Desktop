import type { Track } from '../stores/player';

const designPreviewRequested =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('design-preview');

export function isDesignPreview(): boolean {
  return designPreviewRequested;
}

const previewCovers = [
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=640&h=640&q=85',
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=480&h=480&q=82',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=480&h=480&q=82',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=480&h=480&q=82',
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=480&h=480&q=82',
  'https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?auto=format&fit=crop&w=480&h=480&q=82',
  'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=480&h=480&q=82',
  'https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=480&h=480&q=82',
];

const previewData = [
  ['Ashes in the Hall', 'VANTA', 'NOCTURNE', 214000, 'Alternative'],
  ['Low Light', 'Morrow Lines', 'Night Index', 188000, 'Ambient'],
  ['Passing Static', 'Vale', 'Soft Current', 241000, 'Electronic'],
  ['Glass District', 'Minor Forms', 'Glass District', 197000, 'Indie'],
  ['Warm Signal', 'Other Hours', 'Passing Places', 226000, 'Downtempo'],
  ['Northbound', 'Grey Arc', 'Intervals', 203000, 'Alternative'],
  ['Folded Sky', 'Quiet Color', 'Folded Sky', 259000, 'Dream Pop'],
  ['Afterimage', 'Serein', 'Still Moving', 232000, 'Electronic'],
] as const;

export const designPreviewTracks: Track[] = previewData.map(
  ([title, artist, album, duration, genre], index) => ({
    id: index + 1,
    urn: `soundcloud:tracks:900000${index}`,
    title,
    duration,
    artwork_url: previewCovers[index],
    genre,
    description:
      index === 0
        ? 'A sparse late-night record that moves between worn tape, close vocals and patient low-end.'
        : undefined,
    release_year: 2026 - (index % 3),
    user_favorite: index % 3 === 0,
    user: {
      id: 100 + index,
      urn: `soundcloud:users:${100 + index}`,
      username: artist,
      avatar_url: previewCovers[index],
      permalink_url: '',
    },
    enrichment: {
      state: 'done',
      upload_kind: 'track',
      album: {
        id: `preview-${index}`,
        title: album,
        year: 2026 - (index % 3),
        cover_url: previewCovers[index],
        type: 'album',
      },
    },
  }),
);
