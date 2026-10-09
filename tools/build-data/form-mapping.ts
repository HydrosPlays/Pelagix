/**
 * Maps every PKHeX (species, form) onto its PokeAPI pokemon_forms row and HOME render key.
 *
 * Algorithm (research report formMapping.md, section 2): per species, sort the PokeAPI form rows by
 * (form_order, id), set aside the rows PKHeX has no index for (Gigantamax, ORAS cosplay Pikachu,
 * Arceus ???, Alcremie decorations, the cosmetic female rows of Frillish / Jellicent / Pyroar), then
 * PKHeX form f is row f. Every pairing is cross-checked by name; a mismatch must be allowlisted in
 * ALIASES or the build fails, because upstream has changed form_order before.
 */
import type { FormVariant } from '../../src/shared/dex-types.ts'
import type { CsvStore, SpriteManifest } from './sources.ts'
import type { PkFormsFile } from './pkhex-types.ts'
import { assert, cmpNum, fail, groupBy, int, sf } from './util.ts'

export interface ApiForm {
  id: number
  identifier: string
  formIdentifier: string
  pokemonId: number
  pokemonIdentifier: string
  speciesId: number
  isDefault: boolean
  isBattleOnly: boolean
  isMega: boolean
  formOrder: number
  /** This row is the form the pokemon row itself stands for. */
  primary: boolean
}

export type MappingHow = 'auto' | 'alias' | 'none'

export interface MappedForm {
  s: number
  f: number
  how: MappingHow
  row?: ApiForm
  sprite: string
  approx: boolean
  shiny: boolean
  female: boolean
  gmax?: string
  variants?: FormVariant[]
}

export interface FormMapping {
  forms: Map<number, MappedForm>
  /** PokeAPI pokemon id -> [species, form] of the PKHeX form that pokemon row stands for. */
  byPokemon: Map<number, [number, number]>
  tally: Record<MappingHow | 'approx', number>
  /** Side-table sizes, for the build report. */
  side: Record<string, number>
}

/** Pairs whose order is right but whose names the generic check cannot relate: "s-f" -> form_identifier. */
const ALIASES: Readonly<Record<string, string>> = {
  // Totem forms: PKHeX calls them "Large".
  '20-2': 'totem-alola', '105-2': 'totem', '735-1': 'totem', '738-1': 'totem', '743-1': 'totem', '752-1': 'totem',
  '754-1': 'totem', '758-1': 'totem', '777-1': 'totem', '784-1': 'totem', '778-2': 'totem-disguised',
  // Genesect drives: PKHeX names them after the type.
  '649-1': 'douse', '649-2': 'shock', '649-3': 'burn', '649-4': 'chill',
  // PKHeX's "Ash" is Battle Bond, "Active" is Ash-Greninja.
  '658-1': 'battle-bond', '658-2': 'ash',
  '718-2': '10-power-construct', '718-3': '50-power-construct',
  '744-1': 'own-tempo',
  '774-0': 'red-meteor', '774-1': 'orange-meteor', '774-2': 'yellow-meteor', '774-3': 'green-meteor',
  '774-4': 'blue-meteor', '774-5': 'indigo-meteor', '774-6': 'violet-meteor',
  // Named in PKHeX, unnamed default form in PokeAPI.
  '888-0': '', '889-0': '', '1017-0': '',
  // Single-form species whose default PokeAPI form is now called "male".
  '592-0': 'male', '593-0': 'male', '668-0': 'male'
}

/** PKHeX forms PokeAPI has no row for -> stand-in HOME render. */
const NO_ROW_SPRITE: Readonly<Record<string, string>> = {
  '59-2': '10230', '101-2': '10232', '549-2': '10237', '713-2': '10243', // Hisuian Lords / Ladies
  '900-1': '900', // Kleavor (Lord)
  '493-18': '493', // Arceus (Legend)
  '1017-4': '1017', '1017-5': '10273', '1017-6': '10274', '1017-7': '10275' // Terastallized Ogerpon
}

/** Mapped forms HOME has no render of -> stand-in. */
const NO_HOME_SPRITE: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {
    '25-8': '25', '133-1': '133', // Let's Go partners
    '172-1': '172', // Spiky-eared Pichu
    '414-1': '414', '414-2': '414',
    '854-1': '854', '855-1': '855', '1012-1': '1012', '1013-1': '1013'
  }
  for (let f = 1; f <= 19; f++) {
    out[`664-${f}`] = '664'
    out[`665-${f}`] = '665'
  }
  for (let f = 1; f <= 4; f++) {
    out[`1007-${f}`] = '1007'
    out[`1008-${f}`] = '1008'
  }
  return out
})()

