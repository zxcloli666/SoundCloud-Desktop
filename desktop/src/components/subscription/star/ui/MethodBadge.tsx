import { memo } from 'react';
import type { MethodId } from '../../../../lib/pay-client';
import { MethodGlyph } from '../../MethodGlyph';

export const MethodBadge = memo(function MethodBadge({
  kind,
  linked = false,
  size = 36,
}: {
  kind: MethodId;
  linked?: boolean;
  size?: number;
}) {
  return (
    <span
      data-scheme="dark"
      className="grid shrink-0 place-items-center rounded-[11px]"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(160deg, #2b2b33, #17171c)',
        boxShadow: 'inset 0 0 0 1px rgb(var(--ink) / 0.08)',
      }}
    >
      <MethodGlyph kind={kind} linked={linked} />
    </span>
  );
});
