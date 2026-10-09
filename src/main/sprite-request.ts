/**
 * Pure helpers behind the sprite:// protocol (no Electron imports, so they run under vitest).
 *
 *   sprite://home/<path>[?w=<px>]
 *
 * <path> is what homeSpritePath() in shared/sprites.ts returns: `25.png`, `shiny/201-b.png`,
 * `shiny/female/25.png`.
 */

export const SPRITE_SCHEME = 'sprite'
export const SPRITE_HOST = 'home'
export const THUMB_WIDTHS: readonly number[] = [96, 128, 160, 256, 384]

const PATH_PATTERN = /^\/((?:shiny\/)?(?:female\/)?[a-z0-9-]+\.png)$/
const QUERY_PATTERN = new RegExp(`^\\?w=(${THUMB_WIDTHS.join('|')})$`)

export interface SpriteRequest {
  /** Path relative to the HOME sprite folder, forward slashes. */
  path: string
  /** Thumbnail width in pixels, or null for the original 512 px render. */
  width: number | null
  /** Cache bucket: `full` or `w<width>`. */
  bucket: string
}

/** Strictly validates a sprite:// URL. Returns null for anything that is not exactly the documented shape. */
export function parseSpriteRequest(rawUrl: string): SpriteRequest | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${SPRITE_SCHEME}:` || url.hostname !== SPRITE_HOST) return null
  if (url.port !== '' || url.username !== '' || url.password !== '' || url.hash !== '') return null

  // Matched undecoded on purpose: percent-escapes, dots and backslashes never reach the file system.
  const path = PATH_PATTERN.exec(url.pathname)?.[1]
  if (path === undefined) return null

  if (url.search === '') return { path, width: null, bucket: 'full' }
  const width = QUERY_PATTERN.exec(url.search)?.[1]
  if (width === undefined) return null
  return { path, width: Number(width), bucket: `w${width}` }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** True when the bytes start like a PNG. Guards the cache against captive-portal pages and torn files. */
export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)
}

export type Limiter = <T>(task: () => Promise<T>) => Promise<T>

/** At most `max` tasks run at once; the rest wait in FIFO order. */
export function createLimiter(max: number): Limiter {
  let active = 0
  const waiting: Array<() => void> = []
  return async (task) => {
    if (active < max) active++
    else await new Promise<void>((resolve) => waiting.push(resolve)) // the finishing task hands over its slot
    try {
      return await task()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}

/**
 * De-duplicates concurrent work per key. A task may `hold` extra promises (its cache write): the
 * key stays claimed until those settle, so a request arriving mid-write reuses the result instead
 * of refetching.
 */
export function createDeduper<T>(): (key: string, task: (hold: (p: Promise<unknown>) => void) => Promise<T>) => Promise<T> {
  const inflight = new Map<string, Promise<T>>()
  return (key, task) => {
    const existing = inflight.get(key)
    if (existing) return existing
    const held: Promise<unknown>[] = []
    const run = task((p) => held.push(p))
    inflight.set(key, run)
    void run
      .catch(() => {})
      .then(() => Promise.allSettled(held))
      .then(() => inflight.delete(key))
    return run
  }
}
