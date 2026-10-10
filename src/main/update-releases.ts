/**
 * GitHub release data as the updater uses it: the one request made for the changelog, and a
 * strict reading of what comes back. Nothing here trusts the response: every field is checked
 * and sized, and release URLs are built here, never taken from the response.
 * No Electron imports, so it runs under vitest; the caller hands in the fetch function.
 */

import { RELEASES_URL } from '@shared/repo'
import { compareVersions, formatVersion, parseVersion, plainVersion, type SemVer } from './update-version'

/**
 * Both '2026-03-10' and '2022-11-28' were accepted on 2026-10-09 and return the same release
 * shape. An unsupported value is answered with 400, which is retried once without the header.
 */
export const GITHUB_API_VERSION = '2026-03-10'
/** Release bodies are capped by GitHub at 125 000 characters; anything longer is not a release body. */
export const MAX_BODY_LENGTH = 125_000
/** Refuse to read more than this from the API for one page of releases. */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export const REQUEST_TIMEOUT_MS = 15_000
const MAX_RELEASES = 100
const MAX_NAME_LENGTH = 200
/** How long to stay away after a 403 that does not say when to come back. */
const FORBIDDEN_BACKOFF_MS = 60 * 60 * 1000
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/

/** One published release. Also the shape kept in updates.json. */
export interface GitHubRelease {
  /** The tag as written on GitHub: "v0.2.0". Always a version. */
  tag: string
  /** The tag as a plain version: "0.2.0". */
  version: string
  name: string
  /** ISO 8601, or null. */
  publishedAt: string | null
  /** Markdown, exactly as the owner wrote it (CRLF line endings included). Untrusted text. */
  body: string
  prerelease: boolean
}

export function releasesApiUrl(repo: string, perPage = 20): string {
  if (!REPO.test(repo)) throw new TypeError('repo must be "owner/name"')
  return `https://api.github.com/repos/${repo}/releases?per_page=${Math.min(100, Math.max(1, Math.trunc(perPage)))}`
}

