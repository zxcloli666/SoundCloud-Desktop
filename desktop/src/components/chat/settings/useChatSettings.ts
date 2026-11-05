import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '../../../i18n';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ChatSettings, NotifyPrefs, SettingsPatch, UserId } from '../../../lib/chat/types';
import { notifyError } from '../../../lib/notify';
import { queryClient } from '../../../lib/query-client';
import { listErrorKey } from '../shell/errors';

const SETTINGS_KEY = ['chat', 'settings'];
const NOTIFY_KEY = ['chat', 'notify-prefs'];

export function readNotifyPrefs(): Promise<NotifyPrefs> {
  return queryClient.fetchQuery({
    queryKey: NOTIFY_KEY,
    queryFn: () => chatBridge.notifyPrefs(null),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function applyPatch(settings: ChatSettings, patch: SettingsPatch): ChatSettings {
  return {
    ...settings,
    dmPolicy: patch.dmPolicy ?? settings.dmPolicy,
    readReceipts: patch.readReceipts ?? settings.readReceipts,
    typing: patch.typing ?? settings.typing,
    presenceShare: patch.presenceShare ?? settings.presenceShare,
  };
}

function fail(error: unknown) {
  notifyError(i18n.t(listErrorKey(error)));
}

export function useChatSettings(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => chatBridge.settingsGet(),
    staleTime: 60_000,
    enabled,
  });

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => chatBridge.settingsPut(patch),
    onMutate: (patch) => {
      const previous = queryClient.getQueryData<ChatSettings>(SETTINGS_KEY);
      if (previous) queryClient.setQueryData(SETTINGS_KEY, applyPatch(previous, patch));
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(SETTINGS_KEY, context.previous);
      fail(error);
    },
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_KEY, settings),
  });

  const unblock = useMutation({
    mutationFn: (userId: UserId) => chatBridge.unblock(userId),
    onSuccess: (_result, userId) =>
      queryClient.setQueryData<ChatSettings>(SETTINGS_KEY, (settings) =>
        settings
          ? { ...settings, blocked: settings.blocked.filter((user) => user.id !== userId) }
          : settings,
      ),
    onError: fail,
  });

  return { query, patch: save.mutate, unblock: unblock.mutate };
}

export function useNotifyPrefs() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: NOTIFY_KEY,
    queryFn: () => chatBridge.notifyPrefs(null),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const save = useMutation({
    mutationFn: (prefs: NotifyPrefs) => chatBridge.notifyPrefs(prefs),
    onMutate: (prefs) => {
      const previous = queryClient.getQueryData<NotifyPrefs>(NOTIFY_KEY);
      queryClient.setQueryData(NOTIFY_KEY, prefs);
      return { previous };
    },
    onError: (error, _prefs, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFY_KEY, context.previous);
      fail(error);
    },
    onSuccess: (prefs) => queryClient.setQueryData(NOTIFY_KEY, prefs),
  });

  return { prefs: query.data, set: save.mutate };
}
