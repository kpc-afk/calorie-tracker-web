export class SwrCache {
  private map = new Map<string, unknown>()
  get<T>(key: string): T | undefined { return this.map.get(key) as T | undefined }
  set(key: string, value: unknown) { this.map.set(key, value) }
  invalidatePrefix(prefix: string) {
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k)
  }
}
export const appCache = new SwrCache()
