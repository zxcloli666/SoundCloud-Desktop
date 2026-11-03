export type SpeakerProvider = 'alice' | 'salut';
export type RemoteState = 'done' | 'ask' | 'not_found' | 'failed';

export interface RemoteCommand {
  id: string;
  text: string;
  provider: SpeakerProvider;
  at: string;
}

export interface RemoteWait {
  commands: RemoteCommand[];
  cursor: string;
}

export interface RemoteReply {
  id: string;
  ok: boolean;
  text: string;
  state: RemoteState;
}

export interface LinkCode {
  code: string;
  expires_at: string;
}

export interface RemoteLink {
  id: string;
  provider: SpeakerProvider;
  created_at: string;
  last_used_at: string | null;
}
