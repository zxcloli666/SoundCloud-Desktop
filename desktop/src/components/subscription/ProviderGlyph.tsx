import { memo } from 'react';
import type { ActivationKind } from './providers';

/* Provider glyphs. SBP keeps its real brand violet/blue (the one functional
 * color exception); everything else derives from the accent / neutral ink. */
export const ProviderGlyph = memo(function ProviderGlyph({
  kind,
}: {
  kind: ActivationKind | 'boosty_card';
}) {
  switch (kind) {
    case 'sbp':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12L9 5l4 7-4 7L5 12z" fill="var(--color-accent)" />
          <path d="M11 12l4-7 4 7-4 7-4-7z" fill="#7a5cff" opacity=".85" />
        </svg>
      );
    case 'card_ru':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="2.5"
            y="5"
            width="19"
            height="14"
            rx="2.5"
            stroke="#fff"
            strokeOpacity=".8"
            strokeWidth="1.5"
          />
          <path d="M2.5 9h19" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
        </svg>
      );
    case 'boosty_card':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="2.5"
            y="5"
            width="19"
            height="14"
            rx="2.5"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          <path d="M2.5 9.5h19" stroke="var(--color-accent)" strokeWidth="1.5" />
          <path
            d="M15 15.2a2.2 2.2 0 11-.7-1.6M15.2 12.8v1.7h-1.7"
            stroke="var(--color-accent)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'card_intl':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
          <path
            d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
            stroke="#fff"
            strokeOpacity=".7"
            strokeWidth="1.2"
          />
        </svg>
      );
    case 'crypto_platega':
      // On-chain crypto — a coin mark.
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="var(--color-accent)" strokeWidth="1.5" />
          <path
            d="M9.5 8h4a2 2 0 010 4h-4m0 0h4.3a2 2 0 010 4H9.5m0-8v10M11 6.5v1.5M11 16v1.5"
            stroke="var(--color-accent)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'crypto_bot':
      // CryptoBot hot wallet — a wallet with a coin slot.
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="6"
            width="18"
            height="13"
            rx="3"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          <path
            d="M3 10h13a2 2 0 012 2v0a2 2 0 01-2 2H3"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          <circle cx="16.5" cy="12" r="1.2" fill="var(--color-accent)" />
        </svg>
      );
    case 'tgstars':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.4 6.5 19.6l1.4-6.1L3.2 9.3l6.2-.6L12 3z"
            fill="var(--color-accent)"
          />
        </svg>
      );
  }
});
