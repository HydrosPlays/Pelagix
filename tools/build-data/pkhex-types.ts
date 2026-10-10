/** Shapes of the extractor output in data/pkhex (see tools/extractor/SCHEMA.md). Types only. */

export type Pair = [number, number]

export interface PkConditions {
  time?: string[]
  weather?: string[]
  shakingTrees?: true
  fishing?: true
  curry?: true
  radar?: true
  swarm?: true
  safari?: true
  marsh?: true
  bugContest?: true
  honeyTree?: true
  headbutt?: true
  headbuttSpecial?: true
  /** Headbutt slot PKHeX's own tree table makes unreachable for every Trainer ID. */
  noTree?: true
  feebasTiles?: true
  hiddenGrotto?: true
  horde?: true
  friendSafari?: true
  dexNav?: true
  sos?: true
  pelago?: true
  totem?: true
  roaming?: true
  alpha?: 'always' | 'random'
  underground?: true
  rank?: [number, number]
  nest?: number
  dynamaxLevel?: number
  gmax?: true
  distIndex?: number
  stars?: number
  teraType?: string
  map?: 'Paldea' | 'Kitakami' | 'Blueberry'
  host?: string[]
  mark?: string
  titan?: true
  rideLegend?: true
  hyperspace?: true
  course?: string
  courseId?: number
  promotion?: string
  shadowId?: number
  gauge?: number
  eReader?: true
  pokeSpot?: 'Rock' | 'Oasis' | 'Cave'
  starterPikachu?: true
  oddEgg?: true
  evolveOnTrade?: true
  fateful?: true
  language?: string
  originGame?: string
  bonusDisc?: string
}

export interface PkEncounter {
  g: number[]
  s: number
  f: number
  l: Pair
  ls?: Pair[]
  k: string
  t: string
  src: string
  m?: string
  x: string
  L?: number[]
  A?: number[]
  e?: 1
  h?: 'Never' | 'Always' | 'FixedValue'
  b?: number
  d?: 0 | 1 | 2
  c?: PkConditions
  egg?: 1
  nick?: string
  tr?: string
  dist?: string
  ot?: string
  ots?: string[]
  label: string
  n: number
}

export interface PkEncounterFile {
  games: string[]
  rows: PkEncounter[]
}

export interface PkGift {
  type: string
  id: number
  title: string
  s: number
  f: number
  lv: number
  games: string[]
  h?: 'Never' | 'Always' | 'AlwaysStar' | 'AlwaysSquare'
  b: number
  d?: 0 | 1 | 2
  egg?: 1
  fateful?: 1
  ot?: string
  /** PKHeX LanguageID name of the card (Generation 4 / 5 cards, a few later ones); absent = unknown. */
  lang?: string
  home?: 1
  origin?: string
  date?: string
  from?: string
  to?: string
  x: string
  loc?: number
  locName?: string
  eggLoc?: number
  eggLocName?: string
  n: number
}

export interface PkGoSummary {
  n: number
  shiny?: 1
  from?: string
  to?: string
  types: string[]
  lvMin: number
  fmt?: string
}

export interface PkGoRow {
  s: number
  f: number
  home?: PkGoSummary
  lgpe?: PkGoSummary
}

export interface PkFormName {
  n: string
  ctx: string[]
}

export interface PkForm {
  f: number
  names: PkFormName[]
  mega?: 1
  primal?: 1
  battleOnly?: string[]
  outOfBattle?: number
  outOfBattleIn?: Record<string, number>
  fused?: 1
  totem?: 1
  lord?: 1
  changeable?: 1
  changeableIn?: string[]
  untradable?: 1
  gmax?: 1
  pt: string
  ptBase?: 1
  gr: number
  t: string[]
}

export interface PkFormSpecies {
  s: number
  forms: PkForm[]
  formArgs?: string[]
}

export interface PkFormsFile {
  contexts: string[]
  rows: PkFormSpecies[]
}

export interface PkEvolution {
  from: Pair
  to: Pair
  m: string
  id: number
  lv: number
  up: number
  arg: number
  argKind?: 'item' | 'move' | 'species' | 'type' | 'version' | 'count'
  argName?: string
}

export interface PkBalls {
  wild: number[]
  fixed: number[]
  gift: number[]
}

export interface PkMeta {
  schema: number
  pkhexVersion: string
  language: string
  games: { code: string; generation: number; context: string }[]
}

export interface PkStrings {
  species: string[]
  types: string[]
  balls: string[]
  games: Record<string, string>
}

export type PkLocations = Record<string, Record<string, string>>

/** localized.json: one entry per language id, every table indexed like its English counterpart. */
export interface PkLocalizedLanguage {
  species: string[]
  types: string[]
  abilities: string[]
  balls: string[]
  games: Record<string, string>
  items: string[]
  moves: string[]
  /** Species -> primary name of every form index (forms.json `names[0].n` in this language). */
  forms: Record<string, string[]>
  locations: PkLocations
}

export type PkLocalized = Record<string, PkLocalizedLanguage>
