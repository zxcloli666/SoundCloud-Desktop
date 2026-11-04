import { useEffect, useState } from 'react';
import { shareText } from '../../lib/together/session';

const COPIED_MS = 1600;

export function useCopyInvite(code: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(shareText(code))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return { copied, copy };
}
