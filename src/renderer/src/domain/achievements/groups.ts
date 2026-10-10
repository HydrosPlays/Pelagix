/**
 * Curated groups of Pokémon, by national dex number, for the things the dataset has no field for.
 *
 * Groups the dataset can express are NOT here: starters, fossils, babies, Legendary and Mythical
 * Pokémon, pseudo-legendaries, Ultra Beasts and Paradox Pokémon come from `SpeciesSummary.tags`,
 * the Eeveelutions from Eevee's evolution family (see facts.ts). Everything in this file is
 * checked against the real dataset by groups.test.ts, name by name.
 */

import type { FormCategory } from '@shared/dex-types'

export interface SpeciesGroup {
  /** Stable key; becomes part of an achievement id. Never rename. */
  key: string
  /** National dex numbers. */
  species: readonly number[]
}

// ---------------------------------------------------------------- legendary groups

/** Articuno, Zapdos, Moltres. */
export const LEGENDARY_BIRDS: readonly number[] = [144, 145, 146]
/** Raikou, Entei, Suicune. */
export const LEGENDARY_BEASTS: readonly number[] = [243, 244, 245]
/** Lugia, Ho-Oh. */
export const TOWER_DUO: readonly number[] = [249, 250]
/** Regirock, Regice, Registeel, Regigigas, Regieleki, Regidrago. */
export const LEGENDARY_TITANS: readonly number[] = [377, 378, 379, 486, 894, 895]
/** Latias, Latios. */
export const EON_DUO: readonly number[] = [380, 381]
/** Kyogre, Groudon, Rayquaza. */
export const WEATHER_TRIO: readonly number[] = [382, 383, 384]
/** Uxie, Mesprit, Azelf. */
export const LAKE_GUARDIANS: readonly number[] = [480, 481, 482]
/** Dialga, Palkia, Giratina. */
export const CREATION_TRIO: readonly number[] = [483, 484, 487]
/** Cobalion, Terrakion, Virizion, Keldeo. */
export const SWORDS_OF_JUSTICE: readonly number[] = [638, 639, 640, 647]
/** Tornadus, Thundurus, Landorus, Enamorus. */
export const FORCES_OF_NATURE: readonly number[] = [641, 642, 645, 905]
/** Reshiram, Zekrom, Kyurem. */
export const TAO_TRIO: readonly number[] = [643, 644, 646]
/** Xerneas, Yveltal, Zygarde. */
export const AURA_TRIO: readonly number[] = [716, 717, 718]
/** Tapu Koko, Tapu Lele, Tapu Bulu, Tapu Fini. */
export const GUARDIAN_DEITIES: readonly number[] = [785, 786, 787, 788]
/** Solgaleo, Lunala, Necrozma. */
export const LIGHT_TRIO: readonly number[] = [791, 792, 800]
/** Zacian, Zamazenta. */
export const HERO_DUO: readonly number[] = [888, 889]
/** Wo-Chien, Chien-Pao, Ting-Lu, Chi-Yu. */
export const TREASURES_OF_RUIN: readonly number[] = [1001, 1002, 1003, 1004]
/** Okidogi, Munkidori, Fezandipiti. */
export const LOYAL_THREE: readonly number[] = [1014, 1015, 1016]

/**
 * The Legendary Pokémon on the boxes of the main-series games: Lugia, Ho-Oh, Kyogre, Groudon,
 * Rayquaza, Dialga, Palkia, Giratina, Reshiram, Zekrom, Kyurem, Xerneas, Yveltal, Solgaleo,
 * Lunala, Necrozma, Zacian, Zamazenta, Koraidon, Miraidon.
 */
export const BOX_LEGENDARIES: readonly number[] = [249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 646, 716, 717, 791, 792, 800, 888, 889, 1007, 1008]

// ---------------------------------------------------------------- paradox Pokémon

/** Great Tusk, Scream Tail, Brute Bonnet, Flutter Mane, Slither Wing, Sandy Shocks, Roaring Moon, Walking Wake, Gouging Fire, Raging Bolt. */
export const PARADOX_ANCIENT: readonly number[] = [984, 985, 986, 987, 988, 989, 1005, 1009, 1020, 1021]
/** Iron Treads, Iron Bundle, Iron Hands, Iron Jugulis, Iron Moth, Iron Thorns, Iron Valiant, Iron Leaves, Iron Boulder, Iron Crown. */
export const PARADOX_FUTURE: readonly number[] = [990, 991, 992, 993, 994, 995, 1006, 1010, 1022, 1023]

// ---------------------------------------------------------------- lists used by secret achievements

