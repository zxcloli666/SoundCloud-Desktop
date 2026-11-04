export function ImportBar({
  pct,
  indeterminate,
  className,
}: {
  pct: number;
  indeterminate: boolean;
  className: string;
}) {
  return (
    <span className={`relative block overflow-hidden rounded-full bg-ink/[0.08] ${className}`}>
      {indeterminate ? (
        <span className="import-bar-sweep absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent" />
      ) : (
        <span
          className="absolute inset-0 rounded-full bg-accent transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${Math.min(100, pct) - 100}%)` }}
        />
      )}
    </span>
  );
}
