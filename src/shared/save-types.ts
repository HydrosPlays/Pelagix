/**
 * The user's save file: every catch they have logged, their Living Dex rules, and unlocked
 * achievements. Stored as JSON (userData/save.json in Electron, localStorage in a browser).
 *
 * Types only, plus the defaults at the bottom. Erasable-syntax only (see games.ts).
 */

import type { EncounterKind } from './dex-types'

export const SAVE_VERSION = 1

export type EntryGender = 'm' | 'f' | 'n'

/** How the user got the Pokémon. Encounter kinds from the datasets plus the ones only a user can assert. */
export type EntryKind = EncounterKind | 'evolved' | 'bred' | 'transfer' | 'other'

/** Six values, one per stat, in the order HP, Attack, Defense, Sp. Atk, Sp. Def, Speed. */
export type StatSpread = [number, number, number, number, number, number]

export const PID_PATTERN = /^[0-9A-F]{8}$/
export const MAX_IV = 31
export const MAX_EV = 255

/** One logged Pokémon. A species/form may have any number of entries, across any games. */
export interface CatchEntry {
  id: string
  /** National dex number and PKHeX form index of the Pokémon as it is now. */
  species: number
  form: number
  /** Sub-variant (`FormVariant.id`), e.g. Alcremie sweet. */
  variant?: number
  gender?: EntryGender
  shiny: boolean
  gmax?: boolean
  alpha?: boolean
  /** `GameDef.id` of the game it was obtained in. */
  game: string
  kind: EntryKind
  /** Method label as shown when it was logged ("Tall grass", "Gift", "5★ Tera Raid" ...). */
  method?: string
  /** Location name as shown when it was logged, or whatever the user typed. */
  location?: string
  /** [species, form] it was originally obtained as, when it has since evolved. */
  origin?: [number, number]
  /** PKHeX Ball id. */
  ball?: number
  level?: number
  /** Day it was obtained, ISO yyyy-mm-dd. */
  date?: string
  nickname?: string
  /** Original Trainer name. */
  ot?: string
  notes?: string
  /** PKHeX ability id, one of `ABILITIES` (abilities.ts). */
  ability?: number
  /** It is the Pokémon's Hidden Ability. Only with `ability`, and only ever `true`. */
  abilityHidden?: true
  /** Personality value: exactly 8 uppercase hex digits. */
  pid?: string
  /** Individual values, 0 to 31 each. */
  ivs?: StatSpread
  /** Effort values, 0 to 255 each. */
  evs?: StatSpread
  /**
   * Set on entries made by "Import from a game save": the reader's fingerprint of that Pokémon
   * (`GameSavePokemon.fingerprint`), so the same Pokémon is not imported twice. Never shown.
   */
  fingerprint?: string
  createdAt: string
  updatedAt: string
}

/**
 * Which forms get their own Living Dex slot. Base forms always do. An entry whose own slot is
 * switched off counts toward the species' base slot instead.
 */
export interface DexRules {
  regional: boolean
  /** Meowstic, Indeedee, Basculegion, Oinkologne ♂ / ♀. */
  genderForms: boolean
  /** Separate ♂ and ♀ slots for species whose genders look different. */
  genderDiffs: boolean
  cosmetic: boolean
  changeable: boolean
  /** Forms kept only while holding an item: Arceus plates, Silvally memories, Genesect drives, Ogerpon masks, the Origin Formes. */
  heldItem: boolean
  fusion: boolean
  event: boolean
  partner: boolean
  /** All 63 Alcremie cream × sweet combinations instead of the 9 creams. */
  alcremieSweets: boolean
  /** Mega Evolutions and Primal Reversions. */
  mega: boolean
  /** Other battle-only forms and totems. */
  battle: boolean
  /** A Gigantamax slot for every form that can Gigantamax. */
  gmax: boolean
}

export type ThemeId = 'dark' | 'light'

export interface AppSettings {
  rules: DexRules
  theme: ThemeId
  reduceMotion: boolean
  /** Shown on the trainer card and pre-filled as OT when logging. */
  trainerName: string
}

export interface SaveFile {
  version: number
  entries: CatchEntry[]
  settings: AppSettings
  /** Achievement id -> ISO timestamp it was unlocked. */
  achievements: Record<string, string>
  createdAt: string
  updatedAt: string
}

export const DEFAULT_RULES: DexRules = {
  regional: true,
  genderForms: true,
  genderDiffs: true,
  cosmetic: true,
  changeable: true,
  heldItem: true,
  fusion: false,
  event: false,
  partner: false,
  alcremieSweets: false,
  mega: false,
  battle: false,
  gmax: false
}

export const DEFAULT_SETTINGS: AppSettings = {
  rules: DEFAULT_RULES,
  theme: 'dark',
  reduceMotion: false,
  trainerName: ''
}

export function createEmptySave(now: string): SaveFile {
  return {
    version: SAVE_VERSION,
    entries: [],
    settings: { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_RULES } },
    achievements: {},
    createdAt: now,
    updatedAt: now
  }
}
