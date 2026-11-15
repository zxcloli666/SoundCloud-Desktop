export function latestWrites<V>(put: (name: string, value: V) => Promise<void>) {
  const latest = new Map<string, { value: V }>();
  const writing = new Map<string, Promise<void>>();

  async function drain(name: string) {
    for (let next = latest.get(name); next; next = latest.get(name)) {
      latest.delete(name);
      await put(name, next.value).catch(() => {});
    }
    writing.delete(name);
  }

  return {
    write(name: string, value: V) {
      latest.set(name, { value });
      const writer = writing.get(name) ?? drain(name);
      writing.set(name, writer);
      return writer;
    },
    settled: (name: string) => writing.get(name) ?? Promise.resolve(),
  };
}
