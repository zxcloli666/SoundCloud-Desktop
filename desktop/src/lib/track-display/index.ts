// Единая логика показа авторов/названия трека. Разбор — display.ts,
// поимённые ссылки — links.ts, ключи сравнения — fold.ts (зеркало бэка).

export { looksLikeRoleTag, stripNoiseTags, stripRoleTags, stripTranslitParens } from './clean';
export {
  type ArtistDisplay,
  coPrimaryNames,
  type DisplayInput,
  dedupeByFold,
  featuredNames,
  getArtistDisplay,
  getDisplayTitle,
  getTrackDisplay,
  type TrackDisplay,
  type UploadKind,
} from './display';
export { foldName } from './fold';
export { useArtistDisplay, useArtistLinkItems, useDisplayTitle, useTrackDisplay } from './hooks';
export {
  type ArtistLinkItem,
  getArtistLinkItems,
  getArtistTarget,
  getParticipants,
  type ParticipantsBreakdown,
} from './links';
export { splitNames, TITLE_SEPARATORS } from './split';
