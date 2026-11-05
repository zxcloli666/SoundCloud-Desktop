export const DEVICE_KEYFRAMES = `
@keyframes chat-device-arrive {
  from { transform: scale(0.86); opacity: 0.5; }
  to   { transform: scale(1.32); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .chat-device-motion { animation: none !important; }
}
`;
