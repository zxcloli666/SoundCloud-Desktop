export const USER_PAGE_KEYFRAMES = `
  @keyframes ring-rotate {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes star-twinkle {
    0%   { opacity: var(--min, 0.2); transform: scale(0.85); }
    50%  { opacity: var(--max, 0.9); transform: scale(1.05); }
    100% { opacity: var(--min, 0.2); transform: scale(0.85); }
  }
`;