/** The page of one release. Built from the tag alone, so it always lies under `RELEASES_URL`. */
export const releasePageUrl = (tag: string): string => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`

/** What every request of the updater calls itself. It names the app and its version, nothing else. */
export function userAgent(appVersion: string): string {
  return `Pelagix/${plainVersion(appVersion) ?? '0.0.0'}`
}

/**
 * Headers for api.github.com. The language is fixed so that the system locale is not sent.
 * Pass `pinVersion: false` for the retry after a 400 / 410 that rejected the pinned API version.
 */
export function apiHeaders(appVersion: string, pinVersion = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'Accept-Language': 'en',
    'User-Agent': userAgent(appVersion)
  }
  if (pinVersion) headers['X-GitHub-Api-Version'] = GITHUB_API_VERSION
  return headers
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * One release from loose fields, or null when the tag is not a version. Shared by the API
 * response and by updates.json, so both are held to the same limits.
 */
export function readRelease(fields: { tag: unknown; name: unknown; body: unknown; publishedAt: unknown; prerelease: unknown }): GitHubRelease | null {
  const { tag, name, body, publishedAt } = fields
  const version = parseVersion(tag)
  // parseVersion forgives surrounding spaces; a tag that goes into a URL must not have any.
  if (typeof tag !== 'string' || version === null || tag !== tag.trim()) return null
  return {
    tag,
    version: formatVersion(version),
    name: typeof name === 'string' && name.length <= MAX_NAME_LENGTH ? name.trim() : '',
    publishedAt: typeof publishedAt === 'string' && ISO_TIME.test(publishedAt) ? publishedAt : null,
    body: typeof body === 'string' ? body.slice(0, MAX_BODY_LENGTH) : '',
    prerelease: fields.prerelease === true || version.pre.length > 0
  }
}

/** Newest version first, whatever order they came in. Two tags that name one version count once. */
export function sortReleases(releases: readonly GitHubRelease[]): GitHubRelease[] {
  const parsed: { release: GitHubRelease; version: SemVer }[] = []
  for (const release of releases) {
    const version = parseVersion(release.tag)
    if (version === null || parsed.some((p) => compareVersions(p.version, version) === 0)) continue
    parsed.push({ release, version })
  }
  return parsed.sort((a, b) => compareVersions(b.version, a.version)).map((p) => p.release)
}

/**
 * Reads the JSON of `GET /repos/{repo}/releases`. Returns only published releases whose tag is a
 * version, newest first; never throws on a malformed response. GitHub lists releases by the date
 * of the tagged commit, so the order of the response means nothing.
 */
export function normalizeReleases(json: unknown): GitHubRelease[] {
  const list = Array.isArray(json) ? json : []
  const out: GitHubRelease[] = []
  for (const raw of list.slice(0, MAX_RELEASES)) {
    if (!isRecord(raw) || raw['draft'] === true) continue
    const release = readRelease({ tag: raw['tag_name'], name: raw['name'], body: raw['body'], publishedAt: raw['published_at'], prerelease: raw['prerelease'] })
    if (release !== null) out.push(release)
  }
  return sortReleases(out)
}

export type RateLimit = { limited: false } | { limited: true; retryAt: number }

/**
 * Whether a response from api.github.com says "rate limited", and until when (epoch ms).
 * Primary limit: 403 or 429 with x-ratelimit-remaining: 0 and x-ratelimit-reset (epoch seconds).
 * Secondary limit: 403 or 429 with retry-after (seconds). Otherwise back off for a minute.
 */
export function readRateLimit(status: number, header: (name: string) => string | null, now: number): RateLimit {
  if (status !== 403 && status !== 429) return { limited: false }
  const retryAfter = Number(header('retry-after'))
  const remaining = header('x-ratelimit-remaining')
  const reset = Number(header('x-ratelimit-reset'))
  const hour = 60 * 60 * 1000
  if (Number.isFinite(retryAfter) && retryAfter > 0) return { limited: true, retryAt: now + Math.min(retryAfter * 1000, 24 * hour) }
  if (remaining === '0') {
    // Never trust the header further than the limit's own window, and never wait less than a minute.
    const at = Number.isFinite(reset) && reset > 0 ? reset * 1000 : now + hour
    return { limited: true, retryAt: Math.min(Math.max(at, now + 60_000), now + 2 * hour) }
  }
  return status === 429 ? { limited: true, retryAt: now + 60_000 } : { limited: false }
}

/** How one request for the release list ended. The response text itself never leaves this file. */
export type ReleaseFetch =
  | { ok: true; releases: GitHubRelease[] }
  | { ok: false; reason: 'rate-limited'; retryAt: number }
  | { ok: false; reason: 'http'; status: number }
  | { ok: false; reason: 'network' | 'too-large' | 'not-a-list' }

export interface ReleaseFetchOptions {
  /** `net.fetch` in the app. */
  fetch: (url: string, init: RequestInit) => Promise<Response>
  url: string
  appVersion: string
  now?: () => number
  timeoutMs?: number
}

/** The body as text, or null once it passes `max` bytes. The declared length is not trusted. */
async function readCapped(res: Response, max: number): Promise<string | null> {
  if (res.body === null) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function requestList(options: ReleaseFetchOptions, pinVersion: boolean): Promise<ReleaseFetch> {
  const now = options.now ?? Date.now
  try {
    const res = await options.fetch(options.url, {
      headers: apiHeaders(options.appVersion, pinVersion),
      // updates.json is the cache; a second copy in Chromium's HTTP cache would only go stale.
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
    })
    if (res.status !== 200) {
      // Not read on purpose: GitHub's rate-limit message contains the caller's IP address.
      await res.body?.cancel().catch(() => {})
      if (res.status === 403 || res.status === 429) {
        const limit = readRateLimit(res.status, (name) => res.headers.get(name), now())
        return { ok: false, reason: 'rate-limited', retryAt: limit.limited ? limit.retryAt : now() + FORBIDDEN_BACKOFF_MS }
      }
      return { ok: false, reason: 'http', status: res.status }
    }
    const text = await readCapped(res, MAX_RESPONSE_BYTES)
    if (text === null) return { ok: false, reason: 'too-large' }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'not-a-list' }
    }
    if (!Array.isArray(json)) return { ok: false, reason: 'not-a-list' }
    return { ok: true, releases: normalizeReleases(json) }
  } catch {
    return { ok: false, reason: 'network' } // offline, DNS, TLS, or the time limit
  }
}

/**
 * Asks GitHub for the newest releases. One request, or two when the pinned API version has been
 * retired; never more, and never a rejection.
 */
export async function fetchReleaseList(options: ReleaseFetchOptions): Promise<ReleaseFetch> {
  const first = await requestList(options, true)
  if (!first.ok && first.reason === 'http' && (first.status === 400 || first.status === 410)) return requestList(options, false)
  return first
}
