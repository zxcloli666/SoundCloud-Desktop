export const PLAYLIST_KEYFRAMES = `
@keyframes crate-deal-in {
  from { opacity: 0; transform: translateY(26px); }
  to   { opacity: 1; transform: translateY(0); }
}
.crate-sleeve-in { animation: crate-deal-in 620ms cubic-bezier(0.2,0.8,0.2,1) both; }
[data-app-hidden='1'] .crate-sleeve-in { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .crate-sleeve-in { animation: none !important; opacity: 1 !important; transform: none !important; }
}
`;
