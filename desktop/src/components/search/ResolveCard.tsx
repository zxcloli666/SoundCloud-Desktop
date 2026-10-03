import { AlertCircle, Link2, Loader2, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { usePerfMode } from '../../lib/perf';
import { type ResolvedEntity, resolveLink } from '../../lib/resolve';

interface ResolveCardProps {
  url: string;
  onDone: () => void;
}

interface ResolveFailure {
  messageKey: string;
  retryAfter?: number;
}

const KIND_ROUTES: Record<string, { route: string; ns: string }> = {
  track: { route: 'track', ns: 'tracks' },
  user: { route: 'user', ns: 'users' },
  playlist: { route: 'playlist', ns: 'playlists' },
};

const URN_ROUTES: Record<string, string> = {
  tracks: 'track',
  users: 'user',
  playlists: 'playlist',
};

function resolvedRoute(resolved: ResolvedEntity | null | undefined): string | null {
  if (!resolved) return null;
  const ns = resolved.urn?.split(':')[1];
  if (resolved.urn && ns && URN_ROUTES[ns]) {
    return `/${URN_ROUTES[ns]}/${encodeURIComponent(resolved.urn)}`;
  }
  const target = KIND_ROUTES[resolved.kind ?? 'track'];
  if (!target || resolved.id == null) return null;
  return `/${target.route}/${encodeURIComponent(`soundcloud:${target.ns}:${resolved.id}`)}`;
}

function failureOf(error: unknown): ResolveFailure {
  if (!(error instanceof ApiError)) return { messageKey: 'search.resolve.errorTitle' };
  if (error.status === 404) return { messageKey: 'search.resolve.gone' };
  if (error.status === 400 || error.status === 422) {
    return { messageKey: 'search.resolve.notALink' };
  }
  if (error.status === 429 || error.status >= 500) {
    return { messageKey: 'search.resolve.upstream', retryAfter: error.retryAfterSec };
  }
  return { messageKey: 'search.resolve.errorTitle' };
}

function useSecondsLeft(seconds: number | undefined): number {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    setLeft(seconds ?? 0);
    if (!seconds) return;
    const timer = window.setInterval(() => {
      setLeft((value) => Math.max(0, value - 1));
    }, 1000);
    const stop = window.setTimeout(() => window.clearInterval(timer), seconds * 1000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [seconds]);
  return left;
}

export const ResolveCard = memo(function ResolveCard({ url, onDone }: ResolveCardProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<ResolveFailure | null>(null);
  const runRef = useRef(0);
  const left = useSecondsLeft(failure?.retryAfter);

  const run = useCallback(() => {
    const id = ++runRef.current;
    setFailure(null);
    resolveLink(url)
      .then((resolved) => {
        if (id !== runRef.current) return;
        const route = resolvedRoute(resolved);
        if (!route) {
          setFailure({ messageKey: 'search.resolve.notALink' });
          return;
        }
        navigate(route);
        onDone();
      })
      .catch((error) => {
        if (id === runRef.current) setFailure(failureOf(error));
      });
  }, [url, navigate, onDone]);

  useEffect(() => {
    run();
    return () => {
      runRef.current += 1;
    };
  }, [run]);

  const b = perf.blur(40);
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
            {failure ? t(failure.messageKey) : t('search.resolve.loading')}
          </p>
          {failure && left > 0 && (
            <p className="text-[12px] text-white/45">
              {t('search.resolve.retryIn', { seconds: left })}
            </p>
          )}
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-white/40 font-mono">
            <Link2 size={12} />
            <span className="max-w-[300px] truncate">{url}</span>
          </p>
        </div>
        {failure && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={run}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[13px] text-white/90 cursor-pointer transition-colors hover:bg-white/[0.08]"
              style={{ border: '0.5px solid var(--color-accent)' }}
            >
              <RefreshCw size={13} />
              {t('search.live.retry')}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="h-9 px-5 rounded-full text-[13px] text-white/80 cursor-pointer transition-colors hover:bg-white/[0.06]"
              style={{ border: '0.5px solid rgba(255,255,255,0.12)' }}
            >
              {t('search.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
