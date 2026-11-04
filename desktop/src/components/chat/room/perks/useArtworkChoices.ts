import { useMemo } from 'react';
import { useMyPlaylists, useUserTracks } from '../../../../lib/hooks';
import { useAuthStore } from '../../../../stores/auth';
import { isCoverUrl, sizedArt } from './perks';

export type ArtworkKind = 'avatar' | 'playlist' | 'track';

export interface ArtworkChoice {
  url: string;
  kind: ArtworkKind;
  label: string;
}

export interface ArtworkChoices {
  choices: ArtworkChoice[];
  loading: boolean;
  failed: boolean;
  partial: boolean;
  retry: () => void;
}

const STORED_SIZE = 't500x500';

interface Source {
  url: string | null | undefined;
  kind: ArtworkKind;
  label: string;
}

function collect(sources: Source[]): ArtworkChoice[] {
  const seen = new Set<string>();
  const out: ArtworkChoice[] = [];
  for (const source of sources) {
    if (!source.url || source.url.includes('default_avatar')) continue;
    const url = sizedArt(source.url, STORED_SIZE);
    if (!isCoverUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, kind: source.kind, label: source.label });
  }
  return out;
}

export function useArtworkChoices(enabled: boolean): ArtworkChoices {
  const user = useAuthStore((s) => s.user);
  const tracks = useUserTracks(enabled ? user?.urn : undefined);
  const playlists = useMyPlaylists(30, enabled && !!user);

  const choices = useMemo(
    () =>
      collect([
        { url: user?.avatar_url, kind: 'avatar', label: user?.username ?? '' },
        ...playlists.playlists.map((p) => ({
          url: p.artwork_url,
          kind: 'playlist' as const,
          label: p.title,
        })),
        ...tracks.tracks.map((t) => ({
          url: t.artwork_url,
          kind: 'track' as const,
          label: t.title,
        })),
      ]),
    [user?.avatar_url, user?.username, playlists.playlists, tracks.tracks],
  );

  const pending = tracks.isLoading || playlists.isLoading;
  return {
    choices,
    loading: pending && choices.length <= 1,
    failed: !pending && tracks.isError && playlists.isError && choices.length === 0,
    partial: !pending && (tracks.isError || playlists.isError),
    retry: () => {
      void tracks.refetch();
      void playlists.refetch();
    },
  };
}
