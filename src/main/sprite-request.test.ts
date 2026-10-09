import { describe, expect, it } from 'vitest'
import { homeSpritePath } from '@shared/sprites'
import { createDeduper, createLimiter, isPng, parseSpriteRequest } from './sprite-request'

const defer = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('parseSpriteRequest', () => {
  it('accepts every path shape homeSpritePath produces', () => {
    expect(parseSpriteRequest(`sprite://home/${homeSpritePath('25')}`)).toEqual({ path: '25.png', width: null, bucket: 'full' })
    expect(parseSpriteRequest(`sprite://home/${homeSpritePath('201-b', { shiny: true })}`)?.path).toBe('shiny/201-b.png')
    expect(parseSpriteRequest(`sprite://home/${homeSpritePath('25', { female: true })}`)?.path).toBe('female/25.png')
    expect(parseSpriteRequest(`sprite://home/${homeSpritePath('25', { shiny: true, female: true })}?w=128`)).toEqual({
      path: 'shiny/female/25.png',
      width: 128,
      bucket: 'w128'
    })
    expect(parseSpriteRequest('sprite://home/869-ruby-swirl-star-sweet.png?w=384')?.bucket).toBe('w384')
  })

  it('accepts exactly the five thumbnail widths', () => {
    for (const w of [96, 128, 160, 256, 384]) expect(parseSpriteRequest(`sprite://home/1.png?w=${w}`)?.width).toBe(w)
    for (const w of ['0', '64', '100', '512', '1280', '0128', '128px', '-128', '1e2', '']) {
      expect(parseSpriteRequest(`sprite://home/1.png?w=${w}`), w).toBeNull()
    }
  })

  it('rejects everything else', () => {
    const bad = [
      'sprite://pokemon/25.png',
      'sprite://HOME/25.png',
      'sprite://home:80/25.png',
      'sprite://user@home/25.png',
      'sprite://home/25.png#frag',
      'sprite://home/25.png?w=128&x=1',
      'sprite://home/25.png?x=1',
      'sprite://home/25.png?W=128',
      'sprite://home/25.PNG',
      'sprite://home/Pikachu.png',
      'sprite://home/25.jpg',
      'sprite://home/25',
      'sprite://home/.png',
      'sprite://home/',
      'sprite://home',
      'sprite://home//25.png',
      'sprite://home/female/shiny/25.png',
      'sprite://home/shiny/shiny/25.png',
      'sprite://home/other/25.png',
      'sprite://home/shiny/female/extra/25.png',
      'sprite://home/..%2f..%2fsave.json',
      'sprite://home/shiny%2f25.png',
      'sprite://home/shiny\\25.png',
      'sprite://home/25_1.png',
      'sprite://home/25.png/',
      'sprite://home/25.png%00',
      'https://home/25.png',
      'file:///C:/25.png',
      'not a url'
    ]
    for (const url of bad) expect(parseSpriteRequest(url), url).toBeNull()
  })

  it('never yields a path that could leave the cache folder', () => {
    const dotted = ['sprite://home/../25.png', 'sprite://home/shiny/../../25.png', 'sprite://home/./25.png', 'sprite://home/%2e%2e/25.png']
    for (const url of dotted) {
      // The URL parser collapses dot segments before the pattern sees them; what survives is a plain sprite path.
      expect(parseSpriteRequest(url)?.path, url).toBe('25.png')
    }
  })
})

describe('isPng', () => {
  it('checks the signature', () => {
    expect(isPng(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]))).toBe(true)
    expect(isPng(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false)
    expect(isPng(new TextEncoder().encode('<!doctype html><html>captive portal</html>'))).toBe(false)
    expect(isPng(new Uint8Array(0))).toBe(false)
  })
})

describe('createLimiter', () => {
  it('caps concurrency, runs waiters in order and survives failures', async () => {
    const limit = createLimiter(8)
    let active = 0
    let peak = 0
    const started: number[] = []
    const gates = Array.from({ length: 30 }, () => defer())
    const results = gates.map((gate, i) =>
      limit(async () => {
        started.push(i)
        peak = Math.max(peak, ++active)
        try {
          await gate.promise
          return i
        } finally {
          active--
        }
      })
    )
    await tick()
    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6, 7])

    gates[3]!.reject(new Error('boom'))
    await expect(results[3]).rejects.toThrow('boom')
    await tick()
    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])

    gates.forEach((gate) => gate.resolve())
    const settled = await Promise.allSettled(results)
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(29)
    expect(started).toEqual(Array.from({ length: 30 }, (_, i) => i))
    expect(peak).toBe(8)
    expect(active).toBe(0)
  })
})

describe('createDeduper', () => {
  it('shares one run per key and keeps the key claimed while held work is pending', async () => {
    const dedupe = createDeduper<string>()
    let runs = 0
    const gate = defer<string>()
    const write = defer()
    const task = async (hold: (p: Promise<unknown>) => void) => {
      runs++
      const value = await gate.promise
      hold(write.promise)
      return value
    }

    const a = dedupe('k', task)
    const b = dedupe('k', task)
    const other = dedupe('other', async () => 'x')
    expect(b).toBe(a)
    expect(await other).toBe('x')
    gate.resolve('bytes')
    expect(await a).toBe('bytes')
    await tick()

    // result delivered, cache write still running: a new request reuses it
    expect(await dedupe('k', task)).toBe('bytes')
    expect(runs).toBe(1)

    write.resolve()
    await tick()
    const again = dedupe('k', async () => 'fresh')
    expect(await again).toBe('fresh')
  })

  it('releases the key after a failure', async () => {
    const dedupe = createDeduper<string>()
    await expect(dedupe('k', async () => Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    await tick()
    expect(await dedupe('k', async () => 'ok')).toBe('ok')
  })
})
