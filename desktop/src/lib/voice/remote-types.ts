export type SpeakerProvider = 'alice' | 'salut';
export type RemoteState = 'done' | 'ask' | 'not_found' | 'failed';
export type RemoteKind = 'say' | 'link_confirm';

export interface RemoteCommand {
  id: string;
  seq: number;
  source: string;
  text: string;
  createdAt: number;
  expiresAt: number;
  kind?: RemoteKind;
  provider?: SpeakerProvider;
}

export interface RemoteWait {
  commands: RemoteCommand[];
  cursor: number;
  activeDevice: string | null;
}

export interface RemoteReply {
  id: string;
  ok: boolean;
  speech: string;
  display: string;
  state: RemoteState;
}

export interface LinkCode {
  code: string;
  expiresAt: number;
}

export interface RemoteLink {
  id: string;
  provider: SpeakerProvider;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface LinkAsk {
  id: string;
  provider: SpeakerProvider;
  expiresAt: number;
}
