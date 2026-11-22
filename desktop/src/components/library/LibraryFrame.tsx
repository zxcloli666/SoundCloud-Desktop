import { memo, type ReactNode } from 'react';
import { LIBRARY_KEYFRAMES } from './keyframes';

export const LibraryFrame = memo(function LibraryFrame({
  page = 'library',
  children,
}: {
  page?: 'library' | 'history';
  children: ReactNode;
}) {
  return (
    <div data-ui="page" data-page={page} className="relative min-h-full w-full">
      <style>{LIBRARY_KEYFRAMES}</style>
      <div className="relative mx-auto min-h-full max-w-[1320px] px-4 pb-6 pt-5 md:px-8">
        {children}
      </div>
    </div>
  );
});
