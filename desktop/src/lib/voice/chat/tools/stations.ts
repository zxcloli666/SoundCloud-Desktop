import { type AppPort, STATIONS, type Station } from '../ports.ts';
import type { ChatTool } from '../types';
import { fail, ok } from './intent.ts';

function playStation(app: AppPort): ChatTool {
  return {
    name: 'play_station',
    description:
      'Play one station of the personal wave: same_vibe is close to what the user listens to now, deep_cuts goes deeper into lesser known tracks, adjacent is neighbouring artists, top_artists is the favourite artists, fresh_drops is new releases. The endless wave itself is play_wave.',
    args: {
      type: 'object',
      properties: { station: { type: 'string', enum: [...STATIONS] } },
      required: ['station'],
    },
    returns: false,
    run: async (args) => {
      const played = await app.playStation(args.station as Station);
      return played ? { result: ok() } : fail('empty');
    },
  };
}

export function stationTools(app: AppPort): ChatTool[] {
  return [playStation(app)];
}
