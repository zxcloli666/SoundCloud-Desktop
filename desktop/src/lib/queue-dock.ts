export const QUEUE_DOCK_WIDTH = 380;
const PAGE_MIN_WIDTH = 600;

export function queueFitsBeside(viewport: number, sidebar: number, chat: number): boolean {
  return viewport - sidebar - chat - QUEUE_DOCK_WIDTH >= PAGE_MIN_WIDTH;
}
