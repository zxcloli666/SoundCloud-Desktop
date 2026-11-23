import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertCircle, ClipboardCopy } from '../../../lib/icons';

const MPRIS_PLAYER = 'soundcloud_desktop';

const COMMANDS = [
  { action: 'playPause', command: 'play-pause' },
  { action: 'next', command: 'next' },
  { action: 'prev', command: 'previous' },
] as const;

export function WaylandHotkeysHint() {
  const { t } = useTranslation();

  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t('hotkeys.wayland.copied')))
      .catch(() => toast.error(t('common.error')));
  };

  return (
    <div className="rounded-[12px] bg-amber-400/[0.08] p-3">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={14} className="mt-px shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-ink-80">{t('hotkeys.wayland.title')}</p>
          <p className="text-[11.5px] text-ink-45 mt-0.5 leading-snug">
            {t('hotkeys.wayland.desc')}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {COMMANDS.map(({ action, command }) => {
          const line = `playerctl -p ${MPRIS_PLAYER} ${command}`;
          return (
            <div
              key={action}
              className="flex items-center gap-2 rounded-[9px] bg-[var(--set-well)] py-1 pr-1 pl-3"
            >
              <span className="w-[120px] shrink-0 truncate text-[11.5px] text-ink-50">
                {t(`hotkeys.actions.${action}`)}
              </span>
              <code className="flex-1 min-w-0 truncate text-[11.5px] text-ink-75 font-mono select-text">
                {line}
              </code>
              <button
                type="button"
                onClick={() => copy(line)}
                aria-label={t('hotkeys.wayland.copy')}
                title={t('hotkeys.wayland.copy')}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-45 hover:text-ink-85 hover:bg-ink/[0.08] transition-all duration-200 cursor-pointer"
              >
                <ClipboardCopy size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
