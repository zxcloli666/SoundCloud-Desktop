export function isListFile(path: string): boolean {
  return /\.(txt|csv|tsv)$/i.test(path);
}
