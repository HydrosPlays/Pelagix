import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  apiHeaders,
  fetchReleaseList,
  MAX_RESPONSE_BYTES,
  normalizeReleases,
  readRateLimit,
  readRelease,
  releasePageUrl,
  releasesApiUrl,
  sortReleases,
  userAgent,
  type GitHubRelease
} from './update-releases'

const REPO = 'HydrosPlays/Pelagix'
/** The real response of GET /repos/HydrosPlays/Pelagix/releases, saved on 2026-10-09. */
const live: unknown = JSON.parse(readFileSync(new URL('./fixtures/releases.list.json', import.meta.url), 'utf8'))

const good = { tag_name: 'v0.2.0', name: 'Pelagix 0.2.0', body: 'notes', draft: false, prerelease: false, published_at: '2026-11-01T10:00:00Z', assets: [] }

describe('request', () => {
  it('builds the list URL', () => {
    expect(releasesApiUrl(REPO)).toBe('https://api.github.com/repos/HydrosPlays/Pelagix/releases?per_page=20')
    expect(releasesApiUrl(REPO, 500)).toBe('https://api.github.com/repos/HydrosPlays/Pelagix/releases?per_page=100')
    expect(() => releasesApiUrl('../../users/x')).toThrow(TypeError)
    expect(() => releasesApiUrl('a/b?c=d')).toThrow(TypeError)
  })

  it('sends the headers GitHub asks for, a fixed language, and nothing else', () => {
    expect(apiHeaders('0.2.0')).toEqual({
      Accept: 'application/vnd.github+json',
      'Accept-Language': 'en',
      'User-Agent': 'Pelagix/0.2.0',
      'X-GitHub-Api-Version': '2026-03-10'
    })
    expect(apiHeaders('0.2.0', false)).toEqual({ Accept: 'application/vnd.github+json', 'Accept-Language': 'en', 'User-Agent': 'Pelagix/0.2.0' })
  })

  it('never puts a malformed version into the User-Agent', () => {
    expect(userAgent('v0.3.0-beta.1+sha')).toBe('Pelagix/0.3.0-beta.1')
    expect(userAgent('0.2.0\r\nX-Injected: 1')).toBe('Pelagix/0.0.0')
    expect(userAgent('')).toBe('Pelagix/0.0.0')
  })

  it('builds release pages under the repository, whatever the tag holds', () => {
    expect(releasePageUrl('v0.2.0')).toBe('https://github.com/HydrosPlays/Pelagix/releases/tag/v0.2.0')
    expect(releasePageUrl('v0.2.0+build.5')).toBe('https://github.com/HydrosPlays/Pelagix/releases/tag/v0.2.0%2Bbuild.5')
    expect(releasePageUrl('../../evil?x=1#y')).toBe('https://github.com/HydrosPlays/Pelagix/releases/tag/..%2F..%2Fevil%3Fx%3D1%23y')
  })
})

describe('normalizeReleases on the live response', () => {
  const releases = normalizeReleases(live)

  it('finds the one published release', () => {
    expect(releases).toHaveLength(1)
    const r = releases[0]
    expect(r?.tag).toBe('v0.1.0')
    expect(r?.version).toBe('0.1.0')
    expect(r?.name).toBe('Pelagix 0.1.0 | First Release')
    expect(r?.prerelease).toBe(false)
    expect(r?.publishedAt).toBe('2026-10-09T18:34:04Z')
    expect(r?.body.startsWith('The first release of Pelagix')).toBe(true)
    expect(r?.body.length).toBe(3498)
  })

  it('keeps only the fields the changelog shows', () => {
    expect(Object.keys(releases[0] ?? {}).sort()).toEqual(['body', 'name', 'prerelease', 'publishedAt', 'tag', 'version'])
  })
})

