import { memo, type ReactNode, useState } from 'react';

export const GroupPhoto = memo(function GroupPhoto({
  src,
  size,
  fallback,
}: {
  src: string;
  size: number;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) return fallback;
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setBroken(src)}
      className="shrink-0 rounded-full bg-ink/[0.06] object-cover"
      style={{ width: size, height: size }}
    />
  );
});
