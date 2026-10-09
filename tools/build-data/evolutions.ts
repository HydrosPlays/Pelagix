/**
 * Evolution edges per game, their rendering as English text, the per-form "evolve from" lists
 * and the display family of each species.
 */
import type { FamilyNode, FormCategory } from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import type { GameDef } from '../../src/shared/games.ts'
import { gameIdx, idxOfCode, pairSlot } from './game-map.ts'
import type { PkEvolution } from './pkhex-types.ts'
import { svEvolutionExclusive } from './sv-exclusives.ts'
import { article, assert, cmpNum, fail, sf, sfForm, sfSpecies } from './util.ts'

/** Games with a way to raise Beauty (Pokéblocks, Poffins, or Johto's haircuts and massages). */
const BEAUTY_GROUPS: ReadonlySet<string> = new Set(['rs', 'emerald', 'dp', 'platinum', 'hgss', 'oras', 'bdsp'])

/** Evolutions one particular game cannot perform: [game, from species, to species]. */
const IMPOSSIBLE_IN: readonly (readonly [string, number, number])[] = [
  ['yellow', 25, 26], // Yellow's only Pikachu is the partner, which refuses the Thunder Stone
  ['shield', 840, 841], // Tart Apples are found in Sword only
  ['sword', 840, 842] // Sweet Apples are found in Shield only
]

/**
 * Evolution methods a game's data keeps although the game cannot carry them out. PKHeX's trees
 * are per generation and built for legality ("could this have evolved somewhere?"), so they do not
 * know that HeartGold / SoulSilver have no Moss Rock, that FireRed / LeafGreen have no clock, or
 * that Yellow's partner refuses the Thunder Stone.
 */
function cannotHappen(e: PkEvolution, game: GameDef): boolean {
  switch (e.m) {
    // No magnetic field area, Moss Rock or Ice Rock in Johto and Kanto.
    case 'LevelUpElectric':
    case 'LevelUpForest':
    case 'LevelUpCold':
      return game.group === 'hgss'
    // No clock. (XD's Eevee takes a Sun or Moon Shard instead; see describeEvolution.)
    case 'LevelUpFriendshipMorning':
    case 'LevelUpFriendshipNight':
      return game.group === 'frlg' || game.id === 'colosseum'
    // Beauty cannot be raised: Feebas only evolves by the Prism Scale trade there (or not at all).
    case 'LevelUpBeauty':
      return !BEAUTY_GROUPS.has(game.group)
    // The Towers of Two Fists stand on Galar's Isle of Armor; later games use the scrolls.
    case 'TowerOfDarkness':
    case 'TowerOfWaters':
      return e.argKind !== 'item' && game.group !== 'swsh'
    default:
      return IMPOSSIBLE_IN.some(([id, from, to]) => id === game.id && from === e.from[0] && to === e.to[0])
  }
}

const FIRST_VERSION_CODES: ReadonlySet<string> = new Set(['SN', 'US', 'SW', 'SL'])
const SECOND_VERSION_CODES: ReadonlySet<string> = new Set(['MN', 'UM', 'SH', 'VL'])

/**
 * Evolution edges per game index. PKHeX's lists are per context; this applies what differs per
 * version: version-gated edges (Cosmoem, Rockruff), Ultra Space evolutions (the Generation 7 tree
 * is Ultra Sun / Ultra Moon's, Sun / Moon have no Ultra Space) and Charcadet's version-bound armor.
 */
