import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clearDislike, dislikeTrack } from '../../../lib/dislike-actions';
import { useDislikeStatus } from '../../../lib/dislikes';
import { Ban, ThumbsDown } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { type BlockTarget, trackTargets } from '../blocklist/targets';
import { useBlockToggle } from '../blocklist/useBlockToggle';
import { MenuItem } from './MenuItem';

type Run = (action: () => void) => () => void;

export function DislikeItem({ track, run }: { track: Track; run: Run }) {
  const { t } = useTranslation();
  const disliked = useDislikeStatus(track.urn);
  const toggle = () => (disliked ? clearDislike(track.urn) : void dislikeTrack(track));
  return (
    <MenuItem
      tone="danger"
      active={disliked}
      icon={<ThumbsDown size={15} fill={disliked ? 'currentColor' : 'none'} />}
      label={disliked ? t('track.removeDislike') : t('track.dislike')}
      onSelect={run(toggle)}
    />
  );
}

function BlockItem({ target, run }: { target: BlockTarget; run: Run }) {
  const { t } = useTranslation();
  const { blocked, toggle } = useBlockToggle(target);
  const label = blocked ? 'trackMenu.unblock' : 'trackMenu.block';
  return (
    <MenuItem
      tone="danger"
      active={blocked}
      icon={<Ban size={15} />}
      label={t(label, { name: target.name })}
      onSelect={run(toggle)}
    />
  );
}

export function BlockItems({ track, run }: { track: Track; run: Run }) {
  const targets = useMemo(() => trackTargets(track), [track]);
  return targets.map((target) => (
    <BlockItem key={`${target.kind}:${target.id}`} target={target} run={run} />
  ));
}
