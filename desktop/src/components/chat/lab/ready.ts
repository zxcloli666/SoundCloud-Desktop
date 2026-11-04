import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { runSteps } from './kit';
import type { Step } from './steps';
import { sleep, waitUntil } from './steps';

type LabWindow = {
  __chatLabReady?: boolean;
  __chatLabError?: string;
  __chatLabScenes?: { id: string; title: string }[];
};

const SETTLE_MS = 700;

function imagesDone(): boolean {
  return [...document.images].every((image) => image.complete);
}

export async function runScene(steps: Step[]) {
  const lab = window as LabWindow;
  lab.__chatLabReady = false;
  try {
    await waitUntil(() => selectChatEnabled(useChatStore.getState()), 10_000);
    await sleep(300);
    await runSteps(steps);
    await document.fonts.ready;
    await waitUntil(imagesDone, 4000);
    await sleep(SETTLE_MS);
  } catch (error) {
    lab.__chatLabError = String(error);
  }
  document.documentElement.dataset.chatLabReady = lab.__chatLabError ? 'error' : '1';
  lab.__chatLabReady = true;
}
