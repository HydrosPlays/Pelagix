/**
 * Forms the player reaches by changing another form inside a game: held items, key items, fusions,
 * a move, a salon, the place of the last battle. PKHeX only records which form an encounter hands
 * out (and whether a form is changeable at all), so the method and the games it exists in are
 * curated here.
 *
 * These become "evolve" sources of the target form (the app labels that list "evolutions and form
 * changes") and feed FormSummary.obtain / event the way evolutions do: Sky Shaymin is obtainable
 * wherever Shaymin is and the Gracidea exists; White Kyurem also needs Reshiram.
 *
 * A change applies in every game whose data has both forms, unless the entry narrows it. Checked
 * in October 2026 against Serebii, Bulbapedia's item pages and dittobase.com's per-game item lists.
 */
import { GAMES } from '../../src/shared/games.ts'
import { assert, fail, sf } from './util.ts'

interface ChangeRule {
  species: number
  /** Form the change starts from. */
  from?: number
  /** Forms it leads to. */
  to: readonly number[]
  /** Method text, per target form or one for all. */
  how: string | Readonly<Record<number, string>>
  /** Text for changing back; given when a changed form can be the one a game hands out. */
  back?: string
  /** Fusion partner per target form: it has to be obtainable in the same game. */
  partner?: Readonly<Record<number, number>>
  /** Game ids or groups the rule is limited to. */
  only?: readonly string[]
  /** Game ids or groups without the mechanism although both forms are in the data. */
  except?: readonly string[]
  /** Game ids or groups where the item that changes the form was only ever distributed. */
  eventOnly?: Readonly<Record<string, string>>
}

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)

const TYPES = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy']
const PLATES = ['Fist', 'Sky', 'Toxic', 'Earth', 'Stone', 'Insect', 'Spooky', 'Iron', 'Flame', 'Splash', 'Meadow', 'Zap', 'Mind', 'Icicle', 'Draco', 'Dread', 'Pixie']
const byIndex = (texts: readonly string[], make: (text: string) => string): Record<number, string> =>
  Object.fromEntries(texts.map((t, i) => [i + 1, make(t)]))

const CHANGE = 'Change form: '

const RULES: readonly ChangeRule[] = [
  // Deoxys: from Generation 4 on a meteorite switches the forme (Generation 3 ties it to the cartridge).
  { species: 386, to: [1, 2, 3], how: `${CHANGE}examine a meteorite`, back: `${CHANGE}examine a meteorite`, except: ['rs', 'emerald', 'frlg', 'colosseum', 'xd'] },
  // Burmy's cloak follows the place of its last battle.
  {
    species: 412, to: [1, 2],
    how: { 1: `${CHANGE}battle in a cave or on sand`, 2: `${CHANGE}battle inside a building` },
    back: `${CHANGE}battle in grass`, except: ['pla']
  },
  // Rotom's appliances. Platinum's room only opens with the Secret Key, a Wi-Fi distribution.
  {
    species: 479, to: [1, 2, 3, 4, 5],
    how: { 1: `${CHANGE}have it enter a microwave oven`, 2: `${CHANGE}have it enter a washing machine`, 3: `${CHANGE}have it enter a refrigerator`, 4: `${CHANGE}have it enter an electric fan`, 5: `${CHANGE}have it enter a lawn mower` },
    back: `${CHANGE}have it leave its appliance`,
    eventOnly: { platinum: 'needs the Secret Key, an event item' }
  },
  { species: 483, to: [1], how: `${CHANGE}give it the Adamant Crystal`, back: `${CHANGE}take the Adamant Crystal away` },
  { species: 484, to: [1], how: `${CHANGE}give it the Lustrous Globe`, back: `${CHANGE}take the Lustrous Globe away` },
  { species: 487, to: [1], how: `${CHANGE}give it the Griseous Orb to hold`, back: `${CHANGE}take the Griseous Orb away`, except: ['pla', 'sv'] },
  { species: 487, to: [1], how: `${CHANGE}give it the Griseous Core`, back: `${CHANGE}take the Griseous Core away`, only: ['pla', 'sv'] },
  { species: 492, to: [1], how: `${CHANGE}use a Gracidea in the daytime`, back: `${CHANGE}it reverts at night` },
  { species: 493, to: range(1, 17), how: byIndex(PLATES, (plate) => `${CHANGE}give it the ${plate} Plate to hold`), back: `${CHANGE}take its Plate away` },
  // Forces of Nature.
  ...[641, 642, 645, 905].map((species): ChangeRule => ({ species, to: [1], how: `${CHANGE}use the Reveal Glass`, back: `${CHANGE}use the Reveal Glass` })),
  // Kyurem: the DNA Splicers cannot be had in X / Y.
  {
    species: 646, to: [1, 2],
    how: { 1: 'Fuse with Reshiram using the DNA Splicers', 2: 'Fuse with Zekrom using the DNA Splicers' },
    partner: { 1: 643, 2: 644 }, except: ['xy']
  },
  // Keldeo. (Whether Legends: Z-A lets it relearn Secret Sword is not documented yet.)
  { species: 647, to: [1], how: `${CHANGE}teach it Secret Sword`, back: `${CHANGE}have it forget Secret Sword`, except: ['za'] },
  {
    species: 649, to: [1, 2, 3, 4],
    how: { 1: `${CHANGE}give it the Douse Drive to hold`, 2: `${CHANGE}give it the Shock Drive to hold`, 3: `${CHANGE}give it the Burn Drive to hold`, 4: `${CHANGE}give it the Chill Drive to hold` },
    back: `${CHANGE}take its Drive away`
  },
  { species: 676, to: range(1, 9), how: `${CHANGE}have it trimmed at a grooming salon`, back: `${CHANGE}the trim grows out after five days` },
  // Zygarde: the Cube switches 10% and 50%; the Power Construct pair (hidden forms) alike.
  { species: 718, to: [1], how: `${CHANGE}use the Zygarde Cube`, back: `${CHANGE}use the Zygarde Cube` },
  { species: 718, from: 3, to: [2], how: `${CHANGE}use the Zygarde Cube`, back: `${CHANGE}use the Zygarde Cube` },
  { species: 720, to: [1], how: `${CHANGE}use the Prison Bottle`, back: `${CHANGE}use the Prison Bottle` },
  { species: 773, to: range(1, 17), how: byIndex(TYPES, (type) => `${CHANGE}give it the ${type} Memory to hold`), back: `${CHANGE}take its Memory away` },
  {
    species: 800, to: [1, 2],
    how: { 1: 'Fuse with Solgaleo using the N-Solarizer', 2: 'Fuse with Lunala using the N-Lunarizer' },
    partner: { 1: 791, 2: 792 }
  },
  {
    species: 898, to: [1, 2],
    how: { 1: 'Fuse with Glastrier using the Reins of Unity', 2: 'Fuse with Spectrier using the Reins of Unity' },
    partner: { 1: 896, 2: 897 }
  },
  {
    species: 1017, to: [1, 2, 3],
    how: { 1: `${CHANGE}give it the Wellspring Mask to hold`, 2: `${CHANGE}give it the Hearthflame Mask to hold`, 3: `${CHANGE}give it the Cornerstone Mask to hold` },
    back: `${CHANGE}take its mask away`
  }
]

