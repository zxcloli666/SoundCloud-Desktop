export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

export function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf('.');
  return dot > 0 && IMAGE_EXTENSIONS.includes(path.slice(dot + 1).toLowerCase());
}
