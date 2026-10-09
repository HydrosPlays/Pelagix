/**
 * sprite:// protocol: Pokémon HOME renders, fetched from the CDN once and then served from
 * userData/sprite-cache. Thumbnails are produced on demand and cached next to the originals.
 *
 *   sprite-cache/full/<path>      the 512 px original
 *   sprite-cache/w<px>/<path>     a downscaled copy
 */

import { app, nativeImage, net, protocol, session } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { SpriteCacheInfo } from '@shared/api'
import { SPRITE_CDN_FALLBACK, SPRITE_CDN_PRIMARY } from '@shared/sprites'
import { atomicWrite, isMissing, readIfExists } from './fs-util'
import { createDeduper, createLimiter, isPng, parseSpriteRequest, SPRITE_SCHEME } from './sprite-request'

const MAX_UPSTREAM_FETCHES = 8
const UPSTREAM_TIMEOUT_MS = 20_000
/** HOME renders top out around 260 kB; anything far beyond that is not a sprite. */
const MAX_SPRITE_BYTES = 8 * 1024 * 1024

const OK_HEADERS = {
  'content-type': 'image/png',
  'cache-control': 'public, max-age=31536000, immutable',
  'access-control-allow-origin': '*'
}

type Loaded = { ok: true; bytes: Buffer } | { ok: false; status: number }

const dedupe = createDeduper<Loaded>()
const limitUpstream = createLimiter(MAX_UPSTREAM_FETCHES)
let warnedAboutCache = false

const cacheRoot = (): string => join(app.getPath('userData'), 'sprite-cache')
const cacheFile = (bucket: string, path: string): string => join(cacheRoot(), bucket, ...path.split('/'))

async function readCached(file: string): Promise<Buffer | null> {
  try {
    const bytes = await readIfExists(file)
    return bytes !== null && isPng(bytes) ? bytes : null
  } catch {
    return null // an unreadable cache entry is just a miss
  }
}

/** Fire-and-forget by design: a cache that cannot be written must never fail the response. */
function writeCached(file: string, bytes: Uint8Array): Promise<void> {
  return atomicWrite(file, bytes, { fsync: false }).catch((err) => {
    if (warnedAboutCache) return
    warnedAboutCache = true
    console.warn('[sprites] cache write failed; sprites will be refetched', err)
  })
}

/** Status 0 stands for a network error or timeout. */
async function fetchFrom(base: string, path: string): Promise<{ status: number; bytes?: Buffer }> {
  try {
    const res = await net.fetch(base + path, {
      // The disk cache below is the cache; do not keep a second copy in Chromium's HTTP cache.
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    })
    if (res.status !== 200) return { status: res.status }
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_SPRITE_BYTES || !isPng(bytes)) return { status: 502 }
    return { status: 200, bytes }
  } catch {
    return { status: 0 }
  }
}

async function fetchUpstream(path: string): Promise<Loaded> {
  const primary = await fetchFrom(SPRITE_CDN_PRIMARY, path)
  if (primary.bytes) return { ok: true, bytes: primary.bytes }
  const fallback = await fetchFrom(SPRITE_CDN_FALLBACK, path)
  if (fallback.bytes) return { ok: true, bytes: fallback.bytes }
  return { ok: false, status: primary.status === 404 && fallback.status === 404 ? 404 : 502 }
}

function loadFull(path: string): Promise<Loaded> {
  return dedupe(`full/${path}`, async (hold) => {
    const file = cacheFile('full', path)
    const cached = await readCached(file)
    if (cached) return { ok: true, bytes: cached }
    const fetched = await limitUpstream(() => fetchUpstream(path))
    if (fetched.ok) hold(writeCached(file, fetched.bytes))
    return fetched
  })
}

function loadThumb(path: string, width: number): Promise<Loaded> {
  return dedupe(`w${width}/${path}`, async (hold) => {
    const file = cacheFile(`w${width}`, path)
    const cached = await readCached(file)
    if (cached) return { ok: true, bytes: cached }
    const full = await loadFull(path)
    if (!full.ok) return full
    const image = nativeImage.createFromBuffer(full.bytes)
    if (image.isEmpty()) {
      // Undecodable original: drop it so the next request fetches a fresh copy.
      await fs.rm(cacheFile('full', path), { force: true }).catch(() => {})
      return { ok: false, status: 502 }
    }
    const bytes = image.resize({ width, quality: 'best' }).toPNG()
    hold(writeCached(file, bytes))
    return { ok: true, bytes }
  })
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
  const parsed = parseSpriteRequest(request.url)
  if (!parsed) return new Response(null, { status: 400 })
  try {
    const loaded = parsed.width === null ? await loadFull(parsed.path) : await loadThumb(parsed.path, parsed.width)
    if (!loaded.ok) return new Response(null, { status: loaded.status })
    return new Response(request.method === 'HEAD' ? null : loaded.bytes, { status: 200, headers: OK_HEADERS })
  } catch (err) {
    console.error('[sprites] request failed', request.url, err)
    return new Response(null, { status: 500 })
  }
}

/** Call once after the app is ready; the scheme itself is registered as privileged in index.ts. */
export function registerSpriteProtocol(): void {
  protocol.handle(SPRITE_SCHEME, handle)
}

export async function spriteCacheInfo(): Promise<SpriteCacheInfo> {
  let files = 0
  let bytes = 0
  let entries
  try {
    entries = await fs.readdir(cacheRoot(), { recursive: true, withFileTypes: true })
  } catch (err) {
    if (isMissing(err)) return { files, bytes }
    throw err
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    try {
      bytes += (await fs.stat(join(entry.parentPath, entry.name))).size
      files++
    } catch {
      // deleted while walking
    }
  }
  return { files, bytes }
}

export async function clearSpriteCache(): Promise<void> {
  await fs.rm(cacheRoot(), { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })
  // Also drops whatever Chromium kept of the images, so the next view really refetches.
  await session.defaultSession.clearCache().catch(() => {})
}
