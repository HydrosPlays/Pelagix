/**
 * What "Import from a game save" hands to the page: the Pokémon found in a save file of a Pokémon
 * game, as read by the bundled reader (tools/save-reader, built on PKHeX.Core). Every number is
 * PKHeX's own (species, form index, ball id, location id, `GameVersion`), the same ones the
 * datasets were generated from.
 *
 * Types only. Erasable-syntax only (see games.ts).
 */

import type { EncounterKind } from './dex-types'
import type { EntryGender, StatSpread } from './save-types'

/** A PKHeX `GameVersion`: its number and its enum name ("SW", "HG", "RBY" ...). */
export interface PkhexVersion {
  id: number
  /**
   * Compare with `GameDef.pkhex`. Some values name no single game: the Game Boy formats only know
   * "RBY" and "GSC", Colosseum / XD Pokémon say "CXD", and an encounter can belong to a pair
   * ("RB", "GS", "FRLG", "SV" ...).
   */
  name: string
}

export interface GameSaveLocation {
  id: number
  /** English name from PKHeX's strings. */
  name: string
}

/**
 * The datasets' twelve kinds, plus two PKHeX can tell that have no dataset rows:
 * `bred` (an egg from the Day Care, a Nursery or a picnic) and `transfer` (a Virtual Console
 * Pokémon after Poké Transporter, whose Game Boy encounter is no longer known).
 */
export type GameSaveEncounterKind = EncounterKind | 'bred' | 'transfer'

/** The encounter PKHeX's legality analysis matched: how the Pokémon was first obtained. */
export interface GameSaveEncounter {
  kind: GameSaveEncounterKind
  /** The finer type behind `kind`, as tools/extractor names it: "max-lair", "pokewalker", "mystery", "go" ... */
  type: string
  /** What it was encountered as. Differs from the Pokémon's own species / form once it has evolved. */
  species: number
  form: number
  /** The game, or group of games, the encounter belongs to. */
  version: PkhexVersion
  /** The encounter's own location; null when it has none (most events, Generation 1 gifts). */
  location: GameSaveLocation | null
  levelMin: number
  levelMax: number
}

export interface GameSavePokemon {
  place: 'party' | 'box'
  /** 0-based box number; null in the party. */
  box: number | null
  /** The box's name in the save; null in the party. */
  boxName: string | null
  /** 0-based position in the party or the box. */
  slot: number
  /** National dex number and PKHeX form index of the Pokémon as it is now. */
  species: number
  form: number
  /** Sub-variant index (`FormVariant.id`, Alcremie's sweet); null for every other species. */
  formArgument: number | null
  gender: EntryGender
  shiny: boolean
  /** Can Gigantamax. */
  gmax: boolean
  alpha: boolean
  egg: boolean
  /** PKHeX Ball id; 0 when the format stores none (Generation 1 and 2). */
  ball: number
  /** The game it originates from. */
  version: PkhexVersion
  /** Null when the format stores none (Generation 1, Gold / Silver) and for an unhatched egg. */
  metLocation: GameSaveLocation | null
  /** Where the egg it hatched from was received; null when it did not hatch from one. */
  eggLocation: GameSaveLocation | null
  /** 0 when unknown. */
  metLevel: number
  /** ISO yyyy-mm-dd; null when the format stores none (before Generation 4). */
  metDate: string | null
  level: number
  /** Null unless it is nicknamed. */
  nickname: string | null
  /** Original Trainer name. */
  ot: string
  /** The "fateful encounter" flag, set on most event Pokémon. */
  fateful: boolean
  /** PKHeX found nothing illegal about it. */
  legal: boolean
  /** Null when PKHeX could not match an encounter. */
  encounter: GameSaveEncounter | null
  /** Personality value, 8 uppercase hex digits; null when the format has none (Generation 1 and 2). */
  pid: string | null
  /** 0 to 31 each; in the Game Boy formats the DVs (0 to 15, Special for both Sp. Atk and Sp. Def). Null when unreadable. */
  ivs: StatSpread | null
  /**
   * 0 to 255 each; null where the game trains stats on another scale (Game Boy stat experience,
   * Let's Go awakening values, Legends: Arceus effort levels).
   */
  evs: StatSpread | null
  /**
   * The same for the same Pokémon wherever it turns up: in this save again, or later in another
   * game it was moved to. Opaque; only ever compare it. tools/save-reader/Pokemon.cs says what
   * it survives.
   */
  fingerprint: string
}

export interface GameSaveInfo {
  /** PKHeX's class for the save ("SAV8SWSH"); for diagnostics, not for display. */
  type: string
  /** The game the save belongs to. May be a pair ("RB", "GS"): those saves do not say which. */
  version: PkhexVersion
  generation: number
  /** The player's name; may be empty. */
  trainer: string
  boxes: number
  boxSlots: number
}

export interface GameSaveContents {
  /** Name of the chosen file, without its folder. */
  fileName: string
  save: GameSaveInfo
  /** Party first, then the boxes in order. Eggs included. */
  pokemon: GameSavePokemon[]
  /** Records the reader reported that were left out because they did not pass validation. */
  dropped: number
}

/**
 * - `not-a-save`: PKHeX does not recognise the file as a save.
 * - `too-large`: the file is bigger than any save.
 * - `unreadable`: the file could not be opened or read.
 * - `reader-missing`: the reader program is not where it should be.
 * - `reader-failed`: the reader crashed or answered with something unexpected.
 * - `timed-out`: the reader did not finish in time.
 */
export type GameSaveFailure = 'not-a-save' | 'too-large' | 'unreadable' | 'reader-missing' | 'reader-failed' | 'timed-out'

export type GameSaveResult = { ok: true; contents: GameSaveContents } | { ok: false; reason: GameSaveFailure }
