/**
 * Shapes of the static datasets the app loads. Produced by tools/build-data from PKHeX
 * (encounters, forms, presence, evolutions, eggs, balls, events) and PokeAPI (names, typing,
 * dex text, HOME sprite keys).
 *
 * Files (all under src/renderer/public/data/):
 *   dex.json              -> DexIndex        loaded once at startup
 *   species/<id>.json     -> SpeciesDetail   loaded on demand, one per national dex number
 *
 * Types only: this file must stay free of runtime code.
 */

export type TypeId =
  | 'normal' | 'fighting' | 'flying' | 'poison' | 'ground' | 'rock' | 'bug' | 'ghost' | 'steel'
  | 'fire' | 'water' | 'grass' | 'electric' | 'psychic' | 'ice' | 'dragon' | 'dark' | 'fairy' | 'stellar'

/** Index into `DexIndex.games`. */
export type GameIdx = number
/** Index into `SpeciesDetail.strings`. */
export type StrIdx = number

export type SpeciesTag =
  | 'legendary' | 'mythical' | 'baby' | 'starter' | 'fossil' | 'pseudo-legendary' | 'ultra-beast' | 'paradox'

/**
 * What kind of form this is. Drives which forms count toward the Living Dex (see `DexRules`).
 *
 * base        form 0 of the species
 * regional    Alolan / Galarian / Hisuian / Paldean
 * gender      the form *is* the gender (Meowstic, Indeedee, Basculegion, Oinkologne)
 * cosmetic    permanent look-only or fixed-at-capture forms (Unown, Vivillon, Flabébé, Minior cores,
 *             Alcremie creams, Shellos, Squawkabilly, Tatsugiri, Lycanroc, Toxtricity, Urshifu ...)
 * changeable  forms the player can switch freely (Arceus plates, Silvally, Rotom, Deoxys, Giratina,
 *             Shaymin, Furfrou trims, Oricorio, Hoopa, Genesect drives, Ogerpon masks ...)
 * fusion      Kyurem / Necrozma / Calyrex fusions
 * event       distribution-only or one-off forms (cap Pikachu, Spiky-eared Pichu, Eternal Floette,
 *             Battle Bond Greninja, Own Tempo Rockruff, Original Magearna, Dada Zarude, Fancy / Poké Ball Vivillon)
 * partner     Let's Go partner Pikachu / Eevee and ORAS cosplay Pikachu (locked to their game)
 * mega        Mega Evolutions and Primal Reversions (cannot sit in a box)
 * battle      other battle-only states and totems (cannot sit in a box)
 * hidden      forms never owned or with no visible difference (Lord/Lady, ride modes, Mothim cloaks,
 *             Scatterbug/Spewpa patterns, Eternamax, Terastallized Ogerpon). Never counted.
 */
export type FormCategory =
  | 'base' | 'regional' | 'gender' | 'cosmetic' | 'changeable' | 'fusion' | 'event' | 'partner'
  | 'mega' | 'battle' | 'hidden'

export type RegionalVariant = 'alola' | 'galar' | 'hisui' | 'paldea'

export interface DexMeta {
  /** ISO timestamp of the data build. */
  builtAt: string
  pkhexVersion: string
  pokeapiCommit: string
  spritesCommit: string
  counts: { species: number; forms: number; rows: number }
}

export interface DexIndex {
  meta: DexMeta
  /** `GameDef.id` values, in the order every `GameIdx` in the datasets refers to. */
  games: string[]
  /** gameBalls[GameIdx] = PKHeX Ball ids usable for an ordinary wild capture in that game (empty if none). */
  gameBalls: number[][]
  /** National dex order; species[i].id === i + 1. */
  species: SpeciesSummary[]
}

export interface SpeciesSummary {
  /** National dex number. The species' default HOME render is always `${id}`. */
  id: number
  slug: string
  name: string
  /** e.g. "Mouse Pokémon". */
  genus: string
  /** Generation the species debuted in (1-9). */
  gen: number
  tags: SpeciesTag[]
  /** Female eighths: -1 genderless, 0 male only, 8 female only. */
  genderRate: number
  /** Males and females look different (a separate female HOME render exists for some forms). */
  genderDiff: boolean
  /** Evolution family id, identical for every member of a family. */
  family: number
  /** Every form PKHeX knows, ordered by PKHeX form index; forms[0] is the base form. */
  forms: FormSummary[]
}

export interface FormSummary {
  /** PKHeX form index. Together with the species id this identifies the form everywhere. */
  f: number
  /** Form label on its own: "" for an unnamed base form, else "Alolan Form", "Bug", "B", "Heat Rotom" ... */
  name: string
  /** Full display name: "Raichu", "Alolan Raichu", "Unown B", "Arceus (Bug)". */
  full: string
  cat: FormCategory
  region?: RegionalVariant
  types: TypeId[]
  /** HOME render key (file name without extension), e.g. "25", "10100", "201-b". See shared/sprites.ts. */
  sprite: string
  /** `sprite` is a stand-in: HOME has no render of this exact form. */
  approx?: boolean
  /** A shiny render exists for `sprite`. */
  shiny: boolean
  /** A female render exists for `sprite`. */
  female: boolean
  /** HOME render key of the Gigantamax version, when this form can Gigantamax. */
  gmax?: string
  /** Gender implied by the form itself (category `gender`). */
  gender?: 'm' | 'f'
  /** Sub-variants stored outside the form index (Alcremie sweets). */
  variants?: FormVariant[]
  /** Games whose data contains this form (it can exist there, e.g. by transfer). Never lists
   *  Pokémon GO, HOME, Stadium or Box; GO availability is `go` plus GO's index in `obtain`. */
  present: GameIdx[]
  /** Games where it can be obtained without an event: caught, gifted, traded in-game, raided,
   *  evolved, bred, or reached by an in-game form change. */
  obtain: GameIdx[]
  /** Games where every source is time-limited: event distributions, event raids and outbreaks,
   *  or something that depends on one. Disjoint from `obtain`. */
  event: GameIdx[]
  /** Pokémon GO availability: 1 = available, 2 = available and can be shiny. Includes Pokémon
   *  that cannot leave GO. */
  go?: 1 | 2
}

