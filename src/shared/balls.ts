/**
 * Poké Ball metadata. Ids are PKHeX `Ball` enum values, which is what the datasets and saves store.
 * Dependency-free and erasable-syntax only (see games.ts).
 */

export type BallFamily = 'standard' | 'special' | 'apricorn' | 'hisui' | 'event'

export interface BallDef {
  id: number
  slug: string
  name: string
  family: BallFamily
}

const b = (id: number, slug: string, name: string, family: BallFamily): BallDef => ({ id, slug, name, family })

export const BALLS: readonly BallDef[] = [
  b(4, 'poke', 'Poké Ball', 'standard'),
  b(3, 'great', 'Great Ball', 'standard'),
  b(2, 'ultra', 'Ultra Ball', 'standard'),
  b(1, 'master', 'Master Ball', 'standard'),
  b(12, 'premier', 'Premier Ball', 'special'),
  b(11, 'luxury', 'Luxury Ball', 'special'),
  b(6, 'net', 'Net Ball', 'special'),
  b(7, 'dive', 'Dive Ball', 'special'),
  b(8, 'nest', 'Nest Ball', 'special'),
  b(9, 'repeat', 'Repeat Ball', 'special'),
  b(10, 'timer', 'Timer Ball', 'special'),
  b(13, 'dusk', 'Dusk Ball', 'special'),
  b(14, 'heal', 'Heal Ball', 'special'),
  b(15, 'quick', 'Quick Ball', 'special'),
  b(17, 'fast', 'Fast Ball', 'apricorn'),
  b(18, 'level', 'Level Ball', 'apricorn'),
  b(19, 'lure', 'Lure Ball', 'apricorn'),
  b(20, 'heavy', 'Heavy Ball', 'apricorn'),
  b(21, 'love', 'Love Ball', 'apricorn'),
  b(22, 'friend', 'Friend Ball', 'apricorn'),
  b(23, 'moon', 'Moon Ball', 'apricorn'),
  b(5, 'safari', 'Safari Ball', 'special'),
  b(24, 'sport', 'Sport Ball', 'special'),
  b(25, 'dream', 'Dream Ball', 'special'),
  b(26, 'beast', 'Beast Ball', 'special'),
  b(16, 'cherish', 'Cherish Ball', 'event'),
  b(28, 'la-poke', 'Poké Ball (Hisui)', 'hisui'),
  b(29, 'la-great', 'Great Ball (Hisui)', 'hisui'),
  b(30, 'la-ultra', 'Ultra Ball (Hisui)', 'hisui'),
  b(31, 'la-feather', 'Feather Ball', 'hisui'),
  b(32, 'la-wing', 'Wing Ball', 'hisui'),
  b(33, 'la-jet', 'Jet Ball', 'hisui'),
  b(34, 'la-heavy', 'Heavy Ball (Hisui)', 'hisui'),
  b(35, 'la-leaden', 'Leaden Ball', 'hisui'),
  b(36, 'la-gigaton', 'Gigaton Ball', 'hisui'),
  b(37, 'la-origin', 'Origin Ball', 'hisui'),
  b(27, 'strange', 'Strange Ball', 'event')
]

export const BALL_BY_ID: ReadonlyMap<number, BallDef> = new Map(BALLS.map((d) => [d.id, d]))
