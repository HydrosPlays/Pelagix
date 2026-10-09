/** Maps extractor game codes onto Pelagix game indices (positions in GAMES / DexIndex.games). */
import { GAMES } from '../../src/shared/games.ts'
import type { GameDef } from '../../src/shared/games.ts'
import { assert, fail, uniqSorted } from './util.ts'

export const GAME_IDS: string[] = GAMES.map((g) => g.id)

const INDEX_BY_ID = new Map(GAME_IDS.map((id, i) => [id, i]))

export function gameIdx(id: string): number {
  const i = INDEX_BY_ID.get(id)
  if (i === undefined) fail(`Unknown Pelagix game id "${id}"`)
  return i
}

export const gameDef = (idx: number): GameDef => GAMES[idx]

/** Extractor codes that have no Pelagix game and are dropped on purpose. */
export const IGNORED_CODES: ReadonlySet<string> = new Set(['BU'])

/** code -> every game index that uses that code's data (the game itself plus its `dataFrom` mirrors). */
const CODE_TO_IDX = new Map<string, number[]>()
for (const [i, g] of GAMES.entries()) {
  if (g.pkhex === null) continue
  assert(!CODE_TO_IDX.has(g.pkhex), `Two games claim PKHeX code ${g.pkhex}`)
  CODE_TO_IDX.set(g.pkhex, [i])
}
for (const [i, g] of GAMES.entries()) {
  if (!g.dataFrom) continue
  assert(g.pkhex === null, `${g.id} has both pkhex and dataFrom`)
  const source = GAMES[gameIdx(g.dataFrom)]
  assert(source.pkhex !== null, `${g.id} mirrors ${g.dataFrom}, which has no PKHeX data`)
  CODE_TO_IDX.get(source.pkhex)!.push(i)
}
for (const list of CODE_TO_IDX.values()) list.sort((a, b) => a - b)

/** Game indices for an extractor code; [] for ignored codes. Unknown codes abort the build. */
export function idxOfCode(code: string): number[] {
  if (IGNORED_CODES.has(code)) return []
  const list = CODE_TO_IDX.get(code)
  if (!list) fail(`Extractor game code "${code}" has no Pelagix game`)
  return list
}

export function idxOfCodes(codes: Iterable<string>): number[] {
  const out: number[] = []
  for (const code of codes) out.push(...idxOfCode(code))
  return uniqSorted(out)
}

/** Checks the extractor's game list against games.ts once, so a new PKHeX game cannot be missed. */
export function checkGameCodes(codes: string[]): void {
  for (const code of codes) idxOfCode(code)
  for (const code of CODE_TO_IDX.keys()) {
    assert(codes.includes(code), `games.ts expects PKHeX code ${code}, which the extract does not contain`)
  }
}

export const GO_IDX = gameIdx('go')
export const HOME_IDX = gameIdx('home')

/** Games whose rows come from their own PKHeX tables (not mirrors, not services without tables). */
export function hasOwnData(idx: number): boolean {
  return GAMES[idx].pkhex !== null
}

/** First / second version of a pair, for version-gated data (Cosmoem, Rockruff, SV exclusives). */
const FIRST_VERSIONS = new Set(['sun', 'ultrasun', 'sword', 'scarlet', 'letsgopikachu', 'brilliantdiamond'])
const SECOND_VERSIONS = new Set(['moon', 'ultramoon', 'shield', 'violet', 'letsgoeevee', 'shiningpearl'])

export function pairSlot(idx: number): 1 | 2 | 0 {
  const id = GAMES[idx].id
  return FIRST_VERSIONS.has(id) ? 1 : SECOND_VERSIONS.has(id) ? 2 : 0
}
