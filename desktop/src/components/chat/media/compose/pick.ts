import { IMAGE_EXTENSIONS } from '../../../../lib/chat/image-files';
import type { ConvId } from '../../../../lib/chat/types';
import { attachData, attachPaths } from './attach';

export async function pickImages(
  conversationId: ConvId,
  max: number,
  title: string,
  picked: () => void,
) {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const chosen = await open({
    multiple: true,
    directory: false,
    title,
    filters: [{ name: title, extensions: IMAGE_EXTENSIONS }],
  });
  picked();
  const paths = Array.isArray(chosen) ? chosen : chosen ? [chosen] : [];
  if (paths.length > 0) await attachPaths(conversationId, paths, max);
}

export async function pasteImages(conversationId: ConvId, files: File[], max: number) {
  const read = await Promise.all(
    files.map(async (file) => ({
      name: file.name || 'image',
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  await attachData(conversationId, read, max);
}

export function clipboardImages(data: DataTransfer | null): File[] {
  if (!data || data.getData('text/plain').trim() !== '') return [];
  return Array.from(data.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .flatMap((item) => item.getAsFile() ?? []);
}
