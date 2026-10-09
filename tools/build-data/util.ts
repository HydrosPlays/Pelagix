/** Small helpers shared by the data builder modules. */

export class BuildError extends Error {}

/** Abort the build: a source assumption no longer holds. */
export function fail(message: string): never {
  throw new BuildError(message)
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message)
}

export function must<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) fail(message)
  return value
}

export function int(text: string | undefined, what: string): number {
  const n = Number(text)
  if (text === undefined || text === '' || !Number.isInteger(n)) fail(`Expected an integer for ${what}, got ${JSON.stringify(text)}`)
  return n
}

export const cmpNum = (a: number, b: number): number => a - b
export const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export function uniqSorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort(cmpNum)
}

export function groupBy<T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = out.get(k)
    if (list) list.push(item)
    else out.set(k, [item])
  }
  return out
}

/** "a", "an" for an English noun phrase. */
export function article(noun: string): string {
  return /^[AEIOU]/i.test(noun) ? 'an' : 'a'
}

export function titleCase(text: string): string {
  return text.replace(/(^|[\s\-(/])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase())
}

/** Key for a [species, form] pair. */
export const sf = (species: number, form: number): number => species * 64 + form
export const sfSpecies = (key: number): number => Math.floor(key / 64)
export const sfForm = (key: number): number => key % 64

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${n} B`
}

export function countBy<T>(items: Iterable<T>, key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}
