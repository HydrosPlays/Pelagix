/** English display names: species name and genus, and the label / full name of every form. */
import type { CsvStore } from './sources.ts'
import type { FormMapping } from './form-mapping.ts'
import type { FormClass } from './taxonomy.ts'
import type { PkFormsFile } from './pkhex-types.ts'
import { assert, fail, groupBy, int, sf } from './util.ts'

const ENGLISH = '9'

export interface SpeciesNames {
  name: string
  genus: string
}

export function loadSpeciesNames(csv: CsvStore): Map<number, SpeciesNames> {
  const out = new Map<number, SpeciesNames>()
  for (const r of csv.table('pokemon_species_names')) {
    if (r.local_language_id !== ENGLISH) continue
    out.set(int(r.pokemon_species_id, 'pokemon_species_names.pokemon_species_id'), { name: r.name.trim(), genus: r.genus.trim() })
  }
  for (let s = 1; s <= 1025; s++) {
    const n = out.get(s)
    if (!n || n.name === '' || n.genus === '') fail(`Species ${s} has no English name or genus in pokemon_species_names`)
  }
  return out
}

export interface FormNames {
  name: string
  full: string
}

/** Names PokeAPI gets wrong or cannot tell apart: "s-f" -> names. */
const OVERRIDES: Readonly<Record<string, FormNames>> = {
  '658-2': { name: 'Ash-Greninja', full: 'Ash-Greninja' },
  // PokeAPI gives the Power Construct forms the same names as the Aura Break ones.
  '718-2': { name: '10% Forme (Power Construct)', full: '10% Zygarde (Power Construct)' },
  '718-3': { name: '50% Forme (Power Construct)', full: '50% Zygarde (Power Construct)' },
  // PokeAPI: "Standard Galarian Darmanitan", next to plain "Darmanitan" and "Galarian Darumaka".
  '555-2': { name: 'Galarian Form', full: 'Galarian Darmanitan' },
  // PokeAPI: "Pom-pom Oricorio", against its own form name "Pom-Pom Style".
  '741-1': { name: 'Pom-Pom Style', full: 'Pom-Pom Oricorio' }
}

/** Forms PokeAPI has no row for: "s-f" -> [PKHeX name it must still carry, label, full name]. */
const NO_ROW_NAMES: Readonly<Record<string, [string, string, string]>> = {
  '59-2': ['Lord', 'Lord', 'Hisuian Arcanine (Lord)'],
  '101-2': ['Lord', 'Lord', 'Hisuian Electrode (Lord)'],
  '549-2': ['Lady', 'Lady', 'Hisuian Lilligant (Lady)'],
  '713-2': ['Lord', 'Lord', 'Hisuian Avalugg (Lord)'],
  '900-1': ['Lord', 'Lord', 'Kleavor (Lord)'],
  '493-18': ['Legend', 'Legend', 'Arceus (Legend)'],
  '1017-4': ['*Teal', 'Terastallized (Teal Mask)', 'Terastallized Ogerpon (Teal Mask)'],
  '1017-5': ['*Wellspring', 'Terastallized (Wellspring Mask)', 'Terastallized Ogerpon (Wellspring Mask)'],
  '1017-6': ['*Hearthflame', 'Terastallized (Hearthflame Mask)', 'Terastallized Ogerpon (Hearthflame Mask)'],
  '1017-7': ['*Cornerstone', 'Terastallized (Cornerstone Mask)', 'Terastallized Ogerpon (Cornerstone Mask)']
}

/** Removes the species name from a full form name: "Orange Meteor Minior" -> "Orange Meteor". */
function withoutSpecies(full: string, species: string): string {
  const rest = full.split(species).join(' ').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim()
  // "Scatterbug (Polar)" leaves "(Polar)": the qualifier itself is the label.
  return rest.replace(/^\(([^()]*)\)$/, '$1')
}

/** A PKHeX form qualifier as display text. */
function cleanQualifier(q: string): string {
  return q.replace(/♂/g, 'Male').replace(/♀/g, 'Female').replace(/^\*/, '').replace(/\s+/g, ' ').trim()
}

