/**
 * Version comparison for the updater: strict Semantic Versioning 2.0.0, one optional leading "v".
 * No dependencies. Anything that does not parse is "not a version" and is ignored by every caller.
 */

export interface SemVer {
  major: number
  minor: number
  patch: number
  /** Prerelease identifiers: numbers for numeric ones, strings otherwise. Empty for a stable version. */
  pre: readonly (number | string)[]
}

const MAX_TAG_LENGTH = 64
// Each numeric part is at most 9 digits, so it is always a safe integer.
const SEMVER =
  /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

/** "0.2.0", "v0.2.0", "v0.3.0-beta.1", "1.0.0+build.5" -> a version; everything else -> null. */
export function parseVersion(raw: unknown): SemVer | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (s.length === 0 || s.length > MAX_TAG_LENGTH) return null
  if (s[0] === 'v' || s[0] === 'V') s = s.slice(1)
  const m = SEMVER.exec(s)
  if (!m) return null
  const pre: (number | string)[] = []
  if (m[4] !== undefined) {
    for (const id of m[4].split('.')) {
      if (/^\d+$/.test(id)) {
        // Numeric identifiers: no leading zeros, and small enough to compare as numbers.
        if ((id.length > 1 && id[0] === '0') || id.length > 15) return null
        pre.push(Number(id))
      } else {
        pre.push(id)
      }
    }
  }
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre }
}

/** The version without the "v" and without build metadata: "0.3.0-beta.1". */
export function formatVersion(v: SemVer): string {
  const core = `${v.major}.${v.minor}.${v.patch}`
  return v.pre.length > 0 ? `${core}-${v.pre.join('.')}` : core
}

export const isPrerelease = (v: SemVer): boolean => v.pre.length > 0

/** Negative when a < b, 0 when equal in precedence (build metadata never counts), positive when a > b. */
export function compareVersions(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  // A version without a prerelease part is newer than the same version with one.
  if (a.pre.length === 0 || b.pre.length === 0) return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1
  const n = Math.min(a.pre.length, b.pre.length)
  for (let i = 0; i < n; i++) {
    const x = a.pre[i] as number | string
    const y = b.pre[i] as number | string
    if (x === y) continue
    const xn = typeof x === 'number'
    const yn = typeof y === 'number'
    if (xn && yn) return x < y ? -1 : 1
    // Numeric identifiers sort before alphanumeric ones; those compare by ASCII code, not by locale.
    if (xn !== yn) return xn ? -1 : 1
    return x < y ? -1 : 1
  }
  return a.pre.length === b.pre.length ? 0 : a.pre.length < b.pre.length ? -1 : 1
}

/** "v0.2.0" -> "0.2.0"; null for anything that is not a version. */
export function plainVersion(raw: unknown): string | null {
  const v = parseVersion(raw)
  return v === null ? null : formatVersion(v)
}

/** True only when both parse and `candidate` is the higher one. Never true for garbage. */
export function isNewerVersion(candidate: unknown, than: unknown): boolean {
  const a = parseVersion(candidate)
  const b = parseVersion(than)
  return a !== null && b !== null && compareVersions(a, b) > 0
}
