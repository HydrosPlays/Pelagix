/**
 * What "Import from ShinyDex" hands to the page: the shinies of a ShinyDex export file (JSON), or
 * those listed on a History page of shinydex.com that the user saved from the browser, as read by
 * src/main/shinydex.ts. A row of a saved page is ShinyDex's own wording (names, file-name slugs,
 * method text); an entry of an export names its Pokémon by number (`known`). The page maps both to
 * the datasets.
 *
 * Types only. Erasable-syntax only (see games.ts).
 */

/**
 * What only an entry of an export file says. Checked for type and size, not for meaning: whether
 * the numbers name a Pokémon or a ball the app knows is for the page to say.
 */
export interface ShinyDexKnown {
  /** National Pokédex number. */
  species: number
  /** Form index within the species. */
  form: number
  shiny: boolean
  /** The file's own kind ("wild", "gift" ...); empty when it has none. */
  kind: string
  location?: string
  /** Ball id. */
  ball?: number
  level?: number
  ot?: string
  nickname?: string
  /** Species and form it evolved from. */
  origin?: [number, number]
}

export interface ShinyDexRow {
  /** 0-based position in the file; on a page newest first, as ShinyDex lists them. */
  index: number
  /** The Pokémon's name as shown: "Cleffa", "Galarian Meowth". Empty in an export. */
  name: string
  /**
   * File name of its picture without extension, lower case: "cleffa", "meowth-galarian",
   * "hippowdon-f". Empty when the picture had not loaded when the page was saved.
   */
  pokemon: string
  /** File name of the game icon without extension, or the export's game: "firered", "za". */
  game: string
  /** The method as shown: "Random Encounters", "Masuda Method". Can be empty in an export. */
  method: string
  /** ISO yyyy-mm-dd; null when the date was not understood. */
  date: string | null
  /** File name of the ball picture without extension: "nestBall". Empty when there is none. */
  ball: string
  /** Only on an entry of an export file. */
  known?: ShinyDexKnown
}

export interface ShinyDexHistory {
  /** Name of the chosen file, without its folder. */
  fileName: string
  /** Which of the two accepted files it was, decided from its content. */
  source: 'export' | 'page'
  /** In file order. */
  rows: ShinyDexRow[]
  /** Rows past the limit that were left out. */
  dropped: number
  /** Entries of an export without a usable Pokémon or game, left out. */
  unusable: number
}

/**
 * - `not-shinydex`: JSON without an `entries` list, or no history row was found in the file.
 * - `too-large`: the file is bigger than any export or saved page.
 * - `unreadable`: the file could not be opened or read.
 */
export type ShinyDexFailure = 'not-shinydex' | 'too-large' | 'unreadable'

export type ShinyDexResult = { ok: true; history: ShinyDexHistory } | { ok: false; reason: ShinyDexFailure }
