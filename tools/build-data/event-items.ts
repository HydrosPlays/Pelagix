/**
 * In-game encounters that only open up with an item or Pokémon from a real-world distribution.
 *
 * PKHeX stores them as ordinary static encounters or gifts (they are scripted battles on the
 * cartridge), but without the distributed ticket there is no way to reach them, so Pelagix files
 * them under "event": they must not make a Pokémon count as obtainable in that game.
 *
 * Encounters unlocked by save data of another game (Mew and Jirachi in Brilliant Diamond /
 * Shining Pearl, Shaymin and Darkrai in Legends: Arceus), by a still-working QR code (Magearna)
 * or by the Virtual Console release (Crystal's Celebi) are not time-limited and stay as they are.
 */
import { GAMES } from '../../src/shared/games.ts'
import type { RowDraft } from './rows.ts'
import { assert } from './util.ts'

interface EventItemEncounter {
  games: readonly string[]
  species: number
  form?: number
  /** Start of the location name, to tell the locked encounter from an ordinary one of the same species. */
  location: string
  requires: string
}

const e = (games: readonly string[], species: number, location: string, requires: string, form?: number): EventItemEncounter =>
  ({ games, species, location, requires, ...(form === undefined ? {} : { form }) })

const ENCOUNTERS: readonly EventItemEncounter[] = [
  // Generation 3 tickets
  e(['ruby', 'emerald'], 380, 'Southern Island', 'Requires the Eon Ticket'),
  e(['sapphire', 'emerald'], 381, 'Southern Island', 'Requires the Eon Ticket'),
  e(['emerald'], 151, 'Faraway Island', 'Requires the Old Sea Map'),
  e(['emerald', 'firered', 'leafgreen'], 249, 'Navel Rock', 'Requires the Mystic Ticket'),
  e(['emerald', 'firered', 'leafgreen'], 250, 'Navel Rock', 'Requires the Mystic Ticket'),
  e(['firered'], 386, 'Birth Island', 'Requires the Aurora Ticket', 1),
  e(['leafgreen'], 386, 'Birth Island', 'Requires the Aurora Ticket', 2),
  e(['emerald'], 386, 'Birth Island', 'Requires the Aurora Ticket', 3),
  // Generation 4
  e(['platinum'], 377, 'Rock Peak Ruins', 'Requires a distributed Regigigas'),
  e(['platinum'], 378, 'Iceberg Ruins', 'Requires a distributed Regigigas'),
  e(['platinum'], 379, 'Iron Ruins', 'Requires a distributed Regigigas'),
  e(['platinum'], 491, 'Newmoon Island', 'Requires the Member Card'),
  e(['platinum'], 492, 'Flower Paradise', "Requires Oak's Letter"),
  e(['heartgold', 'soulsilver'], 172, 'Ilex Forest', 'Requires the distributed Pikachu-colored Pichu', 1),
  e(['heartgold', 'soulsilver'], 483, 'Sinjoh Ruins', 'Requires a distributed Arceus'),
  e(['heartgold', 'soulsilver'], 484, 'Sinjoh Ruins', 'Requires a distributed Arceus'),
  e(['heartgold', 'soulsilver'], 487, 'Sinjoh Ruins', 'Requires a distributed Arceus', 1),
  e(['heartgold'], 381, 'Pewter City', 'Requires the Enigma Stone'),
  e(['soulsilver'], 380, 'Pewter City', 'Requires the Enigma Stone'),
  // Generation 5
  e(['black', 'white'], 494, 'Liberty Garden', 'Requires the Liberty Pass'),
  e(['black', 'white'], 570, 'Castelia City', 'Requires a distributed Celebi'),
  e(['black', 'white'], 571, 'Lostlorn Forest', 'Requires a distributed Raikou, Entei or Suicune'),
  // Generation 6: the Latias / Latios the story does not hand over
  e(['omegaruby'], 380, 'Southern Island', 'Requires the Eon Ticket'),
  e(['alphasapphire'], 381, 'Southern Island', 'Requires the Eon Ticket'),
  // Brilliant Diamond / Shining Pearl
  e(['brilliantdiamond', 'shiningpearl'], 491, 'Newmoon Island', 'Requires the Member Card'),
  e(['brilliantdiamond', 'shiningpearl'], 492, 'Flower Paradise', "Requires Oak's Letter")
]

/**
 * Encounters that stay ordinary ones but need something the player should know about: an item the
 * Virtual Console release hands out, or a Mystery Gift whose end has not been announced.
 */
const NOTES: readonly EventItemEncounter[] = [
  e(['crystal'], 251, 'Ilex Forest', 'Requires the GS Ball (given in the Virtual Console release; on cartridge a Japan-only mobile event)'),
  e(['legendsza'], 719, 'Magenta Sector', 'Requires the Diancite from Mystery Gift')
]

export const EVENT_ITEM_METHOD = 'Event encounter'

/** Re-files the drafts of event-locked encounters as events. Returns how many drafts changed. */
export function applyEventItems(drafts: RowDraft[]): number {
  let changed = 0
  for (const entry of ENCOUNTERS) {
    let hits = 0
    for (const d of drafts) {
      if (d.s !== entry.species || d.f !== (entry.form ?? 0)) continue
      if (d.k !== 'static' && d.k !== 'gift') continue
      if (!entry.games.includes(GAMES[d.game].id)) continue
      if (d.loc === undefined || !d.loc.startsWith(entry.location)) continue
      d.k = 'event'
      d.m = EVENT_ITEM_METHOD
      d.notes.unshift(entry.requires)
      hits++
    }
    assert(hits >= entry.games.length, `event-items.ts: species ${entry.species} at ${entry.location} matched ${hits} rows for ${entry.games.length} games`)
    changed += hits
  }
  for (const entry of NOTES) {
    let hits = 0
    for (const d of drafts) {
      if (d.s !== entry.species || d.f !== (entry.form ?? 0) || (d.k !== 'static' && d.k !== 'gift')) continue
      if (!entry.games.includes(GAMES[d.game].id) || d.loc === undefined || !d.loc.startsWith(entry.location)) continue
      d.notes.unshift(entry.requires)
      hits++
    }
    assert(hits >= entry.games.length, `event-items.ts: the note for species ${entry.species} at ${entry.location} matched ${hits} rows`)
  }
  return changed
}
