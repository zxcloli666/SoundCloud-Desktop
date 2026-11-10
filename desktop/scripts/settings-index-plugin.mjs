import { buildSettingsIndex } from './settings-index.mjs';

const VIRTUAL = 'virtual:settings-index';
const RESOLVED = `\0${VIRTUAL}`;
const WATCHED = [
  '/src/components/settings/',
  '/src/components/chat/settings/',
  '/src/components/chat/media/StorageEntry.tsx',
  '/src/i18n/locales/',
];

export function settingsIndexPlugin() {
  let root = process.cwd();
  return {
    name: 'settings-index',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
    },
    load(id) {
      if (id !== RESOLVED) return;
      const { entries, categories, problems } = buildSettingsIndex(root);
      for (const problem of problems) this.warn(`settings index: ${problem}`);
      return `export const entries = ${JSON.stringify(entries)};\nexport const categories = ${JSON.stringify(categories)};\n`;
    },
    handleHotUpdate({ file, server }) {
      if (!WATCHED.some((part) => file.includes(part))) return;
      const module = server.moduleGraph.getModuleById(RESOLVED);
      if (!module) return;
      server.moduleGraph.invalidateModule(module);
      return [module];
    },
  };
}
