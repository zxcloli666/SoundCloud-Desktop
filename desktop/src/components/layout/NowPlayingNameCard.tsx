import * as Popover from '@radix-ui/react-popover';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { Check, Copy, Link } from '../../lib/icons';
import { cleanPermalink } from '../../lib/permalink';
import { trackLabel } from '../../lib/track-actions';
import { getTrackDisplay } from '../../lib/track-display';
import type { Track } from '../../stores/player';

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 160;
const COPIED_MS = 1400;

type CopyKind = 'title' | 'artist' | 'label' | 'link';

function isClipped(root: HTMLElement | null): boolean {
  if (!root) return false;
  return Array.from(root.querySelectorAll<HTMLElement>('.npb-ttl, .npb-sub span')).some(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
}

function CopyChip({
  label,
  icon,
  done,
  onCopy,
}: {
  label: string;
  icon: React.ReactNode;
  done: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onCopy} className={`npb-namecard-chip${done ? ' is-done' : ''}`}>
      {done ? <Check size={13} /> : icon}
      {done ? t('player.copiedShort') : label}
    </button>
  );
}

export function NowPlayingNameCard({
  track,
  children,
}: {
  track: Track;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<CopyKind | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  };

  const enterText = () => {
    if (open) {
      window.clearTimeout(timer.current);
      return;
    }
    if (isClipped(anchor.current)) schedule(true, OPEN_DELAY_MS);
  };

  const leave = () => schedule(false, CLOSE_DELAY_MS);

  const display = getTrackDisplay(track);
  const artist = display.artistLine || track.user?.username || '';
  const link = track.permalink_url ? cleanPermalink(track.permalink_url) : null;
  const cover = art(track.artwork_url, 't200x200');

  const copy = (kind: CopyKind, text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(kind);
        window.setTimeout(
          () => setCopied((current) => (current === kind ? null : current)),
          COPIED_MS,
        );
      })
      .catch(() => undefined);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div ref={anchor} className="npb-txt" onMouseEnter={enterText} onMouseLeave={leave}>
          {children}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={18}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={() => window.clearTimeout(timer.current)}
          onMouseLeave={leave}
          className="npb-namecard"
        >
          {cover && (
            <div className="npb-namecard-bg" style={{ backgroundImage: `url(${cover})` }} />
          )}
          <div className="npb-namecard-body">
            <div className="npb-namecard-head">
              {cover && <img src={cover} alt="" />}
              <div className="min-w-0">
                <div className="npb-namecard-title selectable">{display.title}</div>
                {artist && <div className="npb-namecard-artist selectable">{artist}</div>}
              </div>
            </div>
            <div className="npb-namecard-actions">
              <CopyChip
                label={t('player.copyTitle')}
                icon={<Copy size={13} />}
                done={copied === 'title'}
                onCopy={() => copy('title', display.title)}
              />
              {artist && (
                <CopyChip
                  label={t('player.copyArtist')}
                  icon={<Copy size={13} />}
                  done={copied === 'artist'}
                  onCopy={() => copy('artist', artist)}
                />
              )}
              {artist && (
                <CopyChip
                  label={t('player.copyBoth')}
                  icon={<Copy size={13} />}
                  done={copied === 'label'}
                  onCopy={() => copy('label', trackLabel(track))}
                />
              )}
              {link && (
                <CopyChip
                  label={t('player.copyLink')}
                  icon={<Link size={13} />}
                  done={copied === 'link'}
                  onCopy={() => copy('link', link)}
                />
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
