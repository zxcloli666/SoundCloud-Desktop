import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import i18next from 'i18next';
import { VOICE_IDS, voiceGender } from '../src/lib/voice/voice-ids.ts';

const LANGUAGES = ['en', 'ru', 'tr', 'ko', 'pt'];
const GENDERED = ['voice.hero.state.off', 'voice.hero.state.ready', 'voice.error.asr_failed'];

function locale(lang: string) {
  const url = new URL(`../src/i18n/locales/voice/${lang}.json`, import.meta.url);
  return { translation: JSON.parse(readFileSync(url, 'utf8')) };
}

const i18n = i18next.createInstance();
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: Object.fromEntries(LANGUAGES.map((lang) => [lang, locale(lang)])),
});

function said(lang: string, voice: string): string[] {
  const t = i18n.getFixedT(lang);
  return GENDERED.map((key) => t(key, { context: voiceGender(voice) }));
}

test('the gender is declared with every voice', () => {
  const genders = Object.fromEntries(VOICE_IDS.map((id) => [id, voiceGender(id)]));
  assert.deepEqual(genders, {
    loli: 'female',
    moriarty: 'male',
    af_heart: 'female',
    am_michael: 'male',
  });
  assert.equal(voiceGender('lolya'), 'female');
});

test('russian phrases about the assistant follow the gender of the voice', () => {
  const feminine = ['Выключена', 'Готова', 'Не расслышала'];
  const masculine = ['Выключен', 'Готов', 'Не расслышал'];
  assert.deepEqual(said('ru', 'loli'), feminine);
  assert.deepEqual(said('ru', 'af_heart'), feminine);
  assert.deepEqual(said('ru', 'moriarty'), masculine);
  assert.deepEqual(said('ru', 'am_michael'), masculine);
});

test('portuguese states follow the gender of the voice', () => {
  assert.deepEqual(said('pt', 'loli').slice(0, 2), ['Desligada', 'Pronta']);
  assert.deepEqual(said('pt', 'moriarty').slice(0, 2), ['Desligado', 'Pronto']);
  assert.deepEqual(said('pt', 'moriarty').slice(2), said('pt', 'loli').slice(2));
});

test('languages without gendered forms say the same for every voice', () => {
  for (const lang of ['en', 'tr', 'ko']) {
    for (const id of VOICE_IDS) assert.deepEqual(said(lang, id), said(lang, 'loli'), lang);
  }
});

function roles(lang: string, voice: string): string[] {
  const t = i18n.getFixedT(lang);
  const ids = ['friend', 'assistant', 'butler', 'mentor', 'own'];
  return ids.map((id) => t(`voice.you.roles.${id}`, { context: voiceGender(voice) }));
}

test('the roles the assistant can take follow the gender of the voice', () => {
  assert.deepEqual(roles('ru', 'loli'), [
    'Подруга',
    'Помощница',
    'Дворецкий',
    'Наставница',
    'Своё',
  ]);
  assert.deepEqual(roles('ru', 'moriarty'), ['Друг', 'Помощник', 'Дворецкий', 'Наставник', 'Своё']);
  assert.deepEqual(roles('pt', 'loli').slice(0, 4), ['Amiga', 'Assistente', 'Mordomo', 'Mentora']);
  assert.deepEqual(roles('pt', 'moriarty').slice(0, 4), [
    'Amigo',
    'Assistente',
    'Mordomo',
    'Mentor',
  ]);
  for (const lang of ['en', 'tr', 'ko']) {
    assert.deepEqual(roles(lang, 'moriarty'), roles(lang, 'loli'), lang);
  }
  for (const lang of ['ru', 'tr', 'ko', 'pt']) {
    roles(lang, 'loli').forEach((role, i) => {
      assert.notEqual(role, roles('en', 'loli')[i], `${lang} role ${i} is not translated`);
    });
  }
});
