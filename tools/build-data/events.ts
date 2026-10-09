/**
 * Real-world distributions as "event" rows: Mystery Gift cards (Generation 4 onwards, gifts.json)
 * and the Generation 1-3 events PKHeX keeps as encounter templates.
 *
 * One row per distribution: the language variants of a card (same card id; for cards without an
 * id, same species, level, ball and source) are merged and their games united, the English card
 * supplying title and OT. Generation 4 and 5 cards say which language they are in; Generation 6
 * and 7 cards do not, so their titles are judged by their wording. Rows that then differ by
 * nothing but their card id are merged as well.
 */
import type { EventInfo, SourceVia } from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import { gameIdx, idxOfCode, idxOfCodes } from './game-map.ts'
import type { PkEncounter, PkGift } from './pkhex-types.ts'
import type { RowDraft } from './rows.ts'
import type { PkhexData } from './sources.ts'
import { assert, cmpNum, cmpStr, fail, groupBy, uniqSorted } from './util.ts'

export interface EventStats {
  cards: number
  cardDistributions: number
  classicTemplates: number
  classicDistributions: number
  titled: number
  untitled: number
  /** Rows folded into another one that differed only by card id (or was the HOME copy of the same gift). */
  duplicatesMerged: number
}

const LATIN_TEXT = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{Sm}\p{Sc}]+$/u
/** Placeholder titles PKHeX invents for cards it simulates or cannot name. */
const PLACEHOLDER_TITLE = /^(Simulated|Raw Gift|Mystery Gift$)|Dummy Card/i
/** Wonder-card texts that open with a salutation instead of a title ("Trusted Pokémon Trainer:"). */
const SALUTATION = /[:,]$/

/**
 * Words that give a French, German, Italian, Spanish, Dutch or Portuguese card title away. Titles
 * are a handful of words, so articles and the commonest function words are enough.
 */
