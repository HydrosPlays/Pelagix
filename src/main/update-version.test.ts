import { describe, expect, it } from 'vitest'
import { compareVersions, formatVersion, isNewerVersion, isPrerelease, parseVersion, plainVersion, type SemVer } from './update-version'

const v = (s: string): SemVer => {
  const parsed = parseVersion(s)
  if (parsed === null) throw new Error(`not a version: ${s}`)
  return parsed
}

describe('parseVersion', () => {
  const valid: [string, SemVer][] = [
    ['0.1.0', { major: 0, minor: 1, patch: 0, pre: [] }],
    ['v0.2.0', { major: 0, minor: 2, patch: 0, pre: [] }],
    ['V1.2.3', { major: 1, minor: 2, patch: 3, pre: [] }],
    ['  v0.2.0\n', { major: 0, minor: 2, patch: 0, pre: [] }],
    ['10.20.30', { major: 10, minor: 20, patch: 30, pre: [] }],
    ['v0.3.0-beta.1', { major: 0, minor: 3, patch: 0, pre: ['beta', 1] }],
    ['1.0.0-alpha', { major: 1, minor: 0, patch: 0, pre: ['alpha'] }],
    ['1.0.0-0.3.7', { major: 1, minor: 0, patch: 0, pre: [0, 3, 7] }],
    ['1.0.0-x.7.z.92', { major: 1, minor: 0, patch: 0, pre: ['x', 7, 'z', 92] }],
    ['1.0.0-x-y-z.--', { major: 1, minor: 0, patch: 0, pre: ['x-y-z', '--'] }],
    ['1.0.0-rc.1+build.5', { major: 1, minor: 0, patch: 0, pre: ['rc', 1] }],
    ['0.2.0+20261009', { major: 0, minor: 2, patch: 0, pre: [] }],
    ['1.0.0-0a', { major: 1, minor: 0, patch: 0, pre: ['0a'] }],
    ['999999999.999999999.999999999', { major: 999999999, minor: 999999999, patch: 999999999, pre: [] }]
  ]
  for (const [input, expected] of valid) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      expect(parseVersion(input)).toEqual(expected)
    })
  }

  const invalid: unknown[] = [
    '',
    ' ',
    'v',
    'latest',
    'nightly',
    'release-0.2.0',
    'pelagix-v0.2.0',
    '0.2',
    'v1',
    '1.2.3.4',
    '0.2.0.',
    '.0.2.0',
    '0..2',
    '01.2.3',
    '1.02.3',
    '1.2.03',
    '1.2.3-',
    '1.2.3-01',
    '1.2.3-beta..1',
    '1.2.3-beta.',
    '1.2.3+',
    '1.2.3-beta_1',
    '1.2.3 beta',
    'vv1.2.3',
    'v 1.2.3',
    '=1.2.3',
    '1.2.x',
    '1.2.*',
    '^1.2.3',
    '~1.2.3',
    '1,2,3',
    '-1.2.3',
    '1.-2.3',
    '1.2.3e5',
    '0x1.2.3',
    '１.２.３',
    '1.2.3\u0000',
    '1.2.3\n4.5.6',
    '1.2.3/../../x',
    '1.2.3<script>',
    '1234567890.0.0',
    `1.2.3-${'a'.repeat(100)}`,
    `${'1'.repeat(100)}.0.0`,
    null,
    undefined,
    123,
    1.2,
    {},
    [],
    ['1.2.3'],
    { toString: () => '1.2.3' }
  ]
  for (const input of invalid) {
    it(`rejects ${typeof input === 'string' ? JSON.stringify(input.slice(0, 40)) : String(input)}`, () => {
      expect(parseVersion(input)).toBeNull()
    })
  }

  it('formats what it parsed, without the v or the build metadata', () => {
    expect(formatVersion(v('v0.3.0-beta.1+sha.abc'))).toBe('0.3.0-beta.1')
    expect(formatVersion(v('0.2.0'))).toBe('0.2.0')
  })

  it('stays fast on a hostile tag', () => {
    const started = performance.now()
    for (let i = 0; i < 1000; i++) parseVersion(`1.2.3-${'a.'.repeat(30)}!`)
    parseVersion(`1.2.3-${'a-'.repeat(100_000)}`)
    expect(performance.now() - started).toBeLessThan(200)
  })
})

