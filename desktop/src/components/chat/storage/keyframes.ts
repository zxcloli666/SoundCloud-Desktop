export const STORAGE_KEYFRAMES = `
@keyframes storage-pop {
  from { transform: translate3d(0,10px,0) scale(0.96); opacity: 0; }
  to   { transform: translate3d(0,0,0) scale(1); opacity: 1; }
}
@keyframes storage-rise {
  from { transform: translate3d(0,16px,0); opacity: 0; }
  to   { transform: translate3d(0,0,0); opacity: 1; }
}
@keyframes storage-drain {
  to { stroke-dashoffset: var(--storage-drain-length); }
}
@keyframes storage-float {
  0%, 100% { transform: translate3d(0,0,0) rotate(var(--storage-tilt, 0deg)); }
  50%      { transform: translate3d(0,-6px,0) rotate(var(--storage-tilt, 0deg)); }
}
@media (prefers-reduced-motion: reduce) {
  .storage-motion { animation: none !important; transition: none !important; }
}
`;
