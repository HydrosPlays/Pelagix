/**
 * Data builder: turns the PKHeX extract (data/pkhex) and PokeAPI's tables into the datasets the
 * app loads (src/renderer/public/data), as specified by src/shared/dex-types.ts.
 *
 *   node tools/build-data/index.ts
 *
 * Any broken assumption about the inputs aborts the build instead of producing wrong data.
 */
import type {
  DexIndex, EncounterRow, FormCategory, FormDetail, FormSummary, SpeciesDetail, SpeciesSummary, TypeId
} from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import { POKEAPI_COMMIT, SPRITES_COMMIT } from '../../src/shared/sprites.ts'
import { computeAvailability } from './availability.ts'
import { loadDexNumbers, loadFlavor, loadSizes } from './details.ts'
import { buildEventDrafts } from './events.ts'
import { EvolutionGraph, loadEvolutions } from './evolutions.ts'
import { buildEvolveSources } from './evolve-sources.ts'
import { loadFormChanges } from './form-changes.ts'
import { mapForms } from './form-mapping.ts'
import { checkGameCodes, GAME_IDS, GO_IDX, idxOfCode } from './game-map.ts'
import { LocationNames } from './locations.ts'
import { finalizeRows } from './merge.ts'
import type { FinalRow } from './merge.ts'
import { KIND_ORDER } from './methods.ts'
import { buildFormNames, checkDisplayText, loadSpeciesNames } from './names.ts'
import type { Pair } from './pkhex-types.ts'
import { PokeapiPlaces } from './pokeapi-places.ts'
import { compareRows, isTimeLimited } from './row-order.ts'
import { RowBuilder } from './rows.ts'
import type { RowDraft } from './rows.ts'
import { CsvStore, loadPkhex, SpriteManifest } from './sources.ts'
import { checkSvExclusives } from './sv-exclusives.ts'
import type { SvSeed } from './sv-exclusives.ts'
import { speciesTags } from './tags.ts'
import { CATEGORY_ORDER, classifyForm, CURATED_EVENT, GENDER_FORM_SPECIES, REPORT_CATEGORY_COUNTS } from './taxonomy.ts'
import type { FormClass } from './taxonomy.ts'
import { BuildError, assert, cmpNum, countBy, fail, formatBytes, int, sf, sfForm, sfSpecies } from './util.ts'
import { writeDatasets } from './write.ts'

const TYPE_IDS: readonly TypeId[] = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric',
  'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar'
]
const TYPE_SET: ReadonlySet<string> = new Set(TYPE_IDS)

/**
 * Pokémon GO has these, but they cannot be sent on to Pokémon HOME, so PKHeX (which only knows
 * what can leave GO) has no encounter for them.
 */
const GO_ONLY: readonly { s: number; f: number; shiny: boolean }[] = [
  { s: 327, f: 0, shiny: true }, // Spinda
  { s: 718, f: 0, shiny: false }, // Zygarde 50%, assembled from Zygarde Cells
  { s: 718, f: 1, shiny: false } // Zygarde 10%
]
const GO_ONLY_NOTE = 'Cannot be sent to Pokémon HOME'

const log = (text = ''): void => console.log(text)
const section = (title: string): void => log(`\n== ${title}`)

function table(rows: [string, string | number][], columns = 4): void {
  const cells = rows.map(([k, v]) => `${k} ${v}`)
  const width = Math.max(...cells.map((c) => c.length)) + 2
  for (let i = 0; i < cells.length; i += columns) log('  ' + cells.slice(i, i + columns).map((c) => c.padEnd(width)).join(''))
}

