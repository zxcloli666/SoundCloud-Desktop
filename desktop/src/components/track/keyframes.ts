export const ROOM_KEYFRAMES = `
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes room-bloom {
  0%   { transform: translate(-50%, 8px) scale(0.92); opacity: 0; }
  22%  { opacity: 1; }
  100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
}
.wv-pill {
  opacity: 0;
  transform: translate(-50%, 8px) scale(0.92);
  transition: opacity 320ms var(--ease-apple), transform 320ms var(--ease-apple);
}
.wv-dot:hover .wv-pill { opacity: 1; transform: translate(-50%, 0) scale(1); }
.wv-dot[data-bloom='1'] .wv-pill { animation: room-bloom 360ms var(--ease-apple) both; opacity: 1; }
.wv-dot[data-bloom='1'] .wv-pip { transform: scale(1.9); background: var(--color-accent); }
`;
