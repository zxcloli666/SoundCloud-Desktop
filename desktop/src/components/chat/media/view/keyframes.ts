const CSS = `
@keyframes chat-media-shimmer {
  from { transform: translate3d(-100%,0,0); }
  to   { transform: translate3d(100%,0,0); }
}
@keyframes chat-media-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes chat-media-pop {
  from { opacity: 0; transform: scale(0.965); }
  to   { opacity: 1; transform: none; }
}
@keyframes chat-media-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .chat-media-motion { animation: none !important; transition: none !important; }
}
`;

const ID = 'chat-media-keyframes';

export function injectMediaKeyframes() {
  if (document.getElementById(ID)) return;
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
