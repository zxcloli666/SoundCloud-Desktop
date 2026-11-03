import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import {
  answerDemo,
  isOffline,
  previewDemo,
  runDemo,
  setMeter,
  startDownload,
  teachDemo,
} from './engine';
import { labDevices } from './fixtures';

type Args = Record<string, unknown> | undefined;

function voiceCommand(cmd: string, args: Args): unknown {
  const runtime = useVoiceRuntime.getState();
  switch (cmd) {
    case 'voice_status':
      return {
        state: runtime.engine,
        star: true,
        models: {
          ready: runtime.models.filter((m) => m.state === 'ready').length,
          total: runtime.models.length,
        },
        devices: runtime.devices.inputs.length > 0 ? runtime.devices : labDevices(),
        error: runtime.status?.error ?? null,
      };
    case 'voice_devices':
      return runtime.devices.inputs.length > 0 ? runtime.devices : labDevices();
    case 'voice_models':
      return runtime.models;
    case 'voice_model_get':
      startDownload(String(args?.id));
      return null;
    case 'voice_model_delete':
      return null;
    case 'voice_meter':
      setMeter(Boolean(args?.on));
      return null;
    case 'voice_start':
      void runDemo(String(args?.source ?? 'button'));
      return null;
    case 'voice_answer':
      void answerDemo(String(args?.choice));
      return null;
    case 'voice_preview':
      void previewDemo();
      return null;
    case 'voice_wake_teach':
      return args?.step === 'sample' ? teachDemo().then(() => 1) : 0;
    default:
      return null;
  }
}

function labInvoke(cmd: string, payload?: InvokeArgs): unknown {
  const args = payload as Args;
  if (cmd.startsWith('voice_') && isOffline()) throw new Error('voice engine is not running');
  if (cmd.startsWith('voice_')) return voiceCommand(cmd, args);
  if (cmd === 'plugin:fs|exists') return false;
  if (cmd === 'get_server_ports') return [0, 0];
  return null;
}

export function installLabMocks() {
  mockWindows('main');
  mockIPC(labInvoke, { shouldMockEvents: true });
}
