import { type ButtonAct, PLAYER_IDS, ZONES } from '../../../player-zones.ts';
import { type AppPort, BUTTON_PLACES, type ButtonPlace } from '../ports.ts';
import type { ChatTool } from '../types';
import { fail, NO_ARGS, ok } from './intent.ts';

const ACTS: ButtonAct[] = ['show', 'hide', 'move'];

function playerButtons(app: AppPort): ChatTool {
  return {
    name: 'player_buttons',
    description:
      'Where the player buttons are: for the bottom player (bar) and the Home deck (home), the shown buttons of each zone in order, left to right, and the hidden ones. Zones: left, before (left of previous), after (right of next), right, and title (next to the track title, home only). Previous, play and next always stay in the center.',
    args: NO_ARGS,
    returns: true,
    run: async () => ({ result: ok(app.buttons()) }),
  };
}

function playerButton(app: AppPort): ChatTool {
  return {
    name: 'player_button',
    description:
      'Show, hide or move one player button. place is bar (bottom player) or home (Home deck), leave it out for the one on screen. move needs a zone; position counts from 1 inside the zone, left to right, leave it out for the end. show with a zone also moves it there. Previous, play and next never move.',
    args: {
      type: 'object',
      properties: {
        button: { type: 'string', enum: [...PLAYER_IDS] },
        act: { type: 'string', enum: ACTS },
        place: { type: 'string', enum: [...BUTTON_PLACES] },
        zone: { type: 'string', enum: [...ZONES] },
        position: { type: 'integer' },
      },
      required: ['button', 'act'],
    },
    returns: false,
    run: async (args) => {
      const position = args.position == null ? null : Number(args.position);
      if (position != null && (!Number.isInteger(position) || position < 1)) {
        return fail('bad_position');
      }
      const done = app.placeButton({
        place: (args.place as ButtonPlace | undefined) ?? null,
        button: String(args.button),
        act: args.act as ButtonAct,
        zone: typeof args.zone === 'string' ? args.zone : null,
        position,
      });
      if (done.state !== 'ok') return fail(done.state);
      const { place, zone, hidden } = done;
      return {
        result: ok(
          hidden ? { place, zone, hidden } : { place, zone, position: done.position, hidden },
        ),
      };
    },
  };
}

export function buttonTools(app: AppPort): ChatTool[] {
  return [playerButtons(app), playerButton(app)];
}