export function buildFormNames(
  pkForms: PkFormsFile,
  mapping: FormMapping,
  classes: Map<number, FormClass>,
  speciesNames: Map<number, SpeciesNames>,
  csv: CsvStore
): Map<number, FormNames> {
  const api = new Map<number, { form: string; pokemon: string }>()
  for (const r of csv.table('pokemon_form_names')) {
    if (r.local_language_id !== ENGLISH) continue
    api.set(int(r.pokemon_form_id, 'pokemon_form_names.pokemon_form_id'), { form: r.form_name.trim(), pokemon: r.pokemon_name.trim() })
  }

  const out = new Map<number, FormNames>()
  const usedNoRow = new Set<string>()
  for (const species of pkForms.rows) {
    const s = species.s
    const speciesName = speciesNames.get(s)!.name
    const n = species.forms.length
    const candidates: { key: number; q: string; apiPokemon: string; gender?: 'm' | 'f' }[] = []

    for (const pk of species.forms) {
      const f = pk.f
      const id = `${s}-${f}`
      const key = sf(s, f)
      const mapped = mapping.forms.get(key)!
      const cls = classes.get(key)!
      const q = cleanQualifier(pk.names[0]?.n ?? '')
      const names = mapped.row ? api.get(mapped.row.id) : undefined
      let result: FormNames

      if (OVERRIDES[id]) {
        result = { ...OVERRIDES[id] }
      } else if (!mapped.row) {
        const entry = NO_ROW_NAMES[id]
        if (!entry) fail(`${id} has no PokeAPI row and no entry in NO_ROW_NAMES`)
        assert(pk.names[0]?.n === entry[0], `${id}: PKHeX now calls this form "${pk.names[0]?.n}", NO_ROW_NAMES expects "${entry[0]}"`)
        usedNoRow.add(id)
        result = { name: entry[1], full: entry[2] }
      } else if (s === 869) {
        // PokeAPI names every Alcremie row after cream + sweet; the form index is the cream alone.
        assert(q !== '', `Alcremie form ${f} has no PKHeX name`)
        result = { name: q, full: f === 0 ? speciesName : `${q} ${speciesName}` }
      } else if (f === 0) {
        let name = n > 1 ? (names?.form ?? '') : ''
        if (name === speciesName) name = ''
        // Frillish, Jellicent and Pyroar: PokeAPI calls the default form "Male", but it is not a gender form.
        if (mapped.row.formIdentifier === 'male' && cls.gender === undefined) name = ''
        result = { name, full: speciesName }
      } else {
        let full = names?.pokemon ?? ''
        let name = names?.form ?? ''
        if (full === '') {
          if (name !== '') full = `${speciesName} (${name})`
          else if (q !== '') full = /^Mega\b/.test(q) ? `Mega ${speciesName}${q.slice(4)}` : `${speciesName} (${q})`
          else fail(`${id}: neither PokeAPI nor PKHeX names this form`)
        }
        if (name === '') name = withoutSpecies(full, speciesName) || q
        if (name === '') fail(`${id}: no form label could be derived from "${full}"`)
        // PokeAPI keeps the word "Form" in a few Generation 9 names ("Droopy Form Tatsugiri") and drops it in
        // all others ("Midnight Lycanroc", "Antique Sinistea"): one convention.
        const formWord = ` Form ${speciesName}`
        if (full.endsWith(formWord)) full = `${full.slice(0, -formWord.length)} ${speciesName}`
        result = { name, full }
      }
      out.set(key, result)
      candidates.push({ key, q, apiPokemon: names?.pokemon ?? '', gender: cls.gender })
    }

    // Two forms of one species must never share a full name or a label.
    const fix = (field: 'full' | 'name'): void => {
      for (const group of groupBy(candidates, (c) => out.get(c.key)![field]).values()) {
        if (group.length < 2 || (field === 'name' && out.get(group[0].key)!.name === '')) continue
        // Take the first way of telling them apart that gives every form of the group its own name.
        const strategies: ((c: (typeof group)[number], current: string) => string)[] = [
          (c) => (field === 'name' ? withoutSpecies(c.apiPokemon, speciesName) : ''),
          (c, current) => (c.gender ? `${current} (${c.gender === 'm' ? 'Male' : 'Female'})` : ''),
          (c, current) => (c.q !== '' ? `${current} (${c.q})` : '')
        ]
        // A base form keeps its name when renaming the others is enough ("Meteor Form" vs "Orange Meteor").
        const hasBase = group[0].key % 64 === 0
        const attempts = strategies.flatMap((strategy) => (hasBase ? [{ strategy, keepFirst: true }, { strategy, keepFirst: false }] : [{ strategy, keepFirst: false }]))
        for (const { strategy, keepFirst } of attempts) {
          const values = group.map((c, i) => (keepFirst && i === 0 ? out.get(c.key)![field] : strategy(c, out.get(c.key)![field])))
          if (values.some((v) => v === '') || new Set(values).size !== values.length) continue
          group.forEach((c, i) => (out.get(c.key)![field] = values[i]))
          break
        }
      }
    }
    fix('full')
    fix('name')
    for (const field of ['full', 'name'] as const) {
      for (const [value, group] of groupBy(candidates, (c) => out.get(c.key)![field])) {
        if (value !== '' && group.length > 1) {
          fail(`Species ${s} (${speciesName}): forms ${group.map((c) => c.key % 64).join(', ')} share the ${field} name "${value}"`)
        }
      }
    }
  }
  for (const id of Object.keys(NO_ROW_NAMES)) assert(usedNoRow.has(id), `NO_ROW_NAMES entry ${id} is stale`)
  return out
}

/** Rejects text that is empty, a leaked identifier or a stringified non-value. */
export function checkDisplayText(text: string, what: string, allowEmpty = false): void {
  if (text === '' && allowEmpty) return
  if (text.trim() === '' || text !== text.trim()) fail(`${what}: empty or padded display text ${JSON.stringify(text)}`)
  if (/undefined|\bnull\b|\bNaN\b|\[object/.test(text)) fail(`${what}: bad display text ${JSON.stringify(text)}`)
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text)) fail(`${what}: an identifier leaked into display text: ${JSON.stringify(text)}`)
  // Control characters, a soft hyphen (U+00AD) or the replacement character (U+FFFD).
  if (/[\x00-\x1f\x7f\xad]/.test(text) || text.includes(String.fromCharCode(0xfffd))) fail(`${what}: control or replacement character in ${JSON.stringify(text)}`)
}
