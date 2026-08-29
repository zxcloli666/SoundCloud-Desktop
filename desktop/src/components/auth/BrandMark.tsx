import { memo } from 'react';
import sonveilMark from '../../assets/sonveil-mark.svg';

/** Quiet editorial wordmark used on the authentication screens. */
export const BrandMark = memo(function BrandMark({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="flex items-center justify-center gap-3 text-[#f1eee8]">
        <img className="w-[108px] shrink-0" src={sonveilMark} alt="" draggable={false} />
        <span className="text-[32px] font-extrabold leading-none tracking-[-0.055em]">sonveil</span>
      </h1>
      <p className="mt-4 min-h-[18px] max-w-[320px] text-[12px] leading-5 text-white/40">
        {subtitle}
      </p>
    </div>
  );
});
