import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Trash2 } from '../../../lib/icons';
import { answerLink } from '../../../lib/voice/remote';
import { REMOTE_LINKS_KEY, remoteApi } from '../../../lib/voice/remote-api';
import type {
  LinkAsk,
  LinkCode,
  RemoteLink,
  SpeakerProvider,
} from '../../../lib/voice/remote-types';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { Card } from '../../settings/primitives';
import { RadioTower } from '../icons';
import { ago } from '../time';
import { Pill, SmallButton } from './Block';
import { LinkCodePanel } from './LinkCodePanel';
import { ProviderGlyph } from './ProviderGlyph';

const PROVIDERS: SpeakerProvider[] = ['alice', 'salut'];
function LinkRow({ link, now, lang }: { link: RemoteLink; now: number; lang: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const revoke = async () => {
    setBusy(true);
    try {
      await remoteApi.revoke(link.id);
      qc.setQueryData<RemoteLink[]>(REMOTE_LINKS_KEY, (list) =>
        list?.filter((l) => l.id !== link.id),
      );
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  const used = link.lastUsedAt ? ago(link.lastUsedAt, now, lang) : null;
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <ProviderGlyph provider={link.provider} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink-85">
          {t(`voice.speakers.${link.provider}`)}
        </p>
        <p className="truncate text-[11.5px] text-ink-40">
          {used ? t('voice.speakers.lastUsed', { when: used }) : t('voice.speakers.neverUsed')}
        </p>
      </div>
      {confirm ? (
        <span className="flex items-center gap-1.5">
          <SmallButton danger onClick={() => void revoke()} disabled={busy}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            {t('voice.speakers.revokeYes')}
          </SmallButton>
          <SmallButton onClick={() => setConfirm(false)}>{t('voice.speakers.cancel')}</SmallButton>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          aria-label={t('voice.speakers.revoke')}
          title={t('voice.speakers.revoke')}
          className="flex size-8 cursor-pointer items-center justify-center rounded-xl text-ink-35 transition-colors hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function LinkConfirm({ ask }: { ask: LinkAsk }) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="voice-link-confirm"
      className="mt-3 flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/[0.06] p-3"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink-90">
          {t(`voice.speakers.confirm.${ask.provider}`)}
        </p>
        <p className="truncate text-[11.5px] text-ink-45">{t('voice.speakers.confirmSub')}</p>
      </div>
      <SmallButton onClick={() => answerLink(ask.id, false)}>{t('voice.speakers.no')}</SmallButton>
      <SmallButton primary onClick={() => answerLink(ask.id, true)}>
        {t('voice.speakers.yes')}
      </SmallButton>
    </div>
  );
}

function ProviderTile({
  provider,
  linked,
  onLinked,
}: {
  provider: SpeakerProvider;
  linked: number;
  onLinked: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState<LinkCode | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed' | 'linked'>('idle');
  const [baseline, setBaseline] = useState(linked);
  const ask = useVoiceRuntime((s) => (s.linkAsk?.provider === provider ? s.linkAsk : null));

  useEffect(() => {
    if (code && linked > baseline) {
      setCode(null);
      setState('linked');
      onLinked();
    }
  }, [code, linked, baseline, onLinked]);

  const connect = async () => {
    setState('loading');
    try {
      setBaseline(linked);
      setCode(await remoteApi.linkCode(provider));
      setState('idle');
    } catch {
      setState('failed');
    }
  };
  const cancel = useCallback(() => setCode(null), []);

  return (
    <div
      data-ui="voice-speaker"
      className={`rounded-[1.4rem] border p-4 transition-colors duration-500 ${code ? 'border-accent/30 bg-ink/[0.03]' : 'border-ink/[0.07] bg-ink/[0.02]'}`}
    >
      <div className="flex items-center gap-3">
        <ProviderGlyph provider={provider} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink-90">{t(`voice.speakers.${provider}`)}</p>
          <div className="mt-1">
            {state === 'linked' ? (
              <Pill tone="ok">
                <Check size={11} />
                {t('voice.speakers.justLinked')}
              </Pill>
            ) : linked > 0 ? (
              <Pill tone="ok">{t('voice.speakers.linked', { count: linked })}</Pill>
            ) : (
              <Pill tone="muted">{t('voice.speakers.notLinked')}</Pill>
            )}
          </div>
        </div>
        {!code && (
          <SmallButton
            primary={linked === 0}
            onClick={() => void connect()}
            disabled={state === 'loading'}
          >
            {state === 'loading' && <Loader2 size={12} className="animate-spin" />}
            {linked > 0 ? t('voice.speakers.addMore') : t('voice.speakers.connect')}
          </SmallButton>
        )}
      </div>
      {state === 'failed' && (
        <p className="mt-2 text-[11.5px] text-bad">{t('voice.speakers.codeFailed')}</p>
      )}
      {ask ? (
        <LinkConfirm ask={ask} />
      ) : (
        code && (
          <LinkCodePanel provider={provider} code={code} onCancel={cancel} onExpired={cancel} />
        )
      )}
    </div>
  );
}

function RemoteDot() {
  const { t } = useTranslation();
  const remote = useVoiceRuntime((s) => s.remote);
  if (remote === 'off') return null;
  const live = remote === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${live ? 'text-ok' : 'text-amber-300'}`}
    >
      <span
        className={`size-1.5 rounded-full ${live ? 'bg-ok' : 'bg-amber-400'} motion-reduce:animate-none`}
        style={{ animation: 'vx-wait 2s ease-in-out infinite' }}
      />
      {t(`voice.speakers.remote.${remote}`)}
    </span>
  );
}

export function SpeakersCard() {
  const { t, i18n } = useTranslation();
  const [watching, setWatching] = useState(false);
  const links = useQuery({
    queryKey: REMOTE_LINKS_KEY,
    queryFn: () => remoteApi.links().then((r) => r.links),
    staleTime: 30_000,
    refetchInterval: watching ? 4000 : false,
  });
  const list = links.data ?? [];
  const now = Date.now();
  const stopWatching = useCallback(() => setWatching(false), []);

  return (
    <Card title={t('voice.speakers.title')} icon={<RadioTower size={17} />} action={<RemoteDot />}>
      <div
        className="grid grid-cols-1 gap-2.5 md:grid-cols-2"
        onClickCapture={() => setWatching(true)}
      >
        {PROVIDERS.map((p) => (
          <ProviderTile
            key={p}
            provider={p}
            linked={list.filter((l) => l.provider === p).length}
            onLinked={stopWatching}
          />
        ))}
      </div>
      {list.length > 0 && (
        <div className="mt-4 divide-y divide-ink/[0.05] border-t border-ink/[0.05] pt-4">
          {list.map((link) => (
            <LinkRow key={link.id} link={link} now={now} lang={i18n.language} />
          ))}
        </div>
      )}
    </Card>
  );
}