export function loadEvolutions(byCode: Record<string, PkEvolution[]>, presence: Set<number>[]): PkEvolution[][] {
  const out: PkEvolution[][] = GAMES.map(() => [])
  for (const [code, edges] of Object.entries(byCode)) {
    for (const game of idxOfCode(code)) {
      const id = GAMES[game].id
      const slot = pairSlot(game)
      const present = presence[game]
      out[game] = edges.filter((e) => {
        if (!present.has(sf(e.from[0], e.from[1])) || !present.has(sf(e.to[0], e.to[1]))) return false
        if (cannotHappen(e, GAMES[game])) return false
        if ((e.m === 'LevelUpWormhole' || e.m === 'UseItemWormhole') && (id === 'sun' || id === 'moon')) return false
        if (e.argKind === 'version') {
          const first = FIRST_VERSION_CODES.has(e.argName ?? '')
          const second = SECOND_VERSION_CODES.has(e.argName ?? '')
          if (!first && !second) fail(`Version-gated evolution with unknown version "${e.argName}" in ${code}`)
          if (slot === 0) fail(`Version-gated evolution ${e.from} -> ${e.to} in unpaired game ${id}`)
          return first ? slot === 1 : slot === 2
        }
        if (GAMES[game].group === 'sv') {
          const only = svEvolutionExclusive(e.from[0], e.to[0])
          if (only && only !== id) return false
        }
        return true
      })
      // Outside Alola the "level up at the summit" method is a leftover next to the real one (Ice Stone).
      out[game] = out[game].filter((e) => {
        if (e.m !== 'LevelUpSummit' || GAMES[game].generation === 7) return true
        return !out[game].some((o) => o !== e && o.from[0] === e.from[0] && o.from[1] === e.from[1] && o.to[0] === e.to[0] && o.to[1] === e.to[1])
      })
    }
  }
  return out
}

/** Evolutions PKHeX has no tree for: Pokémon GO is the only place Meltan evolves. */
const EXTRA_EDGES: readonly { from: [number, number]; to: [number, number]; game: string; how: string }[] = [
  { from: [808, 0], to: [809, 0], game: 'go', how: 'Use 400 Meltan Candy' }
]

const NUMBER_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' }

function withArticle(name: string): string {
  return `${article(name)} ${name}`
}

/** Item names of the Generation 2 / 3 string tables, written the way later games write them. */
const ITEM_SPELLING: Readonly<Record<string, string>> = { DeepSeaScale: 'Deep Sea Scale', DeepSeaTooth: 'Deep Sea Tooth' }

function argumentName(name: string): string {
  return (ITEM_SPELLING[name] ?? name).replace(/[’‘]/g, "'")
}

