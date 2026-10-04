export class BoundedCache<K, V> {
  private readonly entries = new Map<K, { value: V; bytes: number }>();
  private bytes = 0;

  constructor(private readonly maxEntries: number, private readonly maxBytes: number, private readonly sizeOf: (value: V) => number) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  delete(key: K): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }

  set(key: K, value: V): void {
    this.delete(key);
    const bytes = this.sizeOf(value);
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { value, bytes });
    this.bytes += bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
  }
}
