/**
 * Form categories: the research taxonomy (formMapping.md section 4) collapsed onto the eleven
 * FormCategory values of the contract.
 */
import type { FormCategory, RegionalVariant } from '../../src/shared/dex-types.ts'
import type { MappedForm } from './form-mapping.ts'
import type { PkForm } from './pkhex-types.ts'
import { assert, fail } from './util.ts'

export interface FormClass {
  cat: FormCategory
  region?: RegionalVariant
  gender?: 'm' | 'f'
}

/** Species whose form index is the gender. */
export const GENDER_FORM_SPECIES: ReadonlySet<number> = new Set([678, 876, 902, 916])

/** Let's Go partner Pikachu / Eevee. */
const PARTNER: ReadonlySet<string> = new Set(['25-8', '133-1'])

/**
 * Distribution-only or one-off forms, as listed by the contract. Later games made a few of them
 * obtainable in-game (see reportEventForms); they stay in this category because they remain
 * special one-offs rather than ordinary cosmetic variants.
 */
export const CURATED_EVENT: ReadonlySet<string> = new Set([
  '172-1', // Spiky-eared Pichu
  '25-1', '25-2', '25-3', '25-4', '25-5', '25-6', '25-7', '25-9', // cap Pikachu
  '666-18', '666-19', // Fancy / Poké Ball Vivillon
  '670-5', // Eternal Flower Floette
  '658-1', // Battle Bond Greninja
  '744-1', // Own Tempo Rockruff
  '801-1', // Original Color Magearna
  '893-1' // Dada Zarude
])

/** Forms that are never owned or show no difference, beyond PKHeX's Lord / Lady flag. */
const HIDDEN: ReadonlySet<string> = new Set([
  '493-18', // Arceus (Legend)
  '890-1', // Eternamax
  '1017-4', '1017-5', '1017-6', '1017-7', // Terastallized Ogerpon
  '1007-1', '1007-2', '1007-3', '1007-4', '1008-1', '1008-2', '1008-3', '1008-4', // ride modes
  '414-1', '414-2', // Mothim keeps Burmy's cloak index, invisibly
  '718-2', '718-3' // Zygarde with Power Construct: the same 10% / 50% Formes with another Ability
])
/** Scatterbug and Spewpa carry Vivillon's pattern index without showing it. */
export const HIDDEN_PATTERN_SPECIES: ReadonlySet<number> = new Set([664, 665])

/**
 * Hidden forms that are, to the eye, another form of the same species: form key -> the form the
 * player sees. What can be obtained as the hidden form is obtained as the visible one too, so
 * their rows are shown on it and their availability counts for it. (Lord / Lady forms, ride modes,
 * Eternamax and Terastallized Ogerpon are never owned and stand for nothing.)
 */
export const VISIBLE_FORM: ReadonlyMap<number, number> = (() => {
  const out = new Map<number, number>()
  const key = (s: number, f: number): number => s * 64 + f
  for (const s of HIDDEN_PATTERN_SPECIES) for (let f = 1; f <= 19; f++) out.set(key(s, f), key(s, 0))
  out.set(key(414, 1), key(414, 0))
  out.set(key(414, 2), key(414, 0))
  out.set(key(718, 2), key(718, 1))
  out.set(key(718, 3), key(718, 0))
  return out
})()

/** Note put on a hidden form's rows when they are shown on its visible form. */
export const HIDDEN_ROW_NOTE: ReadonlyMap<number, string> = new Map([
  [718 * 64 + 2, 'Has the Power Construct Ability'],
  [718 * 64 + 3, 'Has the Power Construct Ability']
])

const REGIONS: ReadonlySet<string> = new Set(['alola', 'galar', 'hisui', 'paldea'])

export function classifyForm(pk: PkForm, mapped: MappedForm): FormClass {
  const { s, f } = mapped
  const key = `${s}-${f}`
  const gender = GENDER_FORM_SPECIES.has(s) ? (pk.gr === 0 ? 'm' : pk.gr === 254 ? 'f' : undefined) : undefined
  if (GENDER_FORM_SPECIES.has(s) && f <= 1) {
    assert(gender === (f === 0 ? 'm' : 'f'), `Gender-form species ${s} form ${f} has gender ratio ${pk.gr}`)
  }
  const out = (cat: FormCategory, region?: RegionalVariant): FormClass => {
    const c: FormClass = { cat }
    if (region) c.region = region
    if (gender) c.gender = gender
    return c
  }

  if (f === 0) return out('base')
  if (pk.mega || pk.primal) return out('mega')
  if (pk.lord || HIDDEN.has(key) || HIDDEN_PATTERN_SPECIES.has(s)) return out('hidden')
  if (pk.totem || (pk.battleOnly && pk.battleOnly.length > 0)) return out('battle')
  if (PARTNER.has(key)) return out('partner')
  if (pk.fused) return out('fusion')
  if (CURATED_EVENT.has(key)) return out('event')
  const first = mapped.row?.formIdentifier.split('-')[0] ?? ''
  if (REGIONS.has(first)) return out('regional', first as RegionalVariant)
  if (GENDER_FORM_SPECIES.has(s)) {
    if (f !== 1) fail(`Unexpected extra form ${key} on a gender-form species`)
    return out('gender')
  }
  if (pk.changeable || (pk.changeableIn && pk.changeableIn.length > 0)) return out('changeable')
  return out('cosmetic')
}

/** Counts the research report gives for the same taxonomy, collapsed to the contract's categories. */
export const REPORT_CATEGORY_COUNTS: Readonly<Record<FormCategory, number>> = {
  base: 1025,
  regional: 57,
  gender: 4,
  cosmetic: 100,
  changeable: 82, // Pelagix: 80, the two Power Construct Zygarde are hidden
  fusion: 6,
  event: 16,
  partner: 2,
  mega: 99, // 97 Mega Evolutions + 2 Primal Reversions
  battle: 41, // 34 battle-only + 12 totems - Eternamax - 4 Terastallized Ogerpon
  hidden: 59 // 6 Lord/Lady/Legend + 8 ride modes + 40 invisible + Eternamax + 4 Terastallized Ogerpon; Pelagix: 61 with Power Construct Zygarde
}

export const CATEGORY_ORDER: readonly FormCategory[] = [
  'base', 'regional', 'gender', 'cosmetic', 'changeable', 'fusion', 'event', 'partner', 'mega', 'battle', 'hidden'
]