/** Renders one evolution method as natural English, for one game. */
export function describeEvolution(e: PkEvolution, game: number): string {
  const { generation, group } = GAMES[game]
  // Legends games evolve from the menu once the condition is met; nothing levels up.
  const lu = e.up ? 'Level up' : 'Evolve'
  const level = e.lv > 0 ? `Level ${e.lv}` : lu
  const arg = (kind: PkEvolution['argKind']): string => {
    if (e.argKind !== kind || !e.argName) fail(`Evolution ${e.m} ${e.from} -> ${e.to} lacks its ${kind} argument`)
    return argumentName(e.argName)
  }
  const count = (): number => {
    if (e.argKind !== 'count') fail(`Evolution ${e.m} ${e.from} -> ${e.to} lacks its count argument`)
    return e.arg
  }
  const only = (species: number): void => assert(e.from[0] === species, `Evolution method ${e.m} is now also used by species ${e.from[0]}`)
  const xd = GAMES[game].id === 'xd'

  switch (e.m) {
    case 'LevelUp':
      // Generation 6 hard-codes Sliggoo's rain check; its tree only stores the level.
      if (e.from[0] === 705 && e.to[0] === 706 && generation === 6) return `${level} while it is raining in the overworld`
      return level
    case 'LevelUpNinjask':
    case 'LevelUpVersion':
      return level
    case 'LevelUpFriendship': return `${lu} with high friendship`
    // XD has no clock: its Eevee is given a Sun Shard or a Moon Shard to use.
    case 'LevelUpFriendshipMorning':
      if (xd) only(133)
      return xd ? 'Use a Sun Shard' : `${lu} with high friendship during the day`
    case 'LevelUpFriendshipNight':
      if (xd) only(133)
      return xd ? 'Use a Moon Shard' : `${lu} with high friendship at night`
    case 'Trade': return 'Trade'
    case 'TradeHeldItem': return `Trade holding ${withArticle(arg('item'))}`
    case 'TradeShelmetKarrablast': return e.from[0] === 588 ? 'Trade for a Shelmet' : 'Trade for a Karrablast'
    case 'UseItem': return `Use ${withArticle(arg('item'))}`
    case 'UseItemMale': return `Use ${withArticle(arg('item'))} on a male`
    case 'UseItemFemale': return `Use ${withArticle(arg('item'))} on a female`
    case 'UseItemWormhole': return `Use ${withArticle(arg('item'))} in Ultra Space`
    case 'UseItemFullMoon': return `Use ${withArticle(arg('item'))} under a full moon`
    case 'LevelUpATK': return `${level} with Attack higher than Defense`
    case 'LevelUpAeqD': return `${level} with Attack equal to Defense`
    case 'LevelUpDEF': return `${level} with Defense higher than Attack`
    case 'LevelUpECl5':
    case 'LevelUpECgeq5': return `${level} (decided by its personality value)`
    case 'LevelUpShedinja': return `${level} with an empty party slot and a Poké Ball`
    case 'LevelUpBeauty': return `${lu} with high Beauty`
    case 'LevelUpHeldItemDay': return `${lu} holding ${withArticle(arg('item'))} during the day`
    case 'LevelUpHeldItemNight': return `${lu} holding ${withArticle(arg('item'))} at night`
    case 'LevelUpKnowMove': return `${lu} knowing ${arg('move')}`
    case 'LevelUpKnowMoveECElse':
    case 'LevelUpKnowMoveEC100': return `${lu} knowing ${arg('move')} (form decided by its personality value)`
    case 'LevelUpWithTeammate': return `${lu} with ${withArticle(arg('species'))} in the party`
    case 'LevelUpMale': return `${level} (male)`
    case 'LevelUpFemale':
    case 'LevelUpFormFemale1': return `${level} (female)`
    case 'LevelUpElectric': return `${lu} in a Magnetic Field area`
    case 'LevelUpForest': return `${lu} near a Moss Rock`
    case 'LevelUpCold': return `${lu} near an Ice Rock`
    case 'LevelUpInverted': return `${level} while holding the console upside down`
    case 'LevelUpAffection50MoveType':
      return `${lu} with high ${generation >= 8 ? 'friendship' : 'affection'} knowing ${withArticle(arg('type'))}-type move`
    case 'LevelUpMoveType':
      only(674)
      return `${level} with a Dark-type Pokémon in the party`
    case 'LevelUpWeather': return `${level} in rain or fog`
    case 'LevelUpMorning':
    case 'LevelUpVersionDay': return `${level} during the day`
    case 'LevelUpNight':
    case 'LevelUpVersionNight': return `${level} at night`
    // Mount Lanakila only exists in Alola; other games keep the method without naming a place.
    case 'LevelUpSummit': return generation === 7 ? `${lu} at Mount Lanakila` : `${lu} at a designated location`
    // The hour differs: Ultra Sun / Ultra Moon's clock, Sword / Shield's clock, Paldea's own day cycle.
    case 'LevelUpDusk':
      return group === 'usum' ? `${level} at dusk (5:00-5:59 PM)` : group === 'swsh' ? `${level} at dusk (7:00-7:59 PM)` : group === 'sv' ? `${level} in the evening` : `${level} at dusk`
    case 'LevelUpWormhole': return `${level} in Ultra Space`
    case 'CriticalHitsInBattle': return `Land ${NUMBER_WORDS[count()] ?? count()} critical hits in one battle`
    case 'HitPointsLostInBattle':
      return group === 'swsh'
        ? `Take ${count()} or more damage without fainting, then walk under the stone arch in the Dusty Bowl`
        : `Take ${count()} or more damage in one battle without fainting`
    case 'Spin': return 'Spin while it holds a Sweet'
    case 'LevelUpNatureAmped':
    case 'LevelUpNatureLowKey': return `${level} (form decided by its Nature)`
    case 'TowerOfDarkness': return e.argKind === 'item' ? `Use ${withArticle(arg('item'))} during the day` : 'Clear the Tower of Darkness'
    case 'TowerOfWaters': return e.argKind === 'item' ? `Use ${withArticle(arg('item'))} at night` : 'Clear the Tower of Waters'
    case 'LevelUpWalkStepsWith': return `Walk ${count().toLocaleString('en-US')} steps with it outside its Poké Ball, then level up`
    case 'LevelUpUnionCircle': return `${level} while in a Union Circle`
    case 'LevelUpInBattleEC100':
    case 'LevelUpInBattleECElse': return `${level} in battle (form decided by its personality value)`
    case 'LevelUpCollect999': return `Level up with ${count()} Gimmighoul Coins`
    case 'LevelUpDefeatEquals':
      only(625)
      return `Defeat ${NUMBER_WORDS[count()] ?? count()} Bisharp that hold a Leader's Crest, then level up`
    case 'LevelUpUseMoveSpecial':
      only(57)
      return `Use Rage Fist ${count()} times, then level up`
    case 'LevelUpRecoilDamageMale':
    case 'LevelUpRecoilDamageFemale': {
      only(550)
      const damage = e.argKind === 'count' ? e.arg : 294
      return `${e.up ? 'Level up' : 'Evolve'} after losing ${damage} HP to recoil damage (${e.m.endsWith('Female') ? 'female' : 'male'})`
    }
    case 'UseMoveBarbBarrage':
      only(211)
      return `Use Barb Barrage ${count()} times`
    case 'UseMoveAgileStyle':
      only(234)
      return 'Use Psyshield Bash 20 times in Agile Style'
    case 'UseMoveStrongStyle':
      only(211)
      return 'Use Barb Barrage 20 times in Strong Style'
    default:
      return fail(`No text for evolution method "${e.m}" (${e.from} -> ${e.to})`)
  }
}

