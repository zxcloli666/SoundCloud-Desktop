export type FieldKind = 'title' | 'phrase' | 'option' | 'desc' | 'context';

export interface SearchField {
  kind: FieldKind;
  text: string;
}

export interface SearchDoc {
  id: string;
  fields: SearchField[];
}

export interface SearchHit {
  id: string;
  score: number;
  kind: FieldKind;
  text: string;
}

export interface SettingsEntry {
  id: string;
  kind: 'card' | 'row' | 'pointer';
  category: string;
  card: string;
  title: string[];
  desc: string[];
  keys: string[];
  place?: string;
  trigger?: string;
}

export interface SettingsCategoryInfo {
  id: string;
  labelKey: string;
}
