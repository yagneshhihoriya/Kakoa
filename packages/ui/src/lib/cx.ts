/** Minimal class-name joiner (no runtime deps). */
export function cx(
  ...parts: ReadonlyArray<string | false | null | undefined>
): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' ');
}
