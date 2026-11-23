import { useTranslation } from 'react-i18next';
import type { Scheme, SchemeChoice } from '../../../lib/scheme';
import { activeLook } from '../../../lib/themes/records';
import { useSettingsStore } from '../../../stores/settings';
import { useThemesStore } from '../../../stores/themes';
import { Row } from '../primitives';

const CHOICES: SchemeChoice[] = ['dark', 'white', 'system'];

function MiniWindow({ scheme, className = '' }: { scheme: Scheme; className?: string }) {
  return (
    <div data-scheme={scheme} className={`absolute inset-y-0 flex bg-paper ${className}`}>
      <div className="h-full w-1/4 space-y-1 border-r border-ink/[0.06] bg-ink/[0.05] p-1.5">
        <div className="h-1 w-3/4 rounded-full bg-accent" />
        <div className="h-1 w-full rounded-full bg-ink/20" />
        <div className="h-1 w-2/3 rounded-full bg-ink/20" />
      </div>
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-1.5 w-1/2 rounded-full bg-ink/60" />
        <div className="h-5 rounded-md border border-ink/[0.08] bg-ink/[0.06]" />
        <div className="h-1 w-3/4 rounded-full bg-ink/20" />
      </div>
    </div>
  );
}

export function SchemePicker() {
  const { t } = useTranslation();
  const scheme = useSettingsStore((s) => s.scheme);
  const setScheme = useSettingsStore((s) => s.setScheme);
  const locked = useThemesStore(activeLook) !== null;

  return (
    <Row title={t('settings.scheme')} stacked>
      <div
        className={`grid w-full grid-cols-3 gap-2.5 ${locked ? 'pointer-events-none opacity-50' : ''}`}
      >
        {CHOICES.map((id) => (
          <button
            key={id}
            type="button"
            data-ui="segment"
            data-active={scheme === id}
            onClick={() => setScheme(id)}
            className="set-tile"
          >
            <span className="set-tile-art h-[60px]">
              {id === 'system' ? (
                <>
                  <MiniWindow
                    scheme="dark"
                    className="left-0 w-full [clip-path:polygon(0_0,55%_0,45%_100%,0_100%)]"
                  />
                  <MiniWindow
                    scheme="white"
                    className="left-0 w-full [clip-path:polygon(55%_0,100%_0,100%_100%,45%_100%)]"
                  />
                </>
              ) : (
                <MiniWindow scheme={id} className="inset-x-0" />
              )}
            </span>
            <span className="set-tile-label text-center">{t(`settings.scheme_${id}`)}</span>
          </button>
        ))}
      </div>
    </Row>
  );
}
