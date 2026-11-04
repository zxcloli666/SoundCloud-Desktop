import { Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { logError } from '../../../../lib/diagnostics';
import { LightboxView } from './Lightbox';
import { closeLightbox, type OpenInput, openLightbox, useLightboxStore } from './lightbox-store';

const ROOT_ID = 'chat-lightbox-root';

class LightboxGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    logError(`[chat lightbox] ${error.message}`);
    closeLightbox();
    this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LightboxHost() {
  const session = useLightboxStore((state) => state.session);
  return <LightboxGuard>{session && <LightboxView session={session} />}</LightboxGuard>;
}

let root: Root | null = null;

function mountLightbox() {
  if (root) return;
  document.getElementById(ROOT_ID)?.remove();
  const node = document.createElement('div');
  node.id = ROOT_ID;
  document.body.appendChild(node);
  root = createRoot(node);
  root.render(<LightboxHost />);
}

export function showLightbox(input: OpenInput) {
  mountLightbox();
  openLightbox(input);
}
