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
    <div className="mb-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={15} className="shrink-0 mt-px text-amber-300/90" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-white/80">{t('hotkeys.wayland.title')}</p>
          <p className="text-[11.5px] text-white/45 mt-0.5 leading-snug">
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
              className="flex items-center gap-2 rounded-xl bg-black/25 border border-white/[0.05] pl-3 pr-1 py-1"
            >
              <span className="w-[120px] shrink-0 truncate text-[11.5px] text-white/50">
                {t(`hotkeys.actions.${action}`)}
              </span>
              <code className="flex-1 min-w-0 truncate text-[11.5px] text-white/75 font-mono select-text">
                {line}
              </code>
              <button
                type="button"
                onClick={() => copy(line)}
                aria-label={t('hotkeys.wayland.copy')}
                title={t('hotkeys.wayland.copy')}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/45 hover:text-white/85 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
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
