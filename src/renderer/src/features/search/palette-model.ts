/**
 * What the command palette lists for a query: Pokémon and forms, then pages, then actions.
 * A pure function of its input, so the ranking and wording are testable without a DOM.
 */

import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import type { ThemeId } from '@shared/save-types'
import type { IconName } from '@renderer/components/ui/Icon'
import { activeLanguage, t, translate, type MessageKey } from '@renderer/i18n/runtime'
import { formFullName, speciesName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { normalizeText, searchDex } from '@renderer/lib/search'
import type { RecentRef } from './recent'

export const MAX_POKEMON_RESULTS = 7

export interface PalettePage {
  id: string
  label: string
  icon: IconName
  href: string
  /** Extra words the page answers to. */
  keywords?: string
}

export type PaletteActionId = 'log' | 'shiny' | 'theme' | 'motion'

export interface PokemonItem {
  kind: 'pokemon'
  id: string
  species: SpeciesSummary
  form: FormSummary
  /** "Raichu", or "Alolan Raichu" when the form's own name matched. */
  label: string
}

export interface PageItem extends PalettePage {
  kind: 'page'
}

export interface ActionItem {
  kind: 'action'
  id: string
  action: PaletteActionId
  label: string
  icon: IconName
  /** Current state, printed at the end of the row ("On", "Dark"). */
  hint?: string
  /** For `log`: the Pokémon the catch is for. */
  target?: { species: SpeciesSummary; form: FormSummary }
}

export type PaletteItem = PokemonItem | PageItem | ActionItem

export interface PaletteSection {
  id: 'pokemon' | 'recent' | 'pages' | 'actions'
  title: string
  items: PaletteItem[]
}

export interface PaletteInput {
  /** Null while the dataset is not available: pages and actions still work. */
  dex: Dex | null
  query: string
  recent: readonly RecentRef[]
  pages: readonly PalettePage[]
  shinyView: boolean
  theme: ThemeId
  reduceMotion: boolean
  /** The entry editor is already open; logging another catch from here would discard it. */
  editorOpen: boolean
}

/**
 * Every query word starts a word of `text` (in any order), or - from three letters on - the query
 * appears somewhere in it written together ("dex" finds "Pokédex").
 */
export function matchesWords(query: string, text: string): boolean {
  const tokens = normalizeText(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return true
  const words = normalizeText(text).split(' ').filter(Boolean)
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return true
  const compact = tokens.join('')
  return compact.length >= 3 && words.join('').includes(compact)
}

/** The form a catch can actually be logged as: battle-only states fall back to the base form. */
function loggable(species: SpeciesSummary, form: FormSummary): FormSummary {
  return form.cat === 'mega' || form.cat === 'battle' || form.cat === 'hidden' ? (species.forms[0] ?? form) : form
}

function pokemonItem(species: SpeciesSummary, form: FormSummary, ownName: boolean): PokemonItem {
  return { kind: 'pokemon', id: `pokemon-${species.id}-${form.f}`, species, form, label: ownName ? formFullName(species, form) : speciesName(species) }
}

function actionItems(input: PaletteInput, top: PokemonItem | undefined): ActionItem[] {
  const items: ActionItem[] = []
  if (top && !input.editorOpen) {
    const form = loggable(top.species, top.form)
    const name = form === top.form ? top.label : speciesName(top.species)
    items.push({ kind: 'action', id: 'action-log', action: 'log', icon: 'pokeball', label: t('search.action.log', { name }), target: { species: top.species, form } })
  }
  items.push(
    { kind: 'action', id: 'action-shiny', action: 'shiny', icon: 'sparkle', label: input.shinyView ? t('search.action.shiny.off') : t('search.action.shiny.on'), hint: input.shinyView ? t('search.hint.on') : t('search.hint.off') },
    { kind: 'action', id: 'action-theme', action: 'theme', icon: input.theme === 'dark' ? 'sun' : 'moon', label: input.theme === 'dark' ? t('search.action.theme.light') : t('search.action.theme.dark'), hint: input.theme === 'dark' ? t('search.hint.dark') : t('search.hint.light') },
    { kind: 'action', id: 'action-motion', action: 'motion', icon: 'motion', label: input.reduceMotion ? t('search.action.motion.off') : t('search.action.motion.on'), hint: input.reduceMotion ? t('search.hint.on') : t('search.hint.off') }
  )
  return items
}

function recentItems(dex: Dex | null, recent: readonly RecentRef[]): PokemonItem[] {
  const items: PokemonItem[] = []
  for (const ref of recent) {
    const species = dex?.species(ref.species)
    if (!species) continue
    const form = dex?.form(ref.species, ref.form) ?? species.forms[0]
    if (form) items.push(pokemonItem(species, form, form !== species.forms[0]))
  }
  return items
}

/** Words an action answers to besides its label (which changes with its state). */
const ACTION_KEYWORDS: Readonly<Record<PaletteActionId, MessageKey>> = {
  log: 'search.keywords.action.log',
  shiny: 'search.keywords.action.shiny',
  theme: 'search.keywords.action.theme',
  motion: 'search.keywords.action.motion'
}

/** The words of a keyword message in the active language and, in another language than English, the English ones too. */
function keywords(key: MessageKey): string {
  const words = t(key)
  return activeLanguage() === 'en' ? words : `${words} ${translate('en', key)}`
}

/**
 * The palette's sections, in display order; empty sections are left out.
 * - No query: recently opened Pokémon, every page, every action ("Log a catch" is for the most recent Pokémon).
 * - With a query: matching Pokémon and forms (best first), matching pages, then "Log a catch" for
 *   the top Pokémon plus any action whose wording matches.
 */
export function buildPalette(input: PaletteInput): PaletteSection[] {
  const { dex, query, recent, pages } = input
  const sections: PaletteSection[] = []
  const searching = normalizeText(query) !== ''

  if (!searching) {
    const recents = recentItems(dex, recent)
    if (recents.length > 0) sections.push({ id: 'recent', title: t('search.section.recent'), items: recents })
    sections.push({ id: 'pages', title: t('search.section.pages'), items: pages.map((page) => ({ kind: 'page', ...page })) })
    sections.push({ id: 'actions', title: t('search.section.actions'), items: actionItems(input, recents[0]) })
    return sections
  }

  const hits = dex ? searchDex(dex, query, { limit: MAX_POKEMON_RESULTS }) : []
  const pokemon = hits.map((hit) => pokemonItem(hit.species, hit.form, hit.viaForm))
  const matchingPages = pages.filter((page) => matchesWords(query, `${page.label} ${page.keywords ?? ''}`))

  // "Log a catch" follows the top Pokémon; typed on its own ("log") it is for the Pokémon opened last.
  const asksToLog = matchesWords(query, `${keywords('search.keywords.logPhrase')} ${keywords(ACTION_KEYWORDS.log)}`)
  // A weak match on a Pokémon name - a near-miss ("shiny" is one letter from Shinx) or letters
  // from its middle ("log" is inside Oinkologne) - must not outrank a page or an action that the
  // words match outright: it moves to the end and is not offered for logging.
  const toggles = actionItems(input, undefined).filter((item) => matchesWords(query, `${item.label} ${keywords(ACTION_KEYWORDS[item.action])}`))
  const lastOpened = asksToLog ? recentItems(dex, recent)[0] : undefined
  const weak = hits.length > 0 && hits.every((hit) => hit.rank === 'fuzzy' || hit.rank === 'substring')
  const guess = weak && (matchingPages.length > 0 || toggles.length > 0 || lastOpened !== undefined)
  const target = guess ? lastOpened : (pokemon[0] ?? lastOpened)
  const actions = actionItems(input, target).filter((item) => item.action === 'log' || toggles.some((t) => t.id === item.id))

  const pokemonSection: PaletteSection = { id: 'pokemon', title: t('search.section.pokemon'), items: pokemon }
  if (pokemon.length > 0 && !guess) sections.push(pokemonSection)
  if (matchingPages.length > 0) sections.push({ id: 'pages', title: t('search.section.pages'), items: matchingPages.map((page) => ({ kind: 'page', ...page })) })
  if (actions.length > 0) sections.push({ id: 'actions', title: t('search.section.actions'), items: actions })
  if (guess) sections.push(pokemonSection)
  return sections
}
