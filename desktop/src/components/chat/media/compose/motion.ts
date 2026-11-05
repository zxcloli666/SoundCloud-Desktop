const CSS = `
@keyframes cm-rise { from { opacity: 0; transform: translate3d(0, 6px, 0); } to { opacity: 1; transform: none; } }
@keyframes cm-pop { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: none; } }
@keyframes cm-fade { from { opacity: 0; } to { opacity: 1; } }
.cm-rise { animation: cm-rise 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.cm-pop { animation: cm-pop 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.cm-fade { animation: cm-fade 160ms ease-out both; }
.cm-ring { transition: stroke-dashoffset 320ms cubic-bezier(0.2, 0.8, 0.2, 1); }
.cm-lift { transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
html[data-perf="light"] :is(.cm-rise, .cm-pop, .cm-fade) { animation: none; }
html[data-perf="light"] :is(.cm-ring, .cm-lift) { transition: none; }
@media (prefers-reduced-motion: reduce) {
  :is(.cm-rise, .cm-pop, .cm-fade) { animation: none; }
  :is(.cm-ring, .cm-lift) { transition: none; transform: none !important; }
}
`;

function install() {
  if (
    typeof document === 'undefined' ||
    document.querySelector('style[data-ui="chat-compose-motion"]')
  )
    return;
  const style = document.createElement('style');
  style.dataset.ui = 'chat-compose-motion';
  style.textContent = CSS;
  document.head.appendChild(style);
}

install();

export const RISE = 'cm-rise';
export const POP = 'cm-pop';
export const FADE = 'cm-fade';
export const RING = 'cm-ring';
export const LIFT = 'cm-lift';