/** One evolution in one game, with its method as text. */
export interface TextEdge {
  from: number
  to: number
  game: number
  how: string
}

export class EvolutionGraph {
  readonly edges: TextEdge[] = []
  /** Incoming edges per target form key. */
  private readonly incoming = new Map<number, TextEdge[]>()
  private readonly familyOf = new Map<number, number>()
  private readonly members = new Map<number, number[]>()
  /** How many Generation 1 / 2 edges took their text from the Generation 3 tree. */
  classicCorrected = 0

  constructor(byGame: PkEvolution[][], evolvesFrom: Map<number, number>) {
    const reference = byGame[gameIdx('ruby')]
    const referenceText = new Map<string, string[]>()
    for (const e of reference) {
      const key = `${e.from}>${e.to}`
      const list = referenceText.get(key) ?? []
      list.push(describeEvolution(e, gameIdx('ruby')))
      referenceText.set(key, list)
    }

    for (const [game, list] of byGame.entries()) {
      const generation = GAMES[game].generation
      const seen = new Set<string>()
      for (const e of list) {
        const from = sf(e.from[0], e.from[1])
        const to = sf(e.to[0], e.to[1])
        let texts = [describeEvolution(e, game)]
        if (generation <= 2) {
          // The Generation 1 / 2 trees only know "level up", "trade" and "use item".
          const better = referenceText.get(`${e.from}>${e.to}`)
          if (better) {
            if (better.join('|') !== texts.join('|')) this.classicCorrected++
            texts = better
          }
        }
        for (const how of texts) {
          const key = `${from}>${to}>${how}`
          if (seen.has(key)) continue
          seen.add(key)
          const edge: TextEdge = { from, to, game, how }
          this.edges.push(edge)
          const inc = this.incoming.get(to)
          if (inc) inc.push(edge)
          else this.incoming.set(to, [edge])
        }
      }
    }

    for (const extra of EXTRA_EDGES) {
      const edge: TextEdge = { from: sf(extra.from[0], extra.from[1]), to: sf(extra.to[0], extra.to[1]), game: gameIdx(extra.game), how: extra.how }
      this.edges.push(edge)
      const inc = this.incoming.get(edge.to)
      if (inc) inc.push(edge)
      else this.incoming.set(edge.to, [edge])
    }

    // Families: connected components over species, from every game's edges plus PokeAPI's parent links.
    const parent = new Map<number, number>()
    const find = (x: number): number => {
      let root = x
      while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!
      parent.set(x, root)
      return root
    }
    const union = (a: number, b: number): void => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb))
    }
    for (let s = 1; s <= 1025; s++) parent.set(s, s)
    for (const e of this.edges) union(sfSpecies(e.from), sfSpecies(e.to))
    for (const [child, from] of evolvesFrom) union(child, from)
    for (let s = 1; s <= 1025; s++) {
      const root = find(s)
      this.familyOf.set(s, root)
      const list = this.members.get(root)
      if (list) list.push(s)
      else this.members.set(root, [s])
    }
  }

  /** Family id of a species: the lowest national number in its family. */
  family(species: number): number {
    return this.familyOf.get(species)!
  }

  familyMembers(species: number): number[] {
    return this.members.get(this.family(species))!
  }

  /**
   * The family for display, base stage first: form 0 of every member species plus every form that
   * takes part in an evolution, except hidden forms.
   */
  familyNodes(species: number, categoryOf: (key: number) => FormCategory | undefined): FamilyNode[] {
    const members = new Set(this.familyMembers(species))
    const shown = (key: number): boolean => {
      const cat = categoryOf(key)
      return cat !== undefined && cat !== 'hidden'
    }
    const nodes = new Set<number>()
    for (const s of members) nodes.add(sf(s, 0))
    for (const e of this.edges) {
      if (!members.has(sfSpecies(e.to))) continue
      if (shown(e.from)) nodes.add(e.from)
      if (shown(e.to)) nodes.add(e.to)
    }

    const parentOf = new Map<number, { from: number; how: string }>()
    for (const node of nodes) {
      const inc = this.incoming.get(node)
      if (!inc || inc.length === 0) continue
      const latest = Math.max(...inc.map((e) => e.game))
      // A hidden parent (Spewpa's pattern index) is shown as that species' base form.
      const visibleFrom = (e: TextEdge): number => (shown(e.from) ? e.from : sf(sfSpecies(e.from), 0))
      const candidates = inc.filter((e) => e.game === latest).sort((a, b) => cmpNum(visibleFrom(a), visibleFrom(b)))
      const from = visibleFrom(candidates[0])
      if (from === node) continue
      const hows = [...new Set(candidates.filter((e) => visibleFrom(e) === from).map((e) => e.how))]
      parentOf.set(node, { from, how: hows.map((h, i) => (i === 0 ? h : h[0].toLowerCase() + h.slice(1))).join(' or ') })
    }

    // Depth-first from the base stages, so every branch stays together.
    const children = new Map<number, number[]>()
    const roots: number[] = []
    for (const node of [...nodes].sort(cmpNum)) {
      const p = parentOf.get(node)
      if (!p || !nodes.has(p.from)) roots.push(node)
      else {
        const list = children.get(p.from)
        if (list) list.push(node)
        else children.set(p.from, [node])
      }
    }
    const out: FamilyNode[] = []
    const visited = new Set<number>()
    const visit = (node: number): void => {
      if (visited.has(node)) return
      visited.add(node)
      const p = parentOf.get(node)
      const entry: FamilyNode = { s: sfSpecies(node), f: sfForm(node) }
      if (p && nodes.has(p.from)) {
        entry.from = [sfSpecies(p.from), sfForm(p.from)]
        entry.how = p.how
      }
      out.push(entry)
      for (const child of children.get(node) ?? []) visit(child)
    }
    // Base stages first: roots that have descendants, in evolution order, then unattached forms.
    for (const root of roots) visit(root)
    assert(out.length === nodes.size, `Family of species ${species} has a cycle or an unreachable form`)
    return out
  }
}
