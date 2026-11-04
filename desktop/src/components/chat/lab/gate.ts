import { chatLabWanted } from './flag';
import { installChatLabIpc } from './ipc';

if (import.meta.env.DEV && chatLabWanted) installChatLabIpc();
