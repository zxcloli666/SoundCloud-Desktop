import { installLabMocks } from './mocks';

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('voice-lab')) {
  installLabMocks();
}