const FOREIGN_WORDS: ReadonlySet<string> = new Set([
  'le', 'la', 'les', 'du', 'des', 'un', 'une', 'et', 'est', 'pour', 'avec', 'votre', 'voici', 'au', 'aux', 'en',
  'der', 'die', 'das', 'ein', 'eine', 'einen', 'von', 'und', 'mit', 'ist', 'dein', 'deine', 'zum', 'zur', 'im', 'hier', 'kommt', 'auf', 'dem', 'den',
  'il', 'lo', 'gli', 'di', 'del', 'della', 'dei', 'una', 'per', 'con', 'ecco', 'verso', 'tuo', 'tua',
  'el', 'los', 'las', 'para', 'es', 'tu',
  'het', 'een', 'van', 'voor', 'met', 'jouw', 'de', 'da', 'uma', 'com',
  // Seen in titles that have no English card: "Klein, aber oho!", "Lerne SHAYMIN kennen!", "Latios sfreccia rapido" ...
  'aber', 'klein', 'lerne', 'kennen', 'wieder', 'leuchtendes', 'schillerndes', 'neues', 'dich',
  'lotta', 'sfreccia', 'rapido', 'nemici', 'arroventa', 'alla', 'nel', 'nella',
  'dans', 'sur', 'chromatique', 'lucha', 'combate', 'nuevo', 'variocolor'
])
const ENGLISH_WORDS =
  /\b(the|gift|for|of|your|from|and|with|to|a|an|is|it's|here|get|got|bank|shiny|special|legendary|mythical|present|birthday|happy|winner|strong|secret|movie|store|trainer|league)\b/i
/** Endings of Romance and German adjectives ("radiante", "explosivo", "Leuchtendes") that English words do not share. */
const FOREIGN_ENDING = /^[a-z]{3,}(ante|ente|ivo|iva|endes|ische|zione)$/
/** Words English spells with an accent too. */
const ENGLISH_ACCENTED = /Pokémon|Poké|Flabébé/g
/** English contractions, so that "It's" is not read as an elided article like "L'ardente". */
const ENGLISH_CONTRACTION = /\b(?:(?:it|that|here|what|let|who|he|she|there)'s|(?:i|we|you|they|he|she|it)'(?:ll|re|ve|d|m))\b/gi

function cleanTitle(title: string): string {
  // \s also covers the ideographic spaces (U+3000) of Japanese card titles.
  return title.replace(/\s+/g, ' ').replace(/[’‘]/g, "'").trim()
}

function isReadableLatin(text: string): boolean {
  return text !== '' && LATIN_TEXT.test(text) && (text.match(/\p{Script=Latin}/gu) ?? []).length >= 3
}

/**
 * How English a card title looks: 3 English, 2 plain text that may be English, 1 another European
 * language, 0 not readable Latin text. Placeholder titles count by the language tag PKHeX puts in
 * them ("Simulated Partner Cap ENG").
 */
export function englishScore(rawTitle: string): number {
  const title = cleanTitle(rawTitle)
  if (PLACEHOLDER_TITLE.test(title)) return /\b(ENG|English)\b/.test(title) ? 3 : /\b(JPN|Japanese|KOR|Korean|CHS|CHT)\b/.test(title) ? 0 : 1
  if (!isReadableLatin(title)) return 0
  const plain = title.replace(ENGLISH_ACCENTED, '')
  // Accented letters and inverted punctuation; dashes and ellipses are fine.
  if (/[\u00a1\u00bf\u00c0-\u024f]/.test(plain)) return 1
  // French spacing before punctuation ("Aaaah !") and elided articles ("L'ardente", "C'est").
  if (/ [!?:]/.test(title) || /\b[A-Za-z]{1,2}'[A-Za-z]{2,}/.test(plain.replace(ENGLISH_CONTRACTION, ''))) return 1
  const words = plain.toLowerCase().split(/[^a-z']+/).filter((w) => w !== '')
  if (words.some((w) => FOREIGN_WORDS.has(w) || FOREIGN_ENDING.test(w))) return 1
  return ENGLISH_WORDS.test(plain) ? 3 : 2
}

/** Languages whose cards are titled in that language; a Japanese or Korean card with a Latin title is titled in English. */
const EUROPEAN_LANGUAGES: ReadonlySet<string> = new Set(['French', 'Italian', 'German', 'Spanish'])

/**
 * englishScore, corrected by the language PKHeX reports for the card (the language of the Pokémon
 * it hands out, which is not always the language of its text): an English-looking title on an
 * English card ranks first (4), a title on a French, Italian, German or Spanish card is never
 * taken for English, whatever its wording.
 */
function cardScore(g: PkGift): number {
  const score = englishScore(g.title)
  if (g.lang === 'English') return score >= 2 ? 4 : score
  return g.lang !== undefined && EUROPEAN_LANGUAGES.has(g.lang) ? Math.min(score, 1) : score
}

/** A card's title when it is fit for display: not a placeholder, not a salutation, and English. */
function displayTitle(g: PkGift): string | undefined {
  const title = cleanTitle(g.title)
  if (title === '' || PLACEHOLDER_TITLE.test(title) || SALUTATION.test(title)) return undefined
  return cardScore(g) >= 2 ? title : undefined
}

/** OT names compared without regard to script width, case or spacing. */
function normalizeOt(ot: string | undefined): string {
  return (ot ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function tidyOt(ot: string | undefined): string | undefined {
  const value = ot?.normalize('NFKC').trim()
  return value === undefined || value === '' ? undefined : value
}

function pickOt(ots: (string | undefined)[]): string | undefined {
  const present = ots.map(tidyOt).filter((o): o is string => o !== undefined)
  if (present.length === 0) return undefined
  return present.find((o) => /^[\x20-\x7e]+$/.test(o)) ?? present.find((o) => LATIN_TEXT.test(o)) ?? present[0]
}

function shinyState(h: string | undefined): RowDraft['sh'] {
  if (h === undefined) return undefined
  return h === 'Never' || h === 'FixedValue' ? 'locked' : 'forced'
}

export interface EventContext {
  pk: PkhexData
  /** Display name of a form for "<name> gift" fallbacks. */
  formName: (species: number, form: number) => string
  /** The form has no gender, so a fixed gender on it can only mean "genderless". */
  genderless: (species: number, form: number) => boolean
}

interface Normalized {
  s: number
  f: number
  notes: string[]
}

/** Context-dependent form indices in event data, remapped to Pelagix's universe. */
function normalizeForm(species: number, form: number, context: string): Normalized {
  if (species === 25 && form >= 1 && form <= 6 && context === 'Gen6') {
    return { s: 25, f: 0, notes: ['Cosplay Pikachu (cannot leave Omega Ruby / Alpha Sapphire)'] }
  }
  if (species === 493 && context === 'Gen4' && form >= 9) {
    if (form === 9) fail('A Generation 4 event gives ???-type Arceus')
    return { s: 493, f: form - 1, notes: [] }
  }
  return { s: species, f: form, notes: [] }
}

/** Gifts a Pokémon Ranger game sends over; PKHeX files all but the Manaphy Egg as ordinary Generation 4 cards. */
const isRangerCard = (g: PkGift): boolean => g.type === 'PGT' || g.locName === 'Pokémon Ranger'

function fixedGender(ctx: EventContext, s: number, f: number, genders: Set<0 | 1 | 2 | undefined>): 0 | 1 | 2 | undefined {
  if (genders.size !== 1) return undefined
  const [d] = genders
  if (d === undefined) return undefined
  return ctx.genderless(s, f) ? 2 : d
}

function cardDrafts(ctx: EventContext, stats: EventStats): RowDraft[] {
  const out: RowDraft[] = []
  // Cards without an id (PKHeX's reconstructions) are told apart by what they hand out and where it was "met".
  const key = (g: PkGift): string =>
    JSON.stringify([g.type, g.id > 0 ? g.id : `loc:${g.loc ?? ''}`, g.s, g.f, g.lv, shinyState(g.h) ?? '', g.b, g.egg ?? 0])
  for (const group of groupBy(ctx.pk.gifts, key).values()) {
    stats.cards += group.reduce((n, g) => n + g.n, 0)
    stats.cardDistributions++
    // The most English card first: it supplies the title and the OT.
    const ranked = [...group].sort((a, b) => cardScore(b) - cardScore(a) || cmpStr(cleanTitle(a.title), cleanTitle(b.title)))
    const first = ranked[0]
    const form = normalizeForm(first.s, first.f, first.x)
    const games = idxOfCodes(group.flatMap((g) => g.games))
    assert(games.length > 0, `Mystery gift ${first.type} #${first.id} maps to no game`)

    const name = ctx.formName(form.s, form.f)
    const shown = displayTitle(first)
    const title = shown ?? (first.egg ? `${name} Egg gift` : `${name} gift`)
    if (shown !== undefined) stats.titled++
    else stats.untitled++

    const x: EventInfo = {}
    const ot = tidyOt(ranked.find((g) => tidyOt(g.ot) !== undefined && cardScore(g) >= 2)?.ot) ?? pickOt(ranked.map((g) => g.ot))
    if (ot !== undefined) x.ot = ot
    const starts = group.map((g) => g.from ?? g.date).filter((v): v is string => v !== undefined).sort()
    if (starts.length > 0) x.from = starts[0]
    const windows = group.filter((g) => g.from !== undefined)
    if (windows.length > 0 && windows.every((g) => g.to !== undefined)) x.to = windows.map((g) => g.to!).sort().at(-1)!
    if (first.id > 0) x.id = first.id

    const home = group.some((g) => g.home)
    const ranger = group.every(isRangerCard)
    const via: SourceVia | undefined = home ? 'home' : ranger ? 'ranger' : undefined
    const sh = shinyState(first.h)
    const gender = fixedGender(ctx, form.s, form.f, new Set(group.map((g) => g.d)))
    for (const game of games) {
      const d: RowDraft = { s: form.s, f: form.f, game, k: 'event', lv: [first.lv, first.lv], c: [], notes: [title, ...form.notes] }
      d.m = home ? 'Pokémon HOME gift' : ranger ? 'Pokémon Ranger' : 'Mystery Gift'
      if (first.egg) d.c.push('Egg')
      if (sh) d.sh = sh
      d.b = first.b
      if (gender !== undefined) d.d = gender
      if (via) d.via = via
      if (Object.keys(x).length > 0) d.x = { ...x }
      out.push(d)
    }
  }
  return out
}

interface ClassicSource {
  m: string
  via?: SourceVia
  note?: string
}

/** Jirachi from the Colosseum Bonus Discs (international "WISHMKR", Japanese "Negai Boshi"). */
const BONUS_DISC_OT: ReadonlySet<string> = new Set(['wishmkr', 'ネガイボシ'])
/** The shiny Zigzagoon of the Berry Glitch fix carries the name of the version it was sent to. */
const BERRY_FIX_OT: Readonly<Record<string, string>> = { ruby: 'ruby', ルビー: 'ruby', saphire: 'sapphire', サファイア: 'sapphire' }
/** OT names that are one distribution's name in several languages: normalized OT -> family. */
const OT_FAMILY: Readonly<Record<string, string>> = { '10anniv': '10th', '10jahre': '10th', '10anni': '10th', '10aniv': '10th' }

/** A Generation 3 Deoxys takes the forme of the cartridge it is in, whichever forme it was handed out as. */
const DEOXYS_CARTRIDGE_FORME: Readonly<Record<string, number>> = { firered: 1, leafgreen: 2, emerald: 3 }

function cartridgeForm(r: PkEncounter, game: number): number {
  return r.s === 386 && r.x === 'Gen3' ? (DEOXYS_CARTRIDGE_FORME[GAMES[game].id] ?? 0) : r.f
}

const GBA_GAMES: readonly number[] = ['ruby', 'sapphire', 'emerald', 'firered', 'leafgreen'].map(gameIdx)
const RUBY_SAPPHIRE: readonly number[] = ['ruby', 'sapphire'].map(gameIdx)

function classicSource(r: PkEncounter): ClassicSource {
  const ot = normalizeOt(r.ot)
  switch (r.t) {
    case 'EncounterGift1':
      if (r.tr === 'Stadium') return { m: 'Pokémon Stadium', via: 'stadium' }
      if (r.tr === 'VirtualConsoleMew') return { m: 'Virtual Console' }
      return { m: 'Event distribution' }
    case 'EncounterGift2':
      if (r.tr?.startsWith('GiftStadium')) return { m: 'Pokémon Stadium 2', via: 'stadium2' }
      if (r.tr === 'PokemonCenterNewYork') return { m: 'Pokémon Center New York' }
      return { m: 'Event distribution' }
    case 'EncounterGift3NY':
      return { m: 'Pokémon Center New York' }
    case 'EncounterGift3JPN':
      return { m: 'Pokémon Center (Japan)' }
    case 'EncounterGift3':
      // Pokémon Box: Ruby & Sapphire hands out four eggs with the OT "AZUSA" (EncountersWC3.cs).
      if (r.k === 'event-egg' && ot === 'azusa') return { m: 'Pokémon Box', via: 'boxrubysapphire' }
      if (ot === 'channel') return { m: 'Pokémon Channel' }
      if (BONUS_DISC_OT.has(ot)) return { m: 'Bonus Disc', via: 'colosseum', note: 'Colosseum Bonus Disc' }
      if (ot in BERRY_FIX_OT) return { m: 'Berry Glitch fix' }
      return { m: 'Event distribution' }
    default:
      return fail(`Unknown event template type ${r.t}`)
  }
}

/**
 * Games a Generation 3 distribution could be received in. PKHeX's Version on these templates is
 * the origin mark the distribution cartridge stamps on the Pokémon (Ruby for nearly all of them),
 * not the game that receives it: hand-outs were link-traded into any of the five GBA games.
 */
function gen3Games(r: PkEncounter, stamped: number[]): number[] {
  if (r.t !== 'EncounterGift3' && r.t !== 'EncounterGift3JPN') return stamped
  const ot = normalizeOt(r.ot)
  if (ot in BERRY_FIX_OT) return [gameIdx(BERRY_FIX_OT[ot])]
  if (BONUS_DISC_OT.has(ot)) return [...RUBY_SAPPHIRE]
  // Tokyo's Pokémon Center machines served Ruby and Sapphire, like New York's (which PKHeX lists for both).
  if (r.t === 'EncounterGift3JPN') return [...RUBY_SAPPHIRE]
  // Eggs and the few templates PKHeX already lists for several games keep its list.
  if (r.k === 'event-egg' || stamped.length !== 1 || GAMES[stamped[0]].id !== 'ruby') return stamped
  return [...GBA_GAMES]
}

function classicDrafts(ctx: EventContext, stats: EventStats): RowDraft[] {
  const out: RowDraft[] = []
  const { encounters } = ctx.pk
  const events = encounters.rows.filter((r) => r.k === 'event' || r.k === 'event-egg')
  const stampedGames = (r: PkEncounter): number[] => uniqSorted(r.g.flatMap((i) => idxOfCode(encounters.games[i])))
  const gamesOf = (r: PkEncounter): number[] => (r.x === 'Gen3' ? gen3Games(r, stampedGames(r)) : stampedGames(r))
  const key = (r: PkEncounter): string => {
    const src = classicSource(r)
    const ot = normalizeOt(r.ot)
    // Stadium gifts and the 10th-anniversary tours only differ by the language of the OT name.
    const who = src.via === 'stadium' || src.via === 'stadium2' ? '' : (OT_FAMILY[ot] ?? ot)
    return JSON.stringify([r.x, src.m, r.s, r.f, r.l, shinyState(r.h) ?? '', r.k, who, r.dist ?? '', r.x === 'Gen3' ? gamesOf(r).join(',') : ''])
  }
  const languageRank = (r: PkEncounter): number => {
    const language = r.c?.language
    return language === 'English' ? 0 : language === undefined || language === 'International' ? 1 : language === 'Japanese' ? 3 : 2
  }
  for (const unsorted of groupBy(events, key).values()) {
    const group = [...unsorted].sort((a, b) => cmpNum(languageRank(a), languageRank(b)))
    stats.classicTemplates += group.reduce((n, r) => n + r.n, 0)
    const first = group[0]
    const games = uniqSorted(group.flatMap(gamesOf))
    if (games.length === 0) continue
    stats.classicDistributions++
    const src = classicSource(first)
    const egg = first.k === 'event-egg'
    const classic = first.x === 'Gen1' || first.x === 'Gen2'
    const languages = new Set(group.map((r) => r.c?.language ?? ''))
    const x: EventInfo = {}
    const ot = pickOt(group.flatMap((r) => [r.ot, ...(r.ots ?? [])]))
    if (ot !== undefined) x.ot = ot
    const gender = fixedGender(ctx, first.s, first.f, new Set(group.map((r) => r.d)))
    for (const game of games) {
      const form = cartridgeForm(first, game)
      const name = ctx.formName(first.s, form)
      const d: RowDraft = { s: first.s, f: form, game, k: 'event', lv: [first.l[0], first.l[1]], c: [], notes: [egg ? `${name} Egg gift` : `${name} gift`] }
      d.m = src.m
      if (src.via) d.via = src.via
      if (src.note) d.notes.push(src.note)
      if (egg) d.c.push('Egg')
      if (languages.size === 1 && languages.has('Japanese')) d.c.push('Japanese games')
      const sh = shinyState(first.h)
      if (sh) d.sh = sh
      if (first.b !== undefined && !classic) d.b = first.b
      if (gender !== undefined) d.d = gender
      if (Object.keys(x).length > 0) d.x = { ...x }
      out.push(d)
    }
  }
  return out
}

/**
 * Folds drafts that show the same thing: rows equal in everything but the card id keep the lowest
 * id, and a gift PKHeX holds both as an in-game wonder card and as its Pokémon HOME delivery keeps
 * the HOME row.
 */
function mergeDuplicates(drafts: RowDraft[], stats: EventStats): RowDraft[] {
  const identity = (d: RowDraft, withSource: boolean): string =>
    JSON.stringify([
      d.s, d.f, d.game, d.lv, d.c, d.sh ?? '', d.b ?? '', d.d ?? '', d.notes, d.x?.ot ?? '',
      ...(withSource ? [d.m ?? '', d.via ?? '', d.x?.from ?? '', d.x?.to ?? ''] : [])
    ])
  const homeGifts = new Set(drafts.filter((d) => d.via === 'home').map((d) => identity(d, false)))
  const kept = drafts.filter((d) => {
    const dropped = d.via === undefined && d.m === 'Mystery Gift' && homeGifts.has(identity(d, false))
    if (dropped) stats.duplicatesMerged++
    return !dropped
  })
  const out: RowDraft[] = []
  for (const group of groupBy(kept, (d) => identity(d, true)).values()) {
    const ids = group.map((d) => d.x?.id).filter((id): id is number => id !== undefined)
    const keep = ids.length === 0 ? group[0] : group.find((d) => d.x?.id === Math.min(...ids))!
    stats.duplicatesMerged += group.length - 1
    out.push(keep)
  }
  return out
}

export function buildEventDrafts(ctx: EventContext): { drafts: RowDraft[]; stats: EventStats } {
  const stats: EventStats = { cards: 0, cardDistributions: 0, classicTemplates: 0, classicDistributions: 0, titled: 0, untitled: 0, duplicatesMerged: 0 }
  const drafts = mergeDuplicates([...cardDrafts(ctx, stats), ...classicDrafts(ctx, stats)], stats)
  return { drafts, stats }
}
