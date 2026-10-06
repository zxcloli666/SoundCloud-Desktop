import { AlertCircle, ArrowLeft, Link2, Loader2, RefreshCw } from 'lucide-react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api-client';
import { usePerfMode } from '../../lib/perf';
import { type ResolvedEntity, useResolvedLink } from '../../lib/search';
import { linkRoute, type SoundCloudLink } from '../../lib/soundcloudLink';
import { useSearchQueryStore } from '../../stores/searchQuery';

const KIND_NAMESPACE: Record<string, string> = {
  track: 'tracks',
  playlist: 'playlists',
  user: 'users',
};

function entityRoute(entity: ResolvedEntity): string | null {
  if (entity.urn) return linkRoute(entity.urn);
  const ns = KIND_NAMESPACE[entity.kind ?? ''];
  return ns && entity.id != null ? linkRoute(`soundcloud:${ns}:${entity.id}`) : null;
}

type Failure = 'notFound' | 'unsupported' | 'unreachable';

function failureOf(error: unknown): Failure {
  if (error instanceof ApiError && error.status === 404) return 'notFound';
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return 'unsupported';
  return 'unreachable';
}

export const LinkOpen = memo(function LinkOpen({ link }: { link: SoundCloudLink }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setQ = useSearchQueryStore((s) => s.setQ);
  const url = link.kind === 'url' ? link.url : null;
  const resolved = useResolvedLink(url);
  const target =
    link.kind === 'urn' ? linkRoute(link.urn) : resolved.data ? entityRoute(resolved.data) : null;

  useEffect(() => {
    if (!target) return;
    navigate(target);
    setQ('');
  }, [target, navigate, setQ]);

  const failure: Failure | null = resolved.isError
    ? failureOf(resolved.error)
    : resolved.data && !target
      ? 'unsupported'
      : null;
  const b = usePerfMode().blur(40);

  return (
    <div className="flex justify-center px-4 pt-16">
      <div
        className="w-full max-w-[440px] flex flex-col items-center gap-4 p-8 rounded-[2rem] text-center"
        style={{
          background:
            b > 0
              ? 'linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
              : 'rgba(18,18,22,0.85)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          backdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          isolation: 'isolate',
        }}
      >
        <div
          className="w-14 h-14 flex items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          {failure ? (
            <AlertCircle size={24} className="text-white/50" />
          ) : (
            <Loader2 size={24} className="text-accent animate-spin" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-white/90">
            {failure ? t(`search.link.${failure}Title`) : t('search.link.opening')}
          </p>
          {failure === 'notFound' && (
            <p className="text-[12px] text-white/45">{t('search.link.notFoundBody')}</p>
          )}
          {failure === 'unreachable' && (
            <p className="text-[12px] text-white/45">{t('search.link.unreachableBody')}</p>
          )}
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-white/40 font-mono">
            <Link2 size={12} />
            <span className="max-w-[300px] truncate">
              {url ?? (link.kind === 'urn' ? link.urn : '')}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQ('')}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[13px] text-white/80 cursor-pointer transition-colors hover:bg-white/[0.06]"
            style={{ border: '0.5px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={14} />
            {t('search.back')}
          </button>
          {failure === 'unreachable' && (
            <button
              type="button"
              onClick={() => void resolved.refetch()}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[13px] text-white/80 cursor-pointer transition-colors hover:bg-white/[0.06]"
              style={{ border: '0.5px solid rgba(255,255,255,0.12)' }}
            >
              <RefreshCw size={14} />
              {t('search.error.retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
