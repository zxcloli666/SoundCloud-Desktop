export const BACKDROP_KEYFRAMES = `
@keyframes backdrop-drift {
  0%   { transform: translate3d(-2%, -1.5%, 0) scale(1.1); }
  50%  { transform: translate3d(2%, 1.5%, 0) scale(1.1); }
  100% { transform: translate3d(-2%, -1.5%, 0) scale(1.1); }
}
@keyframes backdrop-sheen {
  0%   { transform: translate3d(-120%, 0, 0); }
  55%  { transform: translate3d(120%, 0, 0); }
  100% { transform: translate3d(120%, 0, 0); }
}
@keyframes backdrop-in {
  from { opacity: 0; transform: translate3d(0, 6px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .backdrop-motion { animation: none !important; }
}
`;