function main(): void {
  const started = Date.now()
  const pk = loadPkhex()
  const csv = new CsvStore()
  const manifest = new SpriteManifest()
  checkGameCodes(pk.meta.games.map((g) => g.code))
  assert(JSON.stringify(pk.encounters.games) === JSON.stringify(pk.meta.games.map((g) => g.code)), 'encounters.json and meta.json disagree on the game list')

  // --- forms ---------------------------------------------------------------------------------
  const mapping = mapForms(pk.forms, csv, manifest)
  const classes = new Map<number, FormClass>()
  for (const species of pk.forms.rows) {
    for (const form of species.forms) classes.set(sf(species.s, form.f), classifyForm(form, mapping.forms.get(sf(species.s, form.f))!))
  }
  const speciesNames = loadSpeciesNames(csv)
  const formNames = buildFormNames(pk.forms, mapping, classes, speciesNames, csv)
  const speciesName = (s: number): string => speciesNames.get(s)?.name ?? fail(`No name for species ${s}`)
  const describe = (key: number): string => `${formNames.get(key)?.full ?? '?'} (${sfSpecies(key)}-${sfForm(key)})`

  // --- presence, eggs, evolutions per game ---------------------------------------------------------
  const presence: Set<number>[] = GAMES.map(() => new Set<number>())
  const normalizePair = ([s, f]: Pair, game: number): number | undefined => {
    const g = GAMES[game]
    // ORAS cosplay Pikachu shares indices 1-6 with the cap Pikachu; Pelagix keeps the caps.
    if (s === 25 && f >= 1 && f <= 6 && g.generation === 6) return undefined
    // Generation 4 has a ???-type Arceus at index 9, which shifts the later plates by one.
    if (s === 493 && g.generation === 4 && g.kind === 'main') {
      if (f === 9) fail('Generation 4 presence lists ???-type Arceus')
      if (f > 9) return sf(s, f - 1)
    }
    return sf(s, f)
  }
  for (const [code, pairs] of Object.entries(pk.presence)) {
    for (const game of idxOfCode(code)) {
      for (const pair of pairs) {
        const key = normalizePair(pair, game)
        if (key === undefined) continue
        if (!mapping.forms.has(key)) fail(`presence.json lists unknown form ${pair} for ${code}`)
        presence[game].add(key)
      }
    }
  }
  const eggs: Set<number>[] = GAMES.map(() => new Set<number>())
  for (const [code, pairs] of Object.entries(pk.eggs)) {
    for (const game of idxOfCode(code)) {
      for (const pair of pairs) {
        const key = normalizePair(pair, game)
        if (key === undefined) continue
        if (!presence[game].has(key)) fail(`eggs.json lists ${pair} for ${code}, which is not present there`)
        // Battle-only states never come out of an egg; the extractor filters them (PKHeX's Gen 5 generator does not).
        const cat = classes.get(key)!.cat
        if (cat === 'mega' || cat === 'battle') fail(`eggs.json lists ${describe(key)} for ${code}: a ${cat} form cannot hatch`)
        eggs[game].add(key)
      }
    }
  }
  const evolutions = loadEvolutions(pk.evolutions, presence)
  const changes = loadFormChanges(presence)
  const speciesCsv = new Map(csv.table('pokemon_species').map((r) => [int(r.id, 'pokemon_species.id'), r]))
  for (let s = 1; s <= 1025; s++) assert(speciesCsv.has(s), `pokemon_species has no row for ${s}`)
  const evolvesFrom = new Map<number, number>()
  for (const [id, r] of speciesCsv) if (r.evolves_from_species_id !== '') evolvesFrom.set(id, int(r.evolves_from_species_id, 'evolves_from_species_id'))
  const graph = new EvolutionGraph(evolutions, evolvesFrom)

  // --- rows ----------------------------------------------------------------------------------
  const locations = new LocationNames(pk.locations)
  const places = new PokeapiPlaces(csv, mapping)
  // Sentinel form indices (random form, regional pattern) are not in forms.json: the species decides.
  const genderless = (s: number, f: number): boolean => {
    const forms = pk.forms.rows[s - 1]?.forms ?? fail(`forms.json has no species ${s}`)
    return (forms[f] ?? forms[0]).gr === 255
  }
  const builder = new RowBuilder({
    pk, locations, places, presence, classes, speciesName, evolutions, genderless,
    generationOf: (s) => int(speciesCsv.get(s)!.generation_id, 'generation_id')
  })
  const encounterDrafts = builder.build()
  const events = buildEventDrafts({ pk, genderless, formName: (s, f) => formNames.get(sf(s, f))?.full ?? fail(`Event for unknown form ${s}-${f}`) })

  const goForms = new Map<number, 1 | 2>()
  const goDrafts: RowDraft[] = []
  for (const row of pk.go) {
    const key = sf(row.s, row.f)
    if (!mapping.forms.has(key)) fail(`go.json lists unknown form ${row.s}-${row.f}`)
    const shiny = Boolean(row.home?.shiny || row.lgpe?.shiny)
    goForms.set(key, shiny ? 2 : 1)
    const d: RowDraft = { s: row.s, f: row.f, game: GO_IDX, k: 'wild', m: 'Pokémon GO', lv: [1, 50], c: [], notes: [], via: 'go' }
    if (!shiny) d.sh = 'locked'
    goDrafts.push(d)
  }
  for (const extra of GO_ONLY) {
    const key = sf(extra.s, extra.f)
    if (!mapping.forms.has(key)) fail(`GO_ONLY lists unknown form ${extra.s}-${extra.f}`)
    if (goForms.has(key)) fail(`GO_ONLY entry ${describe(key)} is stale: PKHeX now has a Pokémon GO encounter for it`)
    goForms.set(key, extra.shiny ? 2 : 1)
    const d: RowDraft = { s: extra.s, f: extra.f, game: GO_IDX, k: 'wild', m: 'Pokémon GO', lv: [1, 50], c: [], notes: [GO_ONLY_NOTE], via: 'go' }
    if (!extra.shiny) d.sh = 'locked'
    goDrafts.push(d)
  }

  // A card lists every game of its generation that can redeem it; the form itself may be newer
  // than some of them (Partner Cap Pikachu exists in Ultra Sun / Ultra Moon only).
  const eventDrafts = events.drafts.filter((d) => presence[d.game].has(sf(d.s, d.f)))
  const eventsOutsidePresence = events.drafts.length - eventDrafts.length
  const allDrafts = [...encounterDrafts, ...eventDrafts, ...goDrafts]
  for (const d of allDrafts) {
    if (!mapping.forms.has(sf(d.s, d.f))) fail(`A row refers to unknown form ${d.s}-${d.f} (${GAMES[d.game].id}, ${d.k})`)
  }
  const { rows: finalRows, stats: mergeStats } = finalizeRows(allDrafts)
  const availability = computeAvailability({ rows: finalRows, evolutions, changes, eggs, goForms: new Set(goForms.keys()) })
  const evolveSources = buildEvolveSources({ evolutions: graph.edges, changes, availability, rows: finalRows, describe })

  // --- event category cross-check --------------------------------------------------------------
  // A cosmetic form whose only sources are events is an event form; curated ones stay as listed.
  const derivedEvent: string[] = []
  const curatedObtainable: string[] = []
  for (const [key, cls] of classes) {
    const id = `${sfSpecies(key)}-${sfForm(key)}`
    const obtain = (availability.obtain.get(key) ?? []).filter((g) => g !== GO_IDX)
    const distributed = (finalRows.get(key) ?? []).some((row) => isTimeLimited(row))
    if (CURATED_EVENT.has(id) && obtain.length > 0) curatedObtainable.push(`${describe(key)}: ${obtain.map((g) => GAME_IDS[g]).join(', ')}`)
    if (cls.cat === 'cosmetic' && obtain.length === 0 && !goForms.has(key) && distributed) {
      cls.cat = 'event'
      derivedEvent.push(describe(key))
    }
  }

  // --- species and forms -------------------------------------------------------------------------
  const pokemonTypes = new Map<number, TypeId[]>()
  const typeRows = [...csv.table('pokemon_types')].sort((a, b) => int(a.slot, 'slot') - int(b.slot, 'slot'))
  const typeName = (id: string, what: string): TypeId => TYPE_IDS[int(id, what) - 1] ?? fail(`${what}: unknown type id ${id}`)
  for (const r of typeRows) {
    const id = int(r.pokemon_id, 'pokemon_types.pokemon_id')
    const list = pokemonTypes.get(id) ?? []
    list.push(typeName(r.type_id, 'pokemon_types'))
    pokemonTypes.set(id, list)
  }
  const formTypes = new Map<number, TypeId[]>()
  for (const r of [...csv.table('pokemon_form_types')].sort((a, b) => int(a.slot, 'slot') - int(b.slot, 'slot'))) {
    // The ???-type Arceus row (type 10001) is not a form PKHeX has.
    if (int(r.type_id, 'pokemon_form_types.type_id') > TYPE_IDS.length) continue
    const id = int(r.pokemon_form_id, 'pokemon_form_types.pokemon_form_id')
    const list = formTypes.get(id) ?? []
    list.push(typeName(r.type_id, 'pokemon_form_types'))
    formTypes.set(id, list)
  }
  const typeDisagreements: string[] = []
  let typesFromPkhex = 0

  const flavor = loadFlavor(csv)
  const dexNumbers = loadDexNumbers(csv)
  const sizes = loadSizes(csv)
  const gamesOf = (set: Set<number>[], key: number): number[] => GAMES.map((_, i) => i).filter((i) => set[i].has(key))

  const summaries: SpeciesSummary[] = []
  const details: SpeciesDetail[] = []
  const rowsPerKind = new Map<string, number>()
  const rowsPerGame = new Map<number, number>()
  const placeless: string[] = []
  let totalRows = 0
  let totalForms = 0
  const notPresent: string[] = []

  for (const species of pk.forms.rows) {
    const s = species.s
    const sp = speciesCsv.get(s)!
    const names = speciesNames.get(s)!
    checkDisplayText(names.name, `species ${s} name`)
    checkDisplayText(names.genus, `species ${s} genus`)

    const forms: FormSummary[] = []
    const strings: string[] = []
    const stringIndex = new Map<string, number>()
    const speciesRows = new Map<number, FinalRow[]>()
    for (const form of species.forms) {
      const list = finalRows.get(sf(s, form.f)) ?? []
      speciesRows.set(form.f, list)
      for (const row of list) if (row.loc !== undefined) stringIndex.set(row.loc, -1)
    }
    for (const name of [...stringIndex.keys()].sort()) {
      checkDisplayText(name, `species ${s} location`)
      stringIndex.set(name, strings.length)
      strings.push(name)
    }

    const formDetails: Record<string, FormDetail> = {}
    for (const form of species.forms) {
      const key = sf(s, form.f)
      const mapped = mapping.forms.get(key)!
      const cls = classes.get(key)!
      const fn = formNames.get(key)!
      checkDisplayText(fn.full, `form ${s}-${form.f} full name`)
      checkDisplayText(fn.name, `form ${s}-${form.f} label`, true)

      const pkTypes = form.t.map((t) => t.toLowerCase())
      for (const t of pkTypes) assert(TYPE_SET.has(t), `forms.json: unknown type ${t} on ${s}-${form.f}`)
      let types: TypeId[] | undefined
      if (mapped.row) types = formTypes.get(mapped.row.id) ?? pokemonTypes.get(mapped.row.pokemonId)
      if (!types) {
        types = pkTypes as TypeId[]
        typesFromPkhex++
      } else if (types.join('/') !== pkTypes.join('/')) {
        typeDisagreements.push(`${fn.full} (${s}-${form.f}): PokeAPI ${types.join('/')}, PKHeX ${pkTypes.join('/')}`)
      }
      assert(types.length >= 1 && types.length <= 2, `${s}-${form.f} has ${types.length} types`)

      const present = gamesOf(presence, key)
      const obtain = availability.obtain.get(key) ?? []
      const event = availability.event.get(key) ?? []
      for (const g of [...obtain, ...event]) {
        if (g !== GO_IDX && !presence[g].has(key)) notPresent.push(`${fn.full} (${s}-${form.f}) has sources in ${GAME_IDS[g]} but is not present there`)
      }

      const summary: FormSummary = {
        f: form.f,
        name: fn.name,
        full: fn.full,
        cat: cls.cat,
        types,
        sprite: mapped.sprite,
        shiny: mapped.shiny,
        // For a gender form the female render is the other form, not a variant of this one.
        female: cls.gender ? false : mapped.female,
        present,
        obtain,
        event
      }
      if (cls.region) summary.region = cls.region
      if (mapped.approx) summary.approx = true
      if (mapped.gmax) summary.gmax = mapped.gmax
      if (cls.gender) summary.gender = cls.gender
      if (mapped.variants) summary.variants = mapped.variants
      const go = goForms.get(key)
      if (go) summary.go = go
      forms.push(orderFormSummary(summary))
      totalForms++

      const rows: EncounterRow[] = speciesRows.get(form.f)!.map((r) => {
        const row: EncounterRow = { g: r.g, k: r.k, lv: r.lv }
        if (r.m !== undefined) {
          checkDisplayText(r.m, `row method of ${s}-${form.f}`)
          row.m = r.m
        }
        if (r.loc !== undefined) row.l = stringIndex.get(r.loc)!
        if (r.c) {
          for (const c of r.c) checkDisplayText(c, `row condition of ${s}-${form.f}`)
          row.c = r.c
        }
        if (r.s) row.s = r.s
        if (r.b !== undefined) row.b = r.b
        if (r.d !== undefined) row.d = r.d
        if (r.n !== undefined) {
          checkDisplayText(r.n, `row note of ${s}-${form.f}`)
          row.n = r.n
        }
        if (r.via) row.via = r.via
        if (r.rf) row.rf = 1
        if (r.x) row.x = r.x
        return orderRow(row)
      })
      rows.sort((a, b) => compareRows(a, b, strings))
      for (const row of rows) {
        totalRows++
        rowsPerKind.set(row.k, (rowsPerKind.get(row.k) ?? 0) + 1)
        for (const g of row.g) rowsPerGame.set(g, (rowsPerGame.get(g) ?? 0) + 1)
        if (row.l === undefined && (row.k === 'gift' || row.k === 'static' || row.k === 'trade' || row.k === 'egg') && row.m !== 'Roaming') {
          placeless.push(`${row.g.map((g) => GAME_IDS[g]).join('/')} ${fn.full} ${row.k}${row.m ? ` (${row.m})` : ''}${row.n ? ` [${row.n}]` : ''}`)
        }
      }
      formDetails[String(form.f)] = { rows, evolve: evolveSources.get(key) ?? [], breed: availability.breed.get(key) ?? [] }
    }

    const basePokemon = mapping.forms.get(sf(s, 0))!.row?.pokemonId ?? fail(`Species ${s} has no base PokeAPI pokemon`)
    const size = sizes.get(basePokemon) ?? fail(`pokemon.csv has no row ${basePokemon}`)
    let genderRate = int(sp.gender_rate, 'gender_rate')
    assert(genderRate >= -1 && genderRate <= 8, `Species ${s} has gender rate ${genderRate}`)
    // PokeAPI gives Oinkologne its male form's ratio; a species whose forms are its genders has both.
    if (GENDER_FORM_SPECIES.has(s) && (genderRate === 0 || genderRate === 8)) genderRate = int(speciesCsv.get(evolvesFrom.get(s) ?? s)!.gender_rate, 'gender_rate')
    assert(!GENDER_FORM_SPECIES.has(s) || (genderRate > 0 && genderRate < 8), `Gender-form species ${s} has gender rate ${genderRate}`)
    summaries.push({
      id: s,
      slug: sp.identifier,
      name: names.name,
      genus: names.genus,
      gen: int(sp.generation_id, 'generation_id'),
      tags: speciesTags(s, sp),
      genderRate,
      genderDiff: sp.has_gender_differences === '1' && forms.some((f) => f.female),
      family: graph.family(s),
      forms
    })
    details.push({
      id: s,
      flavor: flavor.get(s)!,
      height: size.height,
      weight: size.weight,
      dex: dexNumbers.get(s) ?? {},
      strings,
      family: graph.familyNodes(s, (key) => classes.get(key)?.cat),
      forms: formDetails
    })
  }

  if (notPresent.length > 0) fail(`Forms with sources in games that do not contain them (${notPresent.length}):\n  ${notPresent.slice(0, 60).join('\n  ')}`)

  const gameBalls: number[][] = GAMES.map(() => [])
  for (const [code, balls] of Object.entries(pk.balls)) for (const game of idxOfCode(code)) gameBalls[game] = [...balls.wild].sort(cmpNum)

  const index: DexIndex = {
    meta: {
      builtAt: new Date().toISOString(),
      pkhexVersion: pk.meta.pkhexVersion,
      pokeapiCommit: POKEAPI_COMMIT,
      spritesCommit: SPRITES_COMMIT,
      counts: { species: summaries.length, forms: totalForms, rows: totalRows }
    },
    games: GAME_IDS,
    gameBalls,
    species: summaries
  }
  const written = writeDatasets(index, details)

  // --- report ----------------------------------------------------------------------------------
  section('Inputs')
  log(`  PKHeX ${pk.meta.pkhexVersion}; PokeAPI ${POKEAPI_COMMIT.slice(0, 10)}; sprites ${SPRITES_COMMIT.slice(0, 10)} (${manifest.size} HOME renders)`)
  log(`  CSV tables: ${[...csv.used].map(([name, source]) => `${name}${source === 'snapshot' ? ' (snapshot)' : ''}`).join(', ')}`)

  section('Form mapping')
  log(`  auto ${mapping.tally.auto}, alias ${mapping.tally.alias}, no PokeAPI row ${mapping.tally.none}, approximate sprite ${mapping.tally.approx}`)
  log(`  side tables: ${Object.entries(mapping.side).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  log(`  types: ${typesFromPkhex} forms fall back to PKHeX; ${typeDisagreements.length} PokeAPI / PKHeX disagreements`)
  for (const line of typeDisagreements.slice(0, 40)) log(`    ${line}`)

  section('Forms per category (report number in brackets)')
  const perCategory = countBy(classes.values(), (c) => c.cat)
  table(CATEGORY_ORDER.map((cat: FormCategory) => [cat, `${perCategory.get(cat) ?? 0} [${REPORT_CATEGORY_COUNTS[cat]}]`]))
  log(`  cosmetic forms reclassified as event because their only sources are events: ${derivedEvent.join('; ') || 'none'}`)
  log(`  curated event forms that some game hands out without an event:`)
  for (const line of curatedObtainable) log(`    ${line}`)

  section('Rows')
  log(`  extractor rows ${builder.stats.extractorRows} (${builder.stats.ignoredGameRows} for ignored games) -> drafts ${mergeStats.drafts} -> rows ${mergeStats.rows}`)
  log(`  Scarlet / Violet drafts dropped by the exclusives table: ${mergeStats.svDropped}`)
  log(`  crossover locations kept ${mergeStats.crossKept}, dropped ${mergeStats.crossDropped}; weather listed ${mergeStats.weatherListed}, dropped ${mergeStats.weatherDropped}; time listed ${mergeStats.timeListed}, dropped ${mergeStats.timeDropped}`)
  log(`  cosplay Pikachu rows folded: ${builder.stats.cosplayFolded}; event-locked encounters re-filed as events: ${builder.stats.eventItemRows}; hidden-form rows copied to the visible form: ${builder.stats.hiddenPatternCopies}`)
  const { dropped, relabelled } = builder.stats
  log(`  dropped as unreachable in that game: ${dropped.headbuttNoTree} Headbutt rows without a tree, ${dropped.fossil} fossil revivals, ${dropped.prize} Game Corner prizes, ${dropped.swarm} record-mixed swarms, ${dropped.unreachable} unused slots, ${dropped.otherVersion} legendary encounters of the other version`)
  log(`  relabelled: ${relabelled.prize} Game Corner prizes, ${relabelled.islandScan} Island Scan encounters, ${relabelled.swarmFishing} swarm fishing rows`)
  log('  per kind:')
  table(KIND_ORDER.map((k) => [k, rowsPerKind.get(k) ?? 0]), 6)
  log('  per game (a row counts once for each of its games):')
  table(GAMES.map((g, i) => [g.id, rowsPerGame.get(i) ?? 0]), 6)

  section('Events')
  log(`  ${events.stats.cards} Mystery Gift cards -> ${events.stats.cardDistributions} distributions (${events.stats.titled} with a readable title, ${events.stats.untitled} named after the Pokémon)`)
  log(`  ${events.stats.classicTemplates} Generation 1-3 event templates -> ${events.stats.classicDistributions} distributions`)
  log(`  event rows dropped because the game does not have the form: ${eventsOutsidePresence}; duplicate rows merged: ${events.stats.duplicatesMerged}`)

  section('Scarlet / Violet exclusives')
  const sv = checkSvExclusives(svSeed(pk), (key) => {
    const [s, f] = key.split('-').map(Number)
    return describe(sf(s, f))
  })
  log(`  list entries confirmed by the version-split data: ${sv.confirmed}; not covered by it: ${sv.unseeded}`)
  log(`  conflicts: ${sv.conflicts.length === 0 ? 'none' : ''}`)
  for (const line of sv.conflicts) log(`    ${line}`)
  log(`  split by the data but not listed: ${sv.unlisted.length === 0 ? 'none' : ''}`)
  for (const line of sv.unlisted) log(`    ${line}`)

  section('Places')
  const g1 = builder.stats.gen1
  log(`  Generation 1 curated rows: ${g1.curated}; PokeAPI agrees on ${g1.pokeapiAgree}, has nothing for ${g1.pokeapiSilent}, disagrees on ${g1.pokeapiDisagree.length}`)
  for (const line of g1.pokeapiDisagree) log(`    ${line}`)
  log(`  PokeAPI join for other location-less rows: ${places.stats.joined} placed, ${places.stats.curated} curated, ${places.stats.ambiguous} ambiguous, ${places.stats.missing} unknown`)
  log(`  PokeAPI place names used: ${[...places.usedNames].sort().join(', ')}`)
  log(`  Hidden Grotto rows placed on their route by PokeAPI: ${builder.stats.grottoes.placed}; grotto rows PokeAPI does not know (Funfest and Eevee-family grottoes): ${builder.stats.grottoes.unplaced}`)
  log(`  gift / static / trade / egg rows still without a place: ${placeless.length}`)
  for (const line of placeless) log(`    ${line}`)

  section('Evolutions')
  log(`  ${graph.edges.length} edge texts over ${GAMES.length} games; ${graph.classicCorrected} Generation 1 / 2 edges took their method from the Generation 3 tree`)
  log(`  form changes: ${changes.reduce((n, list) => n + list.filter((e) => e.forward).length, 0)} form-game pairs reachable by changing form`)

  section('Output')
  log(`  species ${summaries.length}, forms ${totalForms}, rows ${totalRows}`)
  log(`  dex.json ${formatBytes(written.dexBytes)}; species/*.json ${formatBytes(written.speciesBytes)} in ${details.length} files`)
  log(`  largest species files: ${written.largest.map((x) => `${x.id} ${speciesName(x.id)} ${formatBytes(x.bytes)}`).join(', ')}`)
  if (written.dexBytes > 1.5 * 1024 * 1024) fail(`dex.json is ${formatBytes(written.dexBytes)}, over the 1.5 MB budget`)
  log(`\nBuilt in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

/** What the extractor's version-split Scarlet / Violet data implies, for the exclusives cross-check. */
function svSeed(pk: ReturnType<typeof loadPkhex>): SvSeed {
  const sl = pk.encounters.games.indexOf('SL')
  const vl = pk.encounters.games.indexOf('VL')
  const hosts = new Map<string, { sl: boolean; vl: boolean }>()
  for (const r of pk.encounters.rows) {
    const split = r.k === 'tera' || r.src === 'Encounters9.StaticSL' || r.src === 'Encounters9.StaticVL'
    if (!split || (r.k !== 'tera' && r.k !== 'static')) continue
    const key = `${r.s}-${r.f}`
    const entry = hosts.get(key) ?? { sl: false, vl: false }
    if (r.g.includes(sl)) entry.sl = true
    if (r.g.includes(vl)) entry.vl = true
    hosts.set(key, entry)
  }
  const seed: SvSeed = { scarlet: new Set(), violet: new Set(), both: new Set() }
  for (const [key, e] of hosts) (e.sl && e.vl ? seed.both : e.sl ? seed.scarlet : seed.violet).add(key)
  return seed
}

/** Fixed key order, so the files diff cleanly between builds. */
function orderFormSummary(f: FormSummary): FormSummary {
  const out: FormSummary = { f: f.f, name: f.name, full: f.full, cat: f.cat, types: f.types, sprite: f.sprite, shiny: f.shiny, female: f.female, present: f.present, obtain: f.obtain, event: f.event }
  if (f.region) out.region = f.region
  if (f.approx) out.approx = f.approx
  if (f.gmax) out.gmax = f.gmax
  if (f.gender) out.gender = f.gender
  if (f.variants) out.variants = f.variants
  if (f.go) out.go = f.go
  return out
}

function orderRow(r: EncounterRow): EncounterRow {
  const out: EncounterRow = { g: r.g, k: r.k, lv: r.lv }
  if (r.m !== undefined) out.m = r.m
  if (r.l !== undefined) out.l = r.l
  if (r.c) out.c = r.c
  if (r.s) out.s = r.s
  if (r.b !== undefined) out.b = r.b
  if (r.d !== undefined) out.d = r.d
  if (r.n !== undefined) out.n = r.n
  if (r.via) out.via = r.via
  if (r.rf) out.rf = r.rf
  if (r.x) out.x = r.x
  return out
}

try {
  main()
} catch (error) {
  if (error instanceof BuildError) {
    console.error(`\nBUILD FAILED\n${error.message}`)
    process.exit(1)
  }
  throw error
}
