import { memo, type ReactNode } from 'react';

export const SettingsFrame = memo(function SettingsFrame({ children }: { children: ReactNode }) {
  return <div className="sonveil-section-page">{children}</div>;
});
