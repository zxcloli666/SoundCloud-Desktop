import type { SettingsEntry } from './types.ts';

const PLAYER = 'settings.pointerPlayer';

export const pointers: SettingsEntry[] = [
  {
    id: 'elsewhere.equalizer',
    kind: 'pointer',
    category: '',
    card: '',
    title: ['eq.title'],
    desc: [],
    keys: ['eq.preamp', 'eq.myPresets', 'eq.import'],
    place: PLAYER,
    trigger: 'player-eq',
  },
  {
    id: 'elsewhere.effects',
    kind: 'pointer',
    category: '',
    card: '',
    title: ['effects.title'],
    desc: [],
    keys: [
      'effects.reverb',
      'effects.room',
      'effects.eightDSpeed',
      'effects.bass',
      'effects.preset.slowedReverb',
      'effects.preset.spedUp',
      'effects.preset.eightD',
      'effects.preset.bass',
    ],
    place: PLAYER,
    trigger: 'player-effects',
  },
  {
    id: 'elsewhere.speed',
    kind: 'pointer',
    category: '',
    card: '',
    title: ['player.soundTuning'],
    desc: [],
    keys: [
      'player.playbackSpeed',
      'player.pitch',
      'player.pitchModeAuto',
      'player.pitchModeManual',
    ],
    place: PLAYER,
    trigger: 'player-tuning',
  },
  {
    id: 'elsewhere.shortcuts',
    kind: 'pointer',
    category: '',
    card: '',
    title: ['kb.title'],
    desc: [],
    keys: ['kb.showBindings', 'kb.groupPlayback', 'kb.groupNavigation', 'kb.groupPanels'],
    place: 'settings.pointerApp',
  },
];
