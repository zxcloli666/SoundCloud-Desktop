import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AlbumCast } from '../components/album/AlbumCast';
import { AlbumHero } from '../components/album/AlbumHero';
import { AlbumTrackList } from '../components/album/AlbumTrackList';
import { useAlbumDetail } from '../components/album/useAlbumData';
import { useArtistStar } from '../components/artist/useArtistData';
import { OfflineCopyLink } from '../components/offline/OfflineCopyLink';
import { AuraField } from '../components/user/AuraField';
import { USER_PAGE_KEYFRAMES } from '../components/user/keyframes';
import { albumScope } from '../lib/bulk-cache';
import { Loader2 } from '../lib/icons';

export function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const album = useAlbumDetail(id);
  const data = album.data;
  const { hasStar, aura } = useArtistStar(data?.primary_artist?.id);

  if (album.isLoading || (!data && !album.error)) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="text-white/30 animate-spin" />
      </div>
    );
  }

  if (album.error || !data) {
    return (
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center gap-5 text-white/40 text-sm">
        {t('common.error')}
        {id && <OfflineCopyLink scope={albumScope(id)} />}
      </div>
    );
  }

  return (
    <>
      <style>{USER_PAGE_KEYFRAMES}</style>
      <div className="relative w-full min-h-screen">
        <AuraField aura={aura} isStar={hasStar} />

        <div
          className="relative z-10 w-full max-w-[1480px] mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-32 flex flex-col gap-8"
          style={{ isolation: 'isolate' }}
        >
          <AlbumHero album={data} hasStar={hasStar} aura={aura} />
          <AlbumCast artists={data.artists} aura={aura} />
          <AlbumTrackList tracks={data.tracks} aura={aura} />
        </div>
      </div>
    </>
  );
}
