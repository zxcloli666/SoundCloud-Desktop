export const THREAD_KEYFRAMES = `
@keyframes chat-thread-eq {
  0%, 100% { transform: scaleY(0.35); }
  50%      { transform: scaleY(1); }
}
@keyframes chat-thread-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes chat-thread-flash {
  0%   { box-shadow: 0 0 0 0 var(--color-accent-glow); background-color: var(--color-accent-glow); }
  100% { box-shadow: 0 0 0 10px transparent; background-color: transparent; }
}
@keyframes chat-thread-sheet {
  from { transform: translate3d(28px,0,0); opacity: 0; }
  to   { transform: translate3d(0,0,0); opacity: 1; }
}
@keyframes chat-thread-rise {
  from { transform: translate3d(0,6px,0); opacity: 0; }
  to   { transform: translate3d(0,0,0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .chat-thread-motion { animation: none !important; }
}
`;
