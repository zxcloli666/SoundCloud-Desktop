import type { PlayerPort } from '../../execute.ts';
import { PAGES, type Page, SETTINGS_SECTIONS, type SettingsSection } from '../pages.ts';
import type { AppPort } from '../ports';
import {
  allowedValues,
  parseSetting,
  SETTING_KEYS,
  type SettingKey,
  settingsHint,
  shownValue,
} from '../settings.ts';
import type { ChatTool } from '../types';
import { fail, NO_ARGS, ok } from './intent.ts';

const QUEUE_SHOWN = 10;

function openPage(app: AppPort): ChatTool {
  return {
    name: 'open_page',
    description:
      'Open a page of the app. search takes a query; settings takes a section; current_track, current_artist and current_album open pages of what is playing.',
    args: {
      type: 'object',
      properties: {
        page: { type: 'string', enum: PAGES },
        query: { type: 'string' },
        section: { type: 'string', enum: SETTINGS_SECTIONS },
      },
      required: ['page'],
    },
    returns: false,
    run: async (args) => {
      const section = typeof args.section === 'string' ? (args.section as SettingsSection) : null;
      const query = typeof args.query === 'string' ? args.query : '';
      const opened = app.open(args.page as Page, query, section);
      return opened === 'ok' ? { result: ok() } : fail(opened);
    },
  };
}

function getSettings(app: AppPort): ChatTool {
  return {
    name: 'get_settings',
    description: 'Read the current values of the settings that set_setting can change.',
    args: NO_ARGS,
    returns: true,
    run: async () => {
      const values = app.settings();
      const settings = Object.fromEntries(
        SETTING_KEYS.map((key) => [key, shownValue(values[key])]),
      );
      return { result: ok({ settings }) };
    },
  };
}

function setSetting(app: AppPort): ChatTool {
  return {
    name: 'set_setting',
    description: `Change one app setting. Switches take on or off. Other values: ${settingsHint()}.`,
    args: {
      type: 'object',
      properties: { key: { type: 'string', enum: SETTING_KEYS }, value: { type: 'string' } },
      required: ['key', 'value'],
    },
    returns: false,
    run: async (args) => {
      const key = args.key as SettingKey;
      const value = parseSetting(key, String(args.value));
      if (value === null) return fail('bad_value', { allowed: allowedValues(key) });
      app.applySetting(key, value);
      return { result: ok({ key, value: shownValue(value) }) };
    },
  };
}

function lyrics(app: AppPort): ChatTool {
  return {
    name: 'lyrics',
    description: 'Open or close the lyrics panel of the current track.',
    args: { type: 'object', properties: { open: { type: 'boolean' } }, required: ['open'] },
    returns: false,
    run: async (args) => {
      app.showLyrics(args.open === true);
      return { result: ok() };
    },
  };
}

function queueList(app: AppPort): ChatTool {
  return {
    name: 'queue_list',
    description: 'Read what plays next: up to 10 upcoming tracks with title and artist.',
    args: NO_ARGS,
    returns: true,
    run: async () => ({ result: ok({ next: app.upNext(QUEUE_SHOWN) }) }),
  };
}

function queueClear(app: AppPort): ChatTool {
  return {
    name: 'queue_clear',
    description: 'Remove every upcoming track from the queue. The current track keeps playing.',
    args: NO_ARGS,
    returns: false,
    run: async () => {
      app.clearQueue();
      return { result: ok() };
    },
  };
}

function addToPlaylist(player: PlayerPort, app: AppPort): ChatTool {
  return {
    name: 'add_to_playlist',
    description: 'Open the playlist picker for the current track so the user chooses a playlist.',
    args: NO_ARGS,
    returns: false,
    run: async () => {
      if (!player.shot().track) return fail('nothing_playing');
      return app.pickPlaylist() ? { result: ok() } : fail('failed');
    },
  };
}

export function appTools(player: PlayerPort, app: AppPort): ChatTool[] {
  return [
    openPage(app),
    getSettings(app),
    setSetting(app),
    lyrics(app),
    queueList(app),
    queueClear(app),
    addToPlaylist(player, app),
  ];
}