/** One way of changing a form in one game. */
export interface ChangeEdge {
  from: number
  to: number
  how: string
  /** A curated direction, always listed as a source; a reverse edge is only listed where it is the reason. */
  forward: boolean
  /** Form key of the fusion partner that has to be obtainable too. */
  partner?: number
  /** The item that makes the change possible was itself an event distribution in this game. */
  eventOnly: boolean
}

function matches(list: readonly string[] | undefined, game: { id: string; group: string }): boolean {
  return list !== undefined && (list.includes(game.id) || list.includes(game.group))
}

/**
 * Form-change edges per game index, for the forms present there. Fails on an entry that names an
 * unknown game or never applies (a form index PKHeX dropped, a mistyped species).
 */
export function loadFormChanges(presence: Set<number>[]): ChangeEdge[][] {
  const known = new Set(GAMES.flatMap((g) => [g.id, g.group]))
  const out: ChangeEdge[][] = GAMES.map(() => [])
  for (const rule of RULES) {
    for (const name of [...(rule.only ?? []), ...(rule.except ?? []), ...Object.keys(rule.eventOnly ?? {})]) {
      assert(known.has(name), `form-changes.ts: species ${rule.species} names unknown game or group "${name}"`)
    }
    const from = sf(rule.species, rule.from ?? 0)
    let used = 0
    for (const [game, def] of GAMES.entries()) {
      if (rule.only && !matches(rule.only, def)) continue
      if (matches(rule.except, def)) continue
      if (!presence[game].has(from)) continue
      const gate = Object.entries(rule.eventOnly ?? {}).find(([name]) => name === def.id || name === def.group)?.[1]
      for (const f of rule.to) {
        const to = sf(rule.species, f)
        if (!presence[game].has(to)) continue
        const text = typeof rule.how === 'string' ? rule.how : (rule.how[f] ?? fail(`form-changes.ts: species ${rule.species} has no text for form ${f}`))
        const edge: ChangeEdge = { from, to, how: gate ? `${text} (${gate})` : text, forward: true, eventOnly: gate !== undefined }
        const partner = rule.partner?.[f]
        if (partner !== undefined) edge.partner = sf(partner, 0)
        out[game].push(edge)
        if (rule.back !== undefined) out[game].push({ from: to, to: from, how: rule.back, forward: false, eventOnly: false })
        used++
      }
    }
    assert(used > 0, `form-changes.ts: the rule for species ${rule.species} (forms ${rule.to.join(', ')}) applies to no game`)
  }
  return out
}