describe('normalizeReleases on hostile responses', () => {
  it('returns nothing for the wrong shape', () => {
    for (const bad of [null, undefined, 42, 'x', true, {}, good, [null, 1, 'x', []], { message: 'Not Found', status: '404' }]) {
      expect(normalizeReleases(bad)).toEqual([])
    }
  })

  it('drops drafts and tags that are not versions', () => {
    const list = [
      { ...good, draft: true },
      { ...good, tag_name: 'nightly' },
      { ...good, tag_name: 42 },
      { ...good, tag_name: 'v0.2' },
      { ...good, tag_name: ' v0.2.0' },
      { ...good, tag_name: `v0.2.0-${'a'.repeat(200)}` },
      good
    ]
    expect(normalizeReleases(list).map((r) => r.tag)).toEqual(['v0.2.0'])
  })

  it('flags a prerelease by the flag or by the tag', () => {
    expect(normalizeReleases([{ ...good, prerelease: true }])[0]?.prerelease).toBe(true)
    expect(normalizeReleases([{ ...good, tag_name: 'v0.3.0-beta.1' }])[0]?.prerelease).toBe(true)
  })

  it('never takes a URL from the response', () => {
    const r = normalizeReleases([{ ...good, html_url: 'https://evil.example/releases/tag/v0.2.0', url: 'javascript:alert(1)' }])[0]
    expect(JSON.stringify(r)).not.toContain('evil')
    expect(JSON.stringify(r)).not.toContain('javascript')
  })

  it('tolerates a missing or oversized body, name and date', () => {
    const r = normalizeReleases([{ tag_name: 'v0.2.0', body: null, name: null, published_at: 'yesterday' }])[0]
    expect(r).toEqual({ tag: 'v0.2.0', version: '0.2.0', name: '', body: '', prerelease: false, publishedAt: null })
    expect(normalizeReleases([{ ...good, body: 'x'.repeat(500_000) }])[0]?.body.length).toBe(125_000)
    expect(normalizeReleases([{ ...good, name: 'n'.repeat(500) }])[0]?.name).toBe('')
    expect(normalizeReleases([{ ...good, name: '  Pelagix 0.2.0  ' }])[0]?.name).toBe('Pelagix 0.2.0')
    expect(normalizeReleases([{ ...good, body: { toString: () => 'x' }, published_at: 20261101 }])[0]).toMatchObject({ body: '', publishedAt: null })
  })

  it('reads at most 100 releases', () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ ...good, tag_name: `v0.${i}.0` }))
    expect(normalizeReleases(many)).toHaveLength(100)
  })

  it('sorts by version, not by the order GitHub lists them in', () => {
    const tags = ['v0.2.1', 'v0.10.0', 'v0.3.0-beta.1', 'v0.3.0', 'v0.2.0', 'v0.9.0']
    expect(normalizeReleases(tags.map((tag_name) => ({ ...good, tag_name }))).map((r) => r.tag)).toEqual(['v0.10.0', 'v0.9.0', 'v0.3.0', 'v0.3.0-beta.1', 'v0.2.1', 'v0.2.0'])
  })

  it('counts two tags that name the same version once', () => {
    const list = [
      { ...good, tag_name: 'v0.2.0', name: 'first' },
      { ...good, tag_name: '0.2.0', name: 'second' },
      { ...good, tag_name: 'v0.2.0+build.9', name: 'third' }
    ]
    expect(normalizeReleases(list).map((r) => r.name)).toEqual(['first'])
  })
})

describe('readRelease and sortReleases', () => {
  const release = (tag: string): GitHubRelease => ({ tag, version: tag.replace(/^v/, ''), name: '', publishedAt: null, body: '', prerelease: false })

  it('derives the version from the tag', () => {
    expect(readRelease({ tag: 'v0.3.0-beta.1+sha', name: 'Beta', body: 'b', publishedAt: '2026-11-01T10:00:00.123Z', prerelease: false })).toEqual({
      tag: 'v0.3.0-beta.1+sha',
      version: '0.3.0-beta.1',
      name: 'Beta',
      body: 'b',
      publishedAt: '2026-11-01T10:00:00.123Z',
      prerelease: true
    })
    expect(readRelease({ tag: 'latest', name: '', body: '', publishedAt: null, prerelease: false })).toBeNull()
    expect(readRelease({ tag: null, name: '', body: '', publishedAt: null, prerelease: false })).toBeNull()
  })

  it('skips entries whose tag stopped being a version', () => {
    expect(sortReleases([release('v0.1.0'), { ...release('v0.2.0'), tag: 'broken' }, release('v0.3.0')]).map((r) => r.tag)).toEqual(['v0.3.0', 'v0.1.0'])
    expect(sortReleases([])).toEqual([])
  })
})

