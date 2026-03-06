import { useEffect } from 'react';
import { startAudioRuntime, stopAudioRuntime } from './model/runtime.ts';

export function AudioRuntime() {
  useEffect(() => {
    startAudioRuntime();
    return () => stopAudioRuntime();
  }, []);

  return null;
}
