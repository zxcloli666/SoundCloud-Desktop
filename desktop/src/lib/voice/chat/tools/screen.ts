import type { PlayerPort } from '../../execute.ts';
import { ITEM_KINDS, type ItemKind, SCROLLS, type ScrollTo } from '../../screen/shape.ts';
import { pushStep } from '../../undo.ts';
import type { AppPort } from '../ports';
import type { ChatTool } from '../types';
import { fail, NO_ARGS, ok } from './intent.ts';

const BY_REF = { ref: { type: 'string' as const } };

function screen(app: AppPort): ChatTool {
  return {
    name: 'screen',
    description:
      'Look at the open page again after press, type_text or open_item: title, numbered tracks and controls with refs. Every round already starts with context.screen.',
    args: NO_ARGS,
    returns: true,
    run: async () => ({ result: ok({ screen: await app.screen() }) }),
  };
}

function press(app: AppPort): ChatTool {
  return {
    name: 'press',
    description:
      'Press a button, link, tab, switch or menu item of context.screen.controls by its ref.',
    args: { type: 'object', properties: BY_REF, required: ['ref'] },
    returns: false,
    run: async (args) => (app.press(String(args.ref)) ? { result: ok() } : fail('unknown_ref')),
  };
}

function typeText(app: AppPort): ChatTool {
  return {
    name: 'type_text',
    description:
      'Type text into a field of context.screen.controls by its ref. submit=true presses Enter after it.',
    args: {
      type: 'object',
      properties: { ...BY_REF, text: { type: 'string' }, submit: { type: 'boolean' } },
      required: ['ref', 'text'],
    },
    returns: false,
    run: async (args) =>
      app.typeInto(String(args.ref), String(args.text), args.submit === true)
        ? { result: ok() }
        : fail('not_a_field'),
  };
}

function scroll(app: AppPort): ChatTool {
  return {
    name: 'scroll',
    description:
      'Scroll the open page down or up by a screen, or to the top or bottom. Returns the screen after it.',
    args: {
      type: 'object',
      properties: { to: { type: 'string', enum: [...SCROLLS] } },
      required: ['to'],
    },
    returns: true,
    run: async (args) => {
      const after = await app.scroll(args.to as ScrollTo);
      return after ? { result: ok({ screen: after }) } : fail('no_page');
    },
  };
}

function playScreen(player: PlayerPort, app: AppPort): ChatTool {
  return {
    name: 'play_screen',
    description:
      'Play the track with number n of context.screen.tracks the way a click on it does: the list it stands in plays on after it.',
    args: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
    returns: false,
    run: async (args, env) => {
      const before = player.shot();
      if (!app.playRow(Math.round(Number(args.n)))) return fail('not_on_screen');
      const after = player.shot();
      const step = { scope: ['track' as const], before, after };
      env.stack = pushStep(env.stack, env.cmd.group ?? env.cmd.id, step, env.now);
      env.undo = true;
      return {
        result: ok({ started: after.track?.title }),
        intent: 'play',
        text: after.track?.title,
      };
    },
  };
}

function openItem(app: AppPort): ChatTool {
  return {
    name: 'open_item',
    description:
      'Open the page of a track, artist, album, playlist or user by its id from search, a list or the screen.',
    args: {
      type: 'object',
      properties: { kind: { type: 'string', enum: [...ITEM_KINDS] }, id: { type: 'string' } },
      required: ['kind', 'id'],
    },
    returns: false,
    run: async (args) =>
      app.openItem(args.kind as ItemKind, String(args.id)) ? { result: ok() } : fail('no_page'),
  };
}

export function screenTools(player: PlayerPort, app: AppPort): ChatTool[] {
  return [
    screen(app),
    press(app),
    typeText(app),
    scroll(app),
    playScreen(player, app),
    openItem(app),
  ];
}
