import { chatLabWanted } from './flag';
import { installChatLabIpc } from './ipc';

if (chatLabWanted) installChatLabIpc();