describe('readRateLimit', () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null
  const now = 1_791_572_140_000

  it('is not limited on ordinary responses', () => {
    expect(readRateLimit(200, headers({ 'x-ratelimit-remaining': '0' }), now)).toEqual({ limited: false })
    expect(readRateLimit(304, headers({}), now)).toEqual({ limited: false })
    expect(readRateLimit(404, headers({}), now)).toEqual({ limited: false })
    // A 403 that is not about rate limits (for example the missing User-Agent one).
    expect(readRateLimit(403, headers({}), now)).toEqual({ limited: false })
  })

  it('reads the primary limit from the 403 observed on 2026-10-09', () => {
    // HTTP/1.1 403 rate limit exceeded, X-RateLimit-Remaining: 0, X-RateLimit-Reset: 1791572199, no Retry-After.
    expect(readRateLimit(403, headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791572199' }), now)).toEqual({ limited: true, retryAt: now + 60_000 })
    expect(readRateLimit(403, headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791575652' }), now)).toEqual({ limited: true, retryAt: 1_791_575_652_000 })
    expect(readRateLimit(429, headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791575652' }), now)).toEqual({ limited: true, retryAt: 1_791_575_652_000 })
  })

  it('reads the secondary limit from retry-after', () => {
    expect(readRateLimit(403, headers({ 'retry-after': '120' }), now)).toEqual({ limited: true, retryAt: now + 120_000 })
    expect(readRateLimit(429, headers({}), now)).toEqual({ limited: true, retryAt: now + 60_000 })
  })

  it('does not believe absurd values', () => {
    expect(readRateLimit(403, headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '99999999999' }), now)).toEqual({ limited: true, retryAt: now + 2 * 60 * 60 * 1000 })
    expect(readRateLimit(403, headers({ 'retry-after': '999999999' }), now)).toEqual({ limited: true, retryAt: now + 24 * 60 * 60 * 1000 })
    expect(readRateLimit(403, headers({ 'retry-after': 'soon', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'never' }), now)).toEqual({ limited: true, retryAt: now + 60 * 60 * 1000 })
    expect(readRateLimit(403, headers({ 'retry-after': '-5', 'x-ratelimit-remaining': '12' }), now)).toEqual({ limited: false })
  })
})

describe('fetchReleaseList', () => {
  const now = 1_791_572_140_000
  const url = releasesApiUrl(REPO)

  interface Call {
    url: string
    init: RequestInit
  }

  /** A fetch that answers from a script and records what it was asked. */
  function scripted(...answers: (Response | Error)[]): { fetch: (url: string, init: RequestInit) => Promise<Response>; calls: Call[] } {
    const calls: Call[] = []
    return {
      calls,
      fetch: (requested, init) => {
        calls.push({ url: requested, init })
        const answer = answers.shift()
        if (answer === undefined) return Promise.reject(new Error('no more scripted answers'))
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
      }
    }
  }

  const json = (value: unknown, init: ResponseInit = {}): Response => new Response(JSON.stringify(value), { status: 200, ...init })

  it('returns the normalised list of a 200', async () => {
    const { fetch, calls } = scripted(json(live))
    const result = await fetchReleaseList({ fetch, url, appVersion: '0.2.0', now: () => now })
    expect(result.ok && result.releases.map((r) => r.version)).toEqual(['0.1.0'])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(url)
  })

  it('identifies itself by app name and version only, and sends no cookies', async () => {
    const { fetch, calls } = scripted(json([]))
    await fetchReleaseList({ fetch, url, appVersion: '0.2.0' })
    const init = calls[0]?.init
    expect(init?.headers).toEqual({
      Accept: 'application/vnd.github+json',
      'Accept-Language': 'en',
      'User-Agent': 'Pelagix/0.2.0',
      'X-GitHub-Api-Version': '2026-03-10'
    })
    expect(init?.credentials).toBe('omit')
    expect(init?.cache).toBe('no-store')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(init?.method).toBeUndefined()
    expect(init?.body).toBeUndefined()
  })

  it('retries exactly once without the API version when GitHub rejects it', async () => {
    for (const status of [400, 410]) {
      const { fetch, calls } = scripted(new Response('{"message":"Bad Request"}', { status }), json([good]))
      const result = await fetchReleaseList({ fetch, url, appVersion: '0.2.0' })
      expect(result.ok && result.releases.map((r) => r.tag)).toEqual(['v0.2.0'])
      expect(calls).toHaveLength(2)
      expect((calls[1]?.init.headers as Record<string, string>)['X-GitHub-Api-Version']).toBeUndefined()
    }
    const twice = scripted(new Response('', { status: 400 }), new Response('', { status: 400 }), json([good]))
    expect(await fetchReleaseList({ fetch: twice.fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'http', status: 400 })
    expect(twice.calls).toHaveLength(2)
  })

  it('reports a rate limit with the time to come back, and does not retry', async () => {
    const limited = new Response('{"message":"API rate limit exceeded for 203.0.113.7."}', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791575652' }
    })
    const { fetch, calls } = scripted(limited, json([good]))
    const result = await fetchReleaseList({ fetch, url, appVersion: '0.2.0', now: () => now })
    expect(result).toEqual({ ok: false, reason: 'rate-limited', retryAt: 1_791_575_652_000 })
    expect(JSON.stringify(result)).not.toContain('203.0.113.7')
    expect(calls).toHaveLength(1)
  })

  it('backs off after a 403 or 429 that does not say for how long', async () => {
    const forbidden = scripted(new Response('<html>Request forbidden by administrative rules.</html>', { status: 403 }))
    expect(await fetchReleaseList({ fetch: forbidden.fetch, url, appVersion: '0.2.0', now: () => now })).toEqual({ ok: false, reason: 'rate-limited', retryAt: now + 60 * 60 * 1000 })
    const busy = scripted(new Response('', { status: 429 }))
    expect(await fetchReleaseList({ fetch: busy.fetch, url, appVersion: '0.2.0', now: () => now })).toEqual({ ok: false, reason: 'rate-limited', retryAt: now + 60_000 })
  })

  it('reports other statuses without retrying', async () => {
    for (const status of [404, 500, 502, 304]) {
      const { fetch, calls } = scripted(new Response(status === 304 ? null : '{"message":"x"}', { status }), json([good]))
      expect(await fetchReleaseList({ fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'http', status })
      expect(calls).toHaveLength(1)
    }
  })

  it('never rejects: a network error, a timeout and a broken body are all answers', async () => {
    expect(await fetchReleaseList({ fetch: scripted(new Error('net::ERR_INTERNET_DISCONNECTED')).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'network' })
    expect(await fetchReleaseList({ fetch: scripted(new DOMException('The operation timed out.', 'TimeoutError')).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'network' })
    const throwing = (): Promise<Response> => {
      throw new TypeError('bad argument')
    }
    expect(await fetchReleaseList({ fetch: throwing, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'network' })

    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('connection reset'))
      }
    })
    expect(await fetchReleaseList({ fetch: scripted(new Response(broken, { status: 200 })).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'network' })
  })

  it('gives up when the server does not answer in time', async () => {
    const hanging = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    const started = Date.now()
    expect(await fetchReleaseList({ fetch: hanging, url, appVersion: '0.2.0', timeoutMs: 30 })).toEqual({ ok: false, reason: 'network' })
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('refuses a 200 that is not a JSON list', async () => {
    for (const body of ['<html>captive portal</html>', '', '{"message":"ok"}', '"text"', 'null', '[1,2', '\u0000\u0000']) {
      expect(await fetchReleaseList({ fetch: scripted(new Response(body, { status: 200 })).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'not-a-list' })
    }
    expect(await fetchReleaseList({ fetch: scripted(new Response(null, { status: 200 })).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'not-a-list' })
  })

  it('stops reading once the body passes 2 MB, whatever length was declared', async () => {
    let pulled = 0
    const chunk = new Uint8Array(256 * 1024).fill(0x20)
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(chunk)
      }
    })
    const response = new Response(endless, { status: 200, headers: { 'content-length': '10' } })
    expect(await fetchReleaseList({ fetch: scripted(response).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: false, reason: 'too-large' })
    expect(pulled * chunk.length).toBeLessThan(MAX_RESPONSE_BYTES * 2)
  })

  it('accepts a body just under the limit', async () => {
    const padded = `[${' '.repeat(MAX_RESPONSE_BYTES - 2)}]`
    expect(await fetchReleaseList({ fetch: scripted(new Response(padded, { status: 200 })).fetch, url, appVersion: '0.2.0' })).toEqual({ ok: true, releases: [] })
  })

  it('normalises a hostile list instead of passing it on', async () => {
    const hostile = [
      { ...good, tag_name: 'v9.9.9', html_url: 'https://evil.example/x', body: '<script>alert(1)</script>', name: 'x'.repeat(5000) },
      { ...good, tag_name: '../../etc/passwd' },
      { ...good, tag_name: 'v0.3.0', draft: true },
      '__proto__',
      { __proto__: { tag_name: 'v7.7.7' } },
      null
    ]
    const result = await fetchReleaseList({ fetch: scripted(json(hostile)).fetch, url, appVersion: '0.2.0' })
    expect(result).toEqual({ ok: true, releases: [{ tag: 'v9.9.9', version: '9.9.9', name: '', body: '<script>alert(1)</script>', prerelease: false, publishedAt: '2026-11-01T10:00:00Z' }] })
  })
})
