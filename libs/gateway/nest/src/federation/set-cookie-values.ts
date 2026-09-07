export class SetCookieValues {
  static from(headers: { get(name: string): string | null }): string[] {
    const raw = (headers as typeof headers & { raw?: () => Readonly<Record<string, readonly string[]>> }).raw?.()['set-cookie'];
    if (raw) return [...raw];
    const native = (headers as typeof headers & { getSetCookie?: () => readonly string[] }).getSetCookie?.();
    if (native) return [...native];
    const value = headers.get('set-cookie');
    return value ? [value] : [];
  }
}
