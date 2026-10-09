/** Joins class names, skipping falsy ones: `cx('a', cond && 'b')`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  let out = ''
  for (const p of parts) if (p) out += out ? ` ${p}` : p
  return out
}