/** Eevee: its evolution family is the Eeveelutions. */
export const EEVEE = 133
export const PIKACHU = 25
export const MAGIKARP = 129
export const MEW = 151
/** Cleffa, Clefairy, Clefable. */
export const CLEFAIRY_LINE: readonly number[] = [173, 35, 36]
/** Munchlax, Snorlax. */
export const SNORLAX_LINE: readonly number[] = [446, 143]
/** The rare Safari Zone encounters of Kanto: Chansey, Kangaskhan, Scyther, Pinsir, Tauros, Dratini. */
export const SAFARI_ZONE_RARITIES: readonly number[] = [113, 115, 123, 127, 128, 147]

/**
 * The Pokémon everyone meets on the first routes, one or two per region: Caterpie, Weedle, Pidgey,
 * Rattata, Spearow, Zubat, Magikarp, Sentret, Hoothoot, Ledyba, Spinarak, Poochyena, Zigzagoon,
 * Wurmple, Starly, Bidoof, Kricketot, Patrat, Lillipup, Pidove, Bunnelby, Fletchling, Scatterbug,
 * Pikipek, Yungoos, Grubbin, Skwovet, Rookidee, Blipbug, Lechonk, Tarountula.
 */
export const EARLY_ROUTE_COMMONS: readonly number[] = [
  10, 13, 16, 19, 21, 41, 129, 161, 163, 165, 167, 261, 263, 265, 396, 399, 401, 504, 506, 519, 659, 661, 664, 731, 734, 736, 819, 821, 824, 915, 917
]

// ---------------------------------------------------------------- form sets

export interface FormSetSpec {
  /** Stable key; becomes part of an achievement id. Never rename. */
  key: string
  /** National dex numbers whose forms make up the set. */
  species: readonly number[]
  /** Form categories that belong to the set. */
  cats: readonly FormCategory[]
}

/**
 * Form collections: every form of the listed species whose category is listed. The categories keep
 * battle-only states, Mega Evolutions, event forms and never-owned forms out of a set.
 */
export const FORM_SETS: readonly FormSetSpec[] = [
  { key: 'unown', species: [201], cats: ['base', 'cosmetic'] },
  { key: 'vivillon', species: [666], cats: ['base', 'cosmetic'] },
  { key: 'alcremie-creams', species: [869], cats: ['base', 'cosmetic'] },
  { key: 'arceus', species: [493], cats: ['base', 'changeable'] },
  { key: 'silvally', species: [773], cats: ['base', 'changeable'] },
  { key: 'rotom', species: [479], cats: ['changeable'] },
  { key: 'deoxys', species: [386], cats: ['base', 'changeable'] },
  { key: 'furfrou', species: [676], cats: ['changeable'] },
  { key: 'flabebe', species: [669, 670, 671], cats: ['base', 'cosmetic'] },
  { key: 'minior', species: [774], cats: ['cosmetic'] },
  { key: 'oricorio', species: [741], cats: ['base', 'changeable'] },
  { key: 'seasons', species: [585, 586], cats: ['base', 'changeable'] },
  { key: 'cloaks', species: [412, 413], cats: ['base', 'cosmetic', 'changeable'] },
  { key: 'sizes', species: [710, 711], cats: ['base', 'cosmetic'] },
  { key: 'seas', species: [422, 423], cats: ['base', 'cosmetic'] },
  { key: 'lycanroc', species: [745], cats: ['base', 'cosmetic'] },
  { key: 'squawkabilly', species: [931], cats: ['base', 'cosmetic'] },
  { key: 'tatsugiri', species: [978], cats: ['base', 'cosmetic'] },
  { key: 'ogerpon', species: [1017], cats: ['base', 'changeable'] },
  { key: 'genesect', species: [649], cats: ['changeable'] },
  { key: 'therian', species: [641, 642, 645, 905], cats: ['changeable'] },
  { key: 'pikachu-caps', species: [25], cats: ['event'] },
  { key: 'fusions', species: [646, 800, 898], cats: ['fusion'] }
]

/** The species whose sub-variants (cream and sweet combinations) form a set of their own: Alcremie. */
export const ALCREMIE = 869

// ---------------------------------------------------------------- generations

/** Region a generation's new Pokémon are named after: the stable key that is part of an achievement id. The words are in i18n/en/achievements.ts. */
export const GENERATION_REGIONS: Readonly<Record<number, { key: string }>> = {
  1: { key: 'kanto' },
  2: { key: 'johto' },
  3: { key: 'hoenn' },
  4: { key: 'sinnoh' },
  5: { key: 'unova' },
  6: { key: 'kalos' },
  7: { key: 'alola' },
  // Galar's generation also holds the Pokémon first discovered in Hisui.
  8: { key: 'galar' },
  9: { key: 'paldea' }
}