/**
 * Forms whose own HOME render is a byte-for-byte copy of another form's at the pinned commit
 * although the two look different in the games: an upstream mistake. The render is kept but
 * flagged as a stand-in. "s-f" -> the form whose picture it duplicates.
 */
const DUPLICATE_RENDER: Readonly<Record<string, string>> = {
  '678-3': '678-2' // Mega Meowstic (Female) is a copy of the male's render
}

/**
 * Groups of forms that really do look alike, so sharing one picture is correct: totems that only
 * differ in size, Battle Bond Greninja, Minior's meteor shell whatever the core inside.
 */
const SAME_LOOK: readonly (readonly string[])[] = [
  ['105-1', '105-2'],
  ['658-0', '658-1'],
  ['778-0', '778-2'],
  ['774-1', '774-2', '774-3', '774-4', '774-5', '774-6']
]

const COSPLAY = new Set(['cosplay', 'rock-star', 'belle', 'pop-star', 'phd', 'libre'])
const GENDER_COSMETIC_SPECIES = new Set([592, 593, 668])

function tokens(text: string): string[] {
  return text
    .replace(/♂/g, ' male ')
    .replace(/♀/g, ' female ')
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t !== '')
}

const WHOLE_NAME: Readonly<Record<string, string[]>> = { m: ['male'], f: ['female'], '!': ['exclamation'], '?': ['question'], normal: [] }

/** Generic name cross-check between a PKHeX form name and a PokeAPI form_identifier. */
export function nameMatches(pkhexName: string, formIdentifier: string, species: number): boolean {
  const key = pkhexName.trim().toLowerCase()
  const synonym = key in WHOLE_NAME && !(species === 201 && (key === 'm' || key === 'f')) ? WHOLE_NAME[key] : undefined
  const p = synonym ?? tokens(pkhexName)
  const a = formIdentifier === '' ? [] : formIdentifier.split('-')
  if (p.length === a.length && p.every((t, i) => t === a[i])) return true
  if (key === 'normal' && a.length === 1 && a[0] === 'normal') return true
  if (p.length > 0 && a.length > 0) {
    const ps = new Set(p)
    const as = new Set(a)
    if (p.every((t) => as.has(t)) || a.every((t) => ps.has(t))) return true
  }
  return false
}

function loadApiForms(csv: CsvStore): Map<number, ApiForm[]> {
  const pokemon = new Map(csv.table('pokemon').map((r) => [int(r.id, 'pokemon.id'), r]))
  const rows: ApiForm[] = csv.table('pokemon_forms').map((r) => {
    const pokemonId = int(r.pokemon_id, 'pokemon_forms.pokemon_id')
    const p = pokemon.get(pokemonId)
    if (!p) fail(`pokemon_forms ${r.id} refers to missing pokemon ${pokemonId}`)
    return {
      id: int(r.id, 'pokemon_forms.id'),
      identifier: r.identifier,
      formIdentifier: r.form_identifier,
      pokemonId,
      pokemonIdentifier: p.identifier,
      speciesId: int(p.species_id, 'pokemon.species_id'),
      isDefault: r.is_default === '1',
      isBattleOnly: r.is_battle_only === '1',
      isMega: r.is_mega === '1',
      formOrder: int(r.form_order, 'pokemon_forms.form_order'),
      primary: false
    }
  })
  // Primary form of each pokemon: its is_default row, else the lowest form_order.
  for (const list of groupBy(rows, (r) => r.pokemonId).values()) {
    const sorted = [...list].sort((a, b) => a.formOrder - b.formOrder || a.id - b.id)
    const primary = sorted.find((r) => r.isDefault) ?? sorted[0]
    primary.primary = true
  }
  const bySpecies = groupBy(rows, (r) => r.speciesId)
  for (const list of bySpecies.values()) list.sort((a, b) => a.formOrder - b.formOrder || a.id - b.id)
  return bySpecies
}

function spriteKeyOf(row: ApiForm): string {
  return row.primary ? String(row.pokemonId) : `${row.speciesId}-${row.formIdentifier}`
}

