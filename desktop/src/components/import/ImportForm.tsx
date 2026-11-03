import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import { type ImportRequest, useImportStore } from '../../stores/import';
import { ImportLinkTab } from './ImportLinkTab';
import { ImportTextTab } from './ImportTextTab';
import { ImportYandexTab, LIKES, type YmLibrary } from './ImportYandexTab';

const TABS = ['yandex', 'link', 'text'] as const;
type Tab = (typeof TABS)[number];

export function ImportForm() {
  const { t } = useTranslation();
  const startImport = useImportStore((s) => s.startImport);
  const prefill = useImportStore((s) => s.prefill);
  const [tab, setTab] = useState<Tab>(prefill?.tab ?? 'yandex');
  const [token, setToken] = useState('');
  const [library, setLibrary] = useState<YmLibrary | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [selected, setSelected] = useState(LIKES);
  const [url, setUrl] = useState(prefill?.tab === 'link' ? prefill.value : '');
  const [detected, setDetected] = useState<string | null>(null);
  const [text, setText] = useState(prefill?.tab === 'text' ? prefill.value : '');

  useEffect(() => {
    let current = true;
    const input = url.trim();
    const lookup = input
      ? invoke<string | null>('import_detect', { input })
      : Promise.resolve(null);
    lookup.then(
      (source) => current && setDetected(source),
      () => current && setDetected(null),
    );
    return () => {
      current = false;
    };
  }, [url]);

  const connect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      setLibrary(await invoke<YmLibrary>('import_ym_library', { token }));
      setSelected(LIKES);
    } catch (error) {
      setConnectError(
        t(`importer.err.${typeof error === 'string' ? error : 'unknown'}`, {
          defaultValue: t('importer.err.unknown'),
        }),
      );
    } finally {
      setConnecting(false);
    }
  };

  const request = (): ImportRequest | null => {
    if (tab === 'text') return text.trim() ? { kind: 'text', text } : null;
    if (tab === 'link') {
      return detected ? { kind: 'link', url: url.trim(), token: token.trim() || undefined } : null;
    }
    if (!library) return null;
    if (selected === LIKES) return { kind: 'ym_likes', token };
    return { kind: 'ym_playlist', token, owner: library.owner, playlist: selected };
  };

  const ready = request();

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        className="flex gap-0.5 rounded-[11px] border border-ink/[0.08] bg-ink/[0.02] p-[3px]"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
              tab === id
                ? 'bg-ink/[0.08] text-ink-92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'text-ink-50 hover:text-ink-80'
            }`}
          >
            {t(`importer.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'yandex' && (
        <ImportYandexTab
          token={token}
          onToken={setToken}
          library={library}
          loading={connecting}
          error={connectError}
          selected={selected}
          onSelect={setSelected}
          onConnect={connect}
          disabled={false}
        />
      )}
      {tab === 'link' && (
        <ImportLinkTab url={url} onUrl={setUrl} detected={detected} disabled={false} />
      )}
      {tab === 'text' && <ImportTextTab text={text} onText={setText} disabled={false} />}

      <p className="text-[12px] text-ink-30">{t('importer.limitHint')}</p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => ready && void startImport(ready)}
          disabled={!ready}
          className="px-5 py-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-[13px] font-semibold text-accent border border-accent/20 transition-all cursor-pointer disabled:opacity-30"
        >
          {t('importer.start')}
        </button>
      </div>
    </div>
  );
}