export interface FormVariant {
  /** PKHeX form argument value. */
  id: number
  name: string
  sprite: string
  shiny: boolean
}

export interface SpeciesDetail {
  id: number
  /** One English Pokédex entry. */
  flavor: string
  /** Metres / kilograms of the base form. */
  height: number
  weight: number
  /** Regional dex numbers keyed by PokeAPI pokedex identifier ("kanto", "paldea", ...). */
  dex: Record<string, number>
  /** String table for location names. */
  strings: string[]
  /** Evolution family for display, base stage first. */
  family: FamilyNode[]
  /** Keyed by PKHeX form index (as a string). Every form in `SpeciesSummary.forms` has an entry. */
  forms: Record<string, FormDetail>
}

export interface FamilyNode {
  s: number
  f: number
  /** [species, form] this node evolves from; absent for the base stage. */
  from?: [number, number]
  /** How, in the most recent game that has the evolution: "Level 16", "Use Thunder Stone" ... */
  how?: string
}

export interface FormDetail {
  /** Direct sources of exactly this species + form. */
  rows: EncounterRow[]
  /** Ways to get this form by evolving another one. */
  evolve: EvolveSource[]
  /** Games where this form hatches from an egg (a parent may still have to be transferred in). */
  breed: GameIdx[]
}

/**
 * A way to reach a form from another one. When `from` is a different species this is an
 * evolution; when it is the same species it is an in-game form change and `how` starts with
 * "Change form: " or "Fuse with ".
 */
export interface EvolveSource {
  /** [species, form] to start from. */
  from: [number, number]
  /** Human-readable method as it works in the games listed in `g`. */
  how: string
  g: GameIdx[]
}

export type EncounterKind =
  | 'wild'      // ordinary wild encounter: grass, cave, surfing, fishing, headbutt, horde, SOS, outbreak slots ...
  | 'static'    // fixed overworld / scripted battle
  | 'gift'      // handed to the player in-game (starters, fossils, NPC gifts)
  | 'egg'       // gift egg
  | 'trade'     // in-game NPC trade
  | 'raid'      // Max Raid dens, event dens, Dynamax Adventures
  | 'tera'      // Tera Raid Battles (stock, event, 7-star)
  | 'outbreak'  // event mass outbreaks (Scarlet / Violet)
  | 'shadow'    // Colosseum / XD Shadow Pokémon
  | 'walker'    // Pokéwalker
  | 'dream'     // Dream World / Entree Forest / Dream Radar
  | 'event'     // real-world distribution (Mystery Gift, wonder card, Gen 1-3 events)

/** Side product an encounter is delivered through; shown as an extra source badge. */
export type SourceVia = 'stadium' | 'stadium2' | 'boxrubysapphire' | 'colosseum' | 'xd' | 'ranch' | 'ereader' | 'ranger' | 'home' | 'go'

/** One way of obtaining a form. Short keys: there are tens of thousands of these. */
export interface EncounterRow {
  /** Games the row applies to. */
  g: GameIdx[]
  k: EncounterKind
  /** Method / sub-type label: "Tall grass", "Surfing", "Old Rod", "Headbutt", "Horde", "SOS call",
   *  "Friend Safari", "Hidden Grotto", "Mass Outbreak", "5★ Tera Raid", "Dynamax Adventure" ... */
  m?: string
  /** Location name. Absent when the source has no place (most events, some Gen 1 gifts). */
  l?: StrIdx
  /** Level range [min, max]; [0, 0] when unknown. */
  lv: [number, number]
  /** Extra conditions worth showing: "Morning", "Night", "Rain", "Alpha", "Poké Radar", "Swarm" ... */
  c?: string[]
  /** Shiny state when it is not the normal random chance. */
  s?: 'locked' | 'forced'
  /** Fixed ball (PKHeX Ball id) when the player has no choice. */
  b?: number
  /** Fixed gender: 0 male, 1 female, 2 genderless. */
  d?: 0 | 1 | 2
  /** Free-text note: trade nickname, gift / event title, "Gigantamax", "Hidden Ability" ... */
  n?: string
  via?: SourceVia
  /** The game picks the form at random or by save region (Unown letter, Minior core, Vivillon pattern). */
  rf?: 1
  /** Event details. */
  x?: EventInfo
}

export interface EventInfo {
  /** Original Trainer name on the distributed Pokémon. */
  ot?: string
  /** Distribution window, ISO dates, when known. */
  from?: string
  to?: string
  /** Wonder card id, when there is one. */
  id?: number
}