export function mapForms(pkForms: PkFormsFile, csv: CsvStore, manifest: SpriteManifest): FormMapping {
  const bySpecies = loadApiForms(csv)
  const forms = new Map<number, MappedForm>()
  const byPokemon = new Map<number, [number, number]>()
  const tally: FormMapping['tally'] = { auto: 0, alias: 0, none: 0, approx: 0 }
  const side: Record<string, number> = { gmax: 0, cosplay: 0, arceusUnknown: 0, alcremieDecoration: 0, genderCosmetic: 0 }
  const problems: string[] = []
  const usedAliases = new Set<string>()
  const usedNoRow = new Set<string>()
  const usedNoHome = new Set<string>()
  const usedSprites = new Map<string, string>()
  let apiRowsSeen = 0

  for (const species of pkForms.rows) {
    const s = species.s
    const all = bySpecies.get(s)
    if (!all) fail(`PokeAPI has no form rows for species ${s}`)
    apiRowsSeen += all.length

    const gmaxRows: ApiForm[] = []
    const decoRows: ApiForm[] = []
    const rows: ApiForm[] = []
    for (const row of all) {
      const fi = row.formIdentifier
      if (fi === 'gmax') {
        gmaxRows.push(row)
        side.gmax++
      } else if (s === 25 && COSPLAY.has(fi)) side.cosplay++
      else if (s === 493 && fi === 'unknown') side.arceusUnknown++
      else if (s === 869 && !fi.endsWith('strawberry-sweet')) {
        decoRows.push(row)
        side.alcremieDecoration++
      } else if (GENDER_COSMETIC_SPECIES.has(s) && fi === 'female' && !row.primary) side.genderCosmetic++
      else rows.push(row)
    }

    const n = species.forms.length
    if (rows.length > n) {
      problems.push(`species ${s}: PokeAPI rows left over after mapping ${n} PKHeX forms: ${rows.slice(n).map((r) => r.identifier).join(', ')}`)
    }

    for (let f = 0; f < n; f++) {
      const key = `${s}-${f}`
      const pk = species.forms[f]
      const row = rows[f]
      const mapped: MappedForm = { s, f, how: 'none', sprite: '', approx: false, shiny: false, female: false }
      if (!row) {
        const fallback = NO_ROW_SPRITE[key]
        if (fallback === undefined) {
          problems.push(`${key} (${pk.names.map((x) => x.n).join(' / ')}): no PokeAPI row and no entry in NO_ROW_SPRITE`)
          continue
        }
        usedNoRow.add(key)
        mapped.sprite = fallback
        mapped.approx = true
        tally.none++
      } else {
        mapped.row = row
        const names = pk.names.length > 0 ? pk.names.map((x) => x.n) : ['']
        const generic = n === 1 && row.formIdentifier === '' ? true : names.some((name) => nameMatches(name, row.formIdentifier, s))
        if (generic) {
          mapped.how = 'auto'
          tally.auto++
        } else if (ALIASES[key] === row.formIdentifier) {
          mapped.how = 'alias'
          usedAliases.add(key)
          tally.alias++
        } else {
          problems.push(
            `${key}: PKHeX "${names.join('" / "')}" does not match PokeAPI form "${row.identifier}" (form_identifier "${row.formIdentifier}")` +
              (key in ALIASES ? `; ALIASES expects "${ALIASES[key]}"` : '')
          )
          continue
        }
        const own = spriteKeyOf(row)
        if (manifest.has(own)) {
          mapped.sprite = own
        } else {
          const fallback = NO_HOME_SPRITE[key]
          if (fallback === undefined) {
            problems.push(`${key}: HOME has no render "${own}" for ${row.identifier} and NO_HOME_SPRITE has no stand-in`)
            continue
          }
          usedNoHome.add(key)
          mapped.sprite = fallback
          mapped.approx = true
        }
        if (row.primary) byPokemon.set(row.pokemonId, [s, f])
      }
      if (!manifest.has(mapped.sprite)) {
        problems.push(`${key}: sprite "${mapped.sprite}" is not in the HOME manifest`)
        continue
      }
      if (mapped.approx) tally.approx++
      else {
        const clash = usedSprites.get(mapped.sprite)
        if (clash) problems.push(`${key} and ${clash} both map to HOME render "${mapped.sprite}"`)
        usedSprites.set(mapped.sprite, key)
      }
      mapped.shiny = manifest.hasShiny(mapped.sprite)
      mapped.female = manifest.hasFemale(mapped.sprite)
      forms.set(sf(s, f), mapped)
    }

    // Gigantamax: linked by identifier (the gmax rows tie on form_order, so order is useless here).
    for (const g of gmaxRows) {
      const baseIdentifier = g.pokemonIdentifier.replace(/-gmax$/, '')
      assert(baseIdentifier !== g.pokemonIdentifier, `Gigantamax row ${g.identifier} is not named *-gmax`)
      const targets = [...forms.values()].filter((m) => m.s === s && m.row?.pokemonIdentifier === baseIdentifier)
      if (targets.length === 0) {
        problems.push(`Gigantamax row ${g.pokemonIdentifier}: no mapped form of species ${s} belongs to pokemon "${baseIdentifier}"`)
        continue
      }
      const key = String(g.pokemonId)
      if (!manifest.has(key)) {
        problems.push(`Gigantamax row ${g.pokemonIdentifier}: HOME has no render ${key}`)
        continue
      }
      for (const t of targets) t.gmax = key
    }

    // Alcremie: the seven sweets are FormArgument values, exposed as variants of each cream form.
    if (s === 869) {
      const sweets = species.formArgs
      assert(sweets && sweets.length === 7, 'Alcremie no longer lists seven sweets in forms.json')
      assert(decoRows.length === 54, `Expected 54 Alcremie decoration rows, found ${decoRows.length}`)
      for (let f = 0; f < n; f++) {
        const m = forms.get(sf(s, f))
        if (!m?.row) continue
        const cream = m.row.formIdentifier.replace(/-strawberry-sweet$/, '')
        assert(cream !== m.row.formIdentifier, `Alcremie form ${f} is not a *-strawberry-sweet row`)
        m.variants = sweets.map((sweet, id) => {
          const identifier = `${cream}-${sweet.toLowerCase()}-sweet`
          const known = id === 0 ? m.row!.formIdentifier === identifier : decoRows.some((d) => d.formIdentifier === identifier)
          if (!known) fail(`Alcremie: PokeAPI has no form "${identifier}"`)
          const sprite = `869-${identifier}`
          if (!manifest.has(sprite)) fail(`Alcremie: HOME has no render ${sprite}`)
          return { id, name: `${sweet} Sweet`, sprite, shiny: manifest.hasShiny(sprite) }
        })
      }
    }
  }

  for (const key of Object.keys(ALIASES)) if (!usedAliases.has(key)) problems.push(`ALIASES entry ${key} is no longer needed (the generic name check passes or the form is gone)`)
  for (const key of Object.keys(NO_ROW_SPRITE)) if (!usedNoRow.has(key)) problems.push(`NO_ROW_SPRITE entry ${key} is stale: PokeAPI now has a row`)
  for (const key of Object.keys(NO_HOME_SPRITE)) if (!usedNoHome.has(key)) problems.push(`NO_HOME_SPRITE entry ${key} is stale: HOME now has the render`)

  const total = [...bySpecies.values()].reduce((sum, list) => sum + list.length, 0)
  if (apiRowsSeen !== total) problems.push(`PokeAPI has form rows for species beyond 1..1025 (${total - apiRowsSeen} rows)`)

  // Two forms with their own render key must not show the same picture, unless they are known to look alike.
  const idOf = (m: MappedForm): string => `${m.s}-${m.f}`
  const byId = new Map([...forms.values()].map((m) => [idOf(m), m]))
  for (const [id, original] of Object.entries(DUPLICATE_RENDER)) {
    const m = byId.get(id)
    const o = byId.get(original)
    if (!m || !o || m.approx || manifest.blob(m.sprite) !== manifest.blob(o.sprite)) {
      problems.push(`DUPLICATE_RENDER entry ${id} is stale: its render is no longer a copy of ${original}'s`)
      continue
    }
    m.approx = true
    tally.approx++
  }
  const sameLook = new Map<string, number>()
  SAME_LOOK.forEach((group, i) => group.forEach((id) => sameLook.set(id, i)))
  const byBlob = groupBy([...forms.values()].filter((m) => !m.approx), (m) => manifest.blob(m.sprite))
  for (const group of byBlob.values()) {
    if (new Set(group.map((m) => m.sprite)).size < 2) continue
    const looks = new Set(group.map((m) => sameLook.get(idOf(m)) ?? -1))
    if (looks.size !== 1 || looks.has(-1)) {
      problems.push(`${group.map((m) => `${idOf(m)} (${m.sprite})`).join(', ')} have byte-identical HOME renders; list them in SAME_LOOK or DUPLICATE_RENDER`)
    }
  }
  for (const [i, group] of SAME_LOOK.entries()) {
    const blobs = new Set(group.map((id) => byId.get(id)).map((m) => (m ? manifest.blob(m.sprite) : '')))
    if (blobs.size !== 1 || blobs.has('')) problems.push(`SAME_LOOK group ${i} (${group.join(', ')}) is stale: the renders now differ`)
  }

  if (problems.length > 0) {
    fail(`Form mapping failed (${problems.length} problems):\n  ` + problems.sort().join('\n  '))
  }
  const expected = pkForms.rows.reduce((sum, r) => sum + r.forms.length, 0)
  assert(forms.size === expected, `Mapped ${forms.size} forms, PKHeX has ${expected}`)
  return { forms, byPokemon, tally, side }
}

/** Forms ordered by species then form index. */
export function orderedForms(mapping: FormMapping): MappedForm[] {
  return [...mapping.forms.values()].sort((a, b) => cmpNum(a.s, b.s) || cmpNum(a.f, b.f))
}
