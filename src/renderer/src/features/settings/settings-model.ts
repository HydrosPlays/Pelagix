/**
 * Pure helpers behind the Settings page: how the Living Dex rules are grouped, what a rule change
 * does to the number of slots, and the wording of sizes, versions and import summaries.
 * No React and no DOM, so everything here is unit-tested.
 */

import type { SpeciesSummary } from '@shared/dex-types'
import type { CatchEntry, DexRules } from '@shared/save-types'
import { isFormSlotted, matchRulePreset, RULE_KEYS, type RulePresetId } from '@renderer/domain/slots'
import { formatCount } from '@renderer/lib/format'
import type { SaveParseReport } from '@renderer/lib/storage'

export type RuleKey = keyof DexRules

// ---------------------------------------------------------------- rule groups

export interface RuleGroup {
  id: 'box' | 'battle'
  title: string
  description: string
  keys: readonly RuleKey[]
}

/** The rules as the page lists them: forms that can sit in a box, then forms that cannot. */
export const RULE_GROUPS: readonly RuleGroup[] = [
  {
    id: 'box',
    title: 'Forms you can keep in a box',
    description: 'Switch a kind of form on and every one of them gets a slot of its own.',
    keys: ['regional', 'genderForms', 'genderDiffs', 'cosmetic', 'changeable', 'heldItem', 'fusion', 'event', 'partner', 'alcremieSweets']
  },
  {
    id: 'battle',
    title: 'Forms that only exist in battle',
    description: 'They cannot be stored, so most Living Dexes leave them out. Switch them on if you want a slot for each one anyway.',
    keys: ['mega', 'battle', 'gmax']
  }
]

export type PresetChoice = RulePresetId | 'custom'

/** The preset the rules equal, or "custom" for any other mix. */
export function presetChoice(rules: DexRules): PresetChoice {
  return matchRulePreset(rules) ?? 'custom'
}

export function sameRules(a: DexRules, b: DexRules): boolean {
  return RULE_KEYS.every((key) => a[key] === b[key])
}

// ---------------------------------------------------------------- slot counts

/**
 * How many Living Dex slots a rule set produces. Counts exactly what `buildSlots` would build
 * (the tests hold the two together) without building and caching a slot list, which matters here
 * because the page asks about a dozen rule sets it never shows.
 */
export function countSlots(species: readonly SpeciesSummary[], rules: DexRules): number {
  let total = 0
  for (const s of species) {
    const hasGenderForms = s.forms.some((form) => form.cat === 'gender')
    for (const form of s.forms) {
      if (!isFormSlotted(s, form, rules)) continue
      const variants = form.variants?.length ?? 0
      if (rules.alcremieSweets && variants > 0) total += variants
      else if (rules.genderDiffs && s.genderDiff && form.female && form.cat !== 'gender' && !(rules.genderForms && hasGenderForms)) total += 2
      else total += 1
      if (rules.gmax && form.gmax) total += 1
    }
  }
  return total
}

/**
 * For every rule, the slots it accounts for with the other rules as they are: the difference
 * between having it on and having it off. For a rule that is off this is what switching it on
 * would add; rules interact (gender forms and gender differences, sweets and creams), so the
 * figures are recomputed whenever any rule changes.
 */
export function ruleImpact(species: readonly SpeciesSummary[], rules: DexRules): Record<RuleKey, number> {
  const out = {} as Record<RuleKey, number>
  for (const key of RULE_KEYS) {
    out[key] = countSlots(species, { ...rules, [key]: true }) - countSlots(species, { ...rules, [key]: false })
  }
  return out
}

/** "+262", "−12" (a real minus sign), "0". */
export function signed(n: number): string {
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${formatCount(Math.abs(n))}`
}

// ---------------------------------------------------------------- sizes and versions

/** Human file size: "0 KB", "412 KB", "38.2 MB", "1.25 GB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1000) return `${Math.max(1, Math.round(kb))} KB`
  const mb = kb / 1024
  if (mb < 1000) return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

/** First seven characters of a commit hash; anything shorter comes back unchanged. */
export function shortCommit(hash: string): string {
  const clean = hash.trim()
  return clean.length > 7 ? clean.slice(0, 7) : clean
}

/** The save file inside the app's data folder, with the folder's own separator. */
export function saveFilePath(userData: string): string {
  const separator = userData.includes('\\') && !userData.includes('/') ? '\\' : '/'
  return `${userData.replace(/[\\/]+$/, '')}${separator}save.json`
}

// ---------------------------------------------------------------- import

export interface ImportSummary {
  /** Usable entries in the file. */
  entries: number
  /** Entries the file held that could not be used. */
  dropped: number
  /** Entries kept after an invalid detail was removed. */
  repaired: number
  shiny: number
  achievements: number
  trainerName: string
  /** When the file was last saved, ISO timestamp. */
  savedAt: string
  /** Entries of the file that are not in the current save yet: what "Merge" would add. */
  fresh: number
  /** Entries of the file the current save already has (same id). */
  known: number
  /** Written by a newer Pelagix. */
  newer: boolean
}

/** Everything the import confirmation shows, from the parsed file and the entries the user has now. */
export function summarizeImport(report: Pick<SaveParseReport, 'save' | 'dropped' | 'repaired' | 'newer'>, current: readonly Pick<CatchEntry, 'id'>[]): ImportSummary {
  const have = new Set(current.map((entry) => entry.id))
  const entries = report.save.entries
  const known = entries.filter((entry) => have.has(entry.id)).length
  return {
    entries: entries.length,
    dropped: report.dropped,
    repaired: report.repaired,
    shiny: entries.filter((entry) => entry.shiny).length,
    achievements: Object.keys(report.save.achievements).length,
    trainerName: report.save.settings.trainerName,
    savedAt: report.save.updatedAt,
    fresh: entries.length - known,
    known,
    newer: report.newer
  }
}
