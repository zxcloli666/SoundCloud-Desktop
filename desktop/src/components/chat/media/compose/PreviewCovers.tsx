import { Radio } from '../../../../lib/icons';

const COVERS = [
  'linear-gradient(160deg, #3b2a6b, #c44bff 70%, #ff9bd2)',
  'linear-gradient(160deg, #0f4c5c, #2fb8a6 65%, #c8ffe8)',
  'linear-gradient(160deg, #5c2a10, #ff7a2f 60%, #ffd28a)',
];

export function PreviewCovers() {
  return (
    <div className="flex -space-x-3">
      {COVERS.map((paint, index) => (
        <span
          key={paint}
          className="relative flex size-[46px] items-end justify-start rounded-[12px] border-2 p-1"
          style={{
            background: paint,
            borderColor: 'rgb(var(--surface))',
            transform: `rotate(${(index - 1) * 6}deg)`,
            zIndex: index,
          }}
        >
          <span data-scheme="dark" className="text-ink">
            <Radio size={12} />
          </span>
        </span>
      ))}
    </div>
  );
}
