import { useTranslation } from 'react-i18next';
import type { ObsTheme } from '../../../../stores/settings';

const THEMES: Array<{ id: ObsTheme; labelKey: string }> = [
  { id: 'card', labelKey: 'settings.obsThemeCard' },
  { id: 'minimal', labelKey: 'settings.obsThemeMinimal' },
  { id: 'vinyl', labelKey: 'settings.obsThemeVinyl' },
];

function Lines() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="h-1.5 w-4/5 rounded-full bg-ink/70" />
      <span className="h-1 w-1/2 rounded-full bg-ink/35" />
      <span className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-ink/15">
        <span className="block h-full w-2/5 rounded-full bg-accent" />
      </span>
    </div>
  );
}

function Sketch({ theme }: { theme: ObsTheme }) {
  if (theme === 'vinyl') {
    return (
      <div className="flex items-center gap-2">
        <span
          className="relative size-7 shrink-0 rounded-full"
          style={{
            background: 'repeating-radial-gradient(circle, #111 0 1px, #222 1px 2px)',
            boxShadow: '0 0 0 1.5px var(--color-accent)',
          }}
        >
          <span className="absolute inset-[34%] rounded-full bg-accent" />
        </span>
        <Lines />
      </div>
    );
  }
  const card = theme === 'card';
  return (
    <div
      className={`flex items-center gap-2 ${card ? 'rounded-lg border border-ink/10 bg-ink/[0.07] p-1.5' : ''}`}
    >
      <span
        className={`shrink-0 rounded-md ${card ? 'size-6' : 'size-5'}`}
        style={{ background: 'linear-gradient(135deg, var(--color-accent), #2a2a33)' }}
      />
      <Lines />
    </div>
  );
}

export function ThemePicker({
  value,
  onChange,
}: {
  value: ObsTheme;
  onChange: (theme: ObsTheme) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map((theme) => {
        const active = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            data-active={active}
            className="set-tile gap-0"
          >
            <div className="set-tile-art flex h-10 items-center bg-shade-30 px-2">
              <div className="w-full">
                <Sketch theme={theme.id} />
              </div>
            </div>
            <span className="set-tile-label">{t(theme.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
