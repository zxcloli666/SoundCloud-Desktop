import { useSettingsStore } from '../../../stores/settings';
import { resolvePlacement } from '../../layout';
import { arrange, type PlacementMap, placementMap, type Surface } from '../../player-zones';
import { currentPage } from './navigator';
import { pageName } from './pages';
import type { ButtonAsk, ButtonDone, ButtonPlace } from './ports';

const SURFACE: Record<ButtonPlace, Surface> = { bar: 'player', home: 'deck' };

function placement(place: ButtonPlace) {
  const surface = SURFACE[place];
  return resolvePlacement(useSettingsStore.getState().layouts[surface], surface);
}

function lookedAt(): ButtonPlace {
  return pageName(currentPage()) === 'home' ? 'home' : 'bar';
}

export function buttons(): Record<ButtonPlace, PlacementMap> {
  return {
    bar: placementMap(placement('bar'), 'player'),
    home: placementMap(placement('home'), 'deck'),
  };
}

export function placeButton(ask: ButtonAsk): ButtonDone {
  const place = ask.place ?? lookedAt();
  const surface = SURFACE[place];
  const done = arrange(placement(place), surface, ask.button, ask.act, ask.zone, ask.position);
  if (done.state !== 'ok') return done;
  useSettingsStore.getState().setLayout(surface, done.entries);
  return { state: 'ok', place, zone: done.zone, position: done.position, hidden: done.hidden };
}
