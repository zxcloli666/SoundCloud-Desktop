export const chatLabWanted =
  import.meta.env.DEV &&
  (new URLSearchParams(window.location.search).has('chat-lab') ||
    Boolean(import.meta.env.VITE_CHAT_LAB));
