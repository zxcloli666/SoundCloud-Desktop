import { useTranslation } from 'react-i18next';
import { Heart, ListMusic, Loader2 } from '../../lib/icons';
import { ImportOrderPicker } from './ImportOrderPicker';

export const LIKES = 'likes';

export interface YmPlaylistInfo {
  kind: string;
  title: string;
  track_count: number;
}

export interface YmLibrary {
  owner: string;
  playlists: YmPlaylistInfo[];
}

interface Props {
  token: string;
  onToken: (token: string) => void;
  library: YmLibrary | null;
  loading: boolean;
  error: string | null;
  selected: string;
  onSelect: (kind: string) => void;
  onConnect: () => void;
  disabled: boolean;
}

const ROW =
  'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

export function ImportYandexTab(props: Props) {
  const { t } = useTranslation();
  const { library, selected, disabled } = props;

  if (!library) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 text-[13px] text-ink-50">
          <p className="font-medium text-ink-70">{t('importer.instructions')}</p>
          <ol className="list-decimal list-inside space-y-1 text-[12px]">
            <li>{t('importer.step1')}</li>
            <li>{t('importer.step2')}</li>
            <li>{t('importer.step3')}</li>
          </ol>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={props.token}
            onChange={(e) => props.onToken(e.target.value)}
            placeholder={t('importer.tokenPlaceholder')}
            disabled={disabled || props.loading}
            className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-ink/[0.04] border border-ink/[0.06] text-[13px] text-ink-80 placeholder:text-ink-20 focus:border-ink/[0.12] focus:bg-ink/[0.06] transition-all duration-200 outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={props.onConnect}
            disabled={!props.token.trim() || props.loading || disabled}
            className="flex items-center gap-2 px-5 rounded-xl bg-accent/20 hover:bg-accent/30 text-[13px] font-semibold text-accent border border-accent/20 transition-all cursor-pointer disabled:opacity-30"
          >
            {props.loading && <Loader2 size={14} className="animate-spin" />}
            {t('importer.connect')}
          </button>
        </div>
        {props.error && <p className="text-[12px] text-red-300">{props.error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => props.onSelect(LIKES)}
          className={`${ROW} ${selected === LIKES ? 'border-accent/30 bg-accent/10' : 'border-ink/[0.06] bg-ink/[0.03] hover:bg-ink/[0.06]'}`}
        >
          <Heart size={15} className="shrink-0 text-accent" />
          <span className="flex-1 truncate text-[13px] font-medium text-ink-85">
            {t('importer.likes')}
          </span>
        </button>
        {library.playlists.map((playlist) => (
          <button
            key={playlist.kind}
            type="button"
            disabled={disabled}
            onClick={() => props.onSelect(playlist.kind)}
            className={`${ROW} ${selected === playlist.kind ? 'border-accent/30 bg-accent/10' : 'border-ink/[0.06] bg-ink/[0.03] hover:bg-ink/[0.06]'}`}
          >
            <ListMusic size={15} className="shrink-0 text-ink-40" />
            <span className="flex-1 truncate text-[13px] font-medium text-ink-85">
              {playlist.title}
            </span>
            <span className="font-mono text-[11px] text-ink-40">{playlist.track_count}</span>
          </button>
        ))}
      </div>
      {selected === LIKES && <ImportOrderPicker disabled={disabled} />}
    </div>
  );
}
