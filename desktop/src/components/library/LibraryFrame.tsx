import { memo, type ReactNode } from 'react';

/** Lightweight shared shell for every Library surface. */
export const LibraryFrame = memo(function LibraryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="sonveil-library-frame">
      <div className="sonveil-library-content">{children}</div>
    </div>
  );
});