describe('compareVersions', () => {
  it('orders the sequence from the Semantic Versioning specification', () => {
    const ordered = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '1.10.0', '2.0.0', '10.0.0']
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < ordered.length; j++) {
        const got = Math.sign(compareVersions(v(ordered[i] as string), v(ordered[j] as string)))
        expect([ordered[i], ordered[j], got]).toEqual([ordered[i], ordered[j], Math.sign(i - j)])
      }
    }
  })

  const cases: [string, string, number][] = [
    ['0.2.0', '0.1.0', 1],
    ['0.1.0', '0.2.0', -1],
    ['0.2.0', '0.2.0', 0],
    ['v0.2.0', '0.2.0', 0],
    ['0.10.0', '0.9.0', 1],
    ['0.2.10', '0.2.9', 1],
    ['1.0.0', '0.99.99', 1],
    ['0.2.0', '0.2.0-beta.1', 1],
    ['0.2.0-beta.1', '0.2.0', -1],
    ['0.2.0-beta.2', '0.2.0-beta.10', -1],
    ['0.2.0-beta.1', '0.2.0-alpha.9', 1],
    ['0.2.0-rc.1', '0.2.0-beta.99', 1],
    ['0.2.0-1', '0.2.0-alpha', -1],
    ['0.2.0-beta', '0.2.0-beta.0', -1],
    ['0.2.0-Beta', '0.2.0-beta', -1],
    ['0.2.0+build.2', '0.2.0+build.1', 0],
    ['0.2.0-beta.1+a', '0.2.0-beta.1+b', 0],
    ['0.3.0-beta.1', '0.2.9', 1]
  ]
  for (const [a, b, expected] of cases) {
    it(`${a} vs ${b}`, () => {
      expect(Math.sign(compareVersions(v(a), v(b)))).toBe(expected)
      expect(Math.sign(compareVersions(v(b), v(a)))).toBe(-expected || 0)
    })
  }

  it('knows a prerelease from a stable version', () => {
    expect(isPrerelease(v('0.3.0-beta.1'))).toBe(true)
    expect(isPrerelease(v('0.3.0'))).toBe(false)
    expect(isPrerelease(v('0.3.0+build'))).toBe(false)
  })
})

describe('plainVersion and isNewerVersion', () => {
  it('writes a version the one way the app stores it', () => {
    expect(plainVersion('v0.2.0')).toBe('0.2.0')
    expect(plainVersion(' 0.3.0-beta.1+sha ')).toBe('0.3.0-beta.1')
    expect(plainVersion('latest')).toBeNull()
    expect(plainVersion(42)).toBeNull()
  })

  const cases: [unknown, unknown, boolean][] = [
    ['0.3.0', '0.2.0', true],
    ['v0.2.1', '0.2.0', true],
    ['0.2.0', '0.2.0', false],
    ['0.2.0+build.7', '0.2.0', false],
    ['0.1.0', '0.2.0', false],
    ['0.3.0', '0.3.0-beta.1', true],
    ['0.3.0-beta.1', '0.3.0', false],
    ['latest', '0.2.0', false],
    ['0.3.0', 'dev', false],
    ['0.3', '0.2.0', false],
    [null, '0.2.0', false],
    ['0.3.0', undefined, false]
  ]
  for (const [candidate, than, expected] of cases) {
    it(`${String(candidate)} newer than ${String(than)} -> ${expected}`, () => {
      expect(isNewerVersion(candidate, than)).toBe(expected)
    })
  }
})
