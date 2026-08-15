import { memo } from 'react';

/** Quiet editorial wordmark used on the authentication screens. */
export const BrandMark = memo(function BrandMark({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 h-px w-12 bg-accent" aria-hidden />
      <h1 className="font-serif text-[34px] font-medium leading-none tracking-[0.25em] text-[#f1eee8]">
        SONVEIL
      </h1>
      <p className="mt-3 min-h-[18px] max-w-[320px] text-[12px] leading-5 text-white/40">
        {subtitle}
      </p>
    </div>
  );
});
