/**
 * The entry editor's working copy of a catch and the rules around it, as pure functions:
 * starting values from a preset or a saved entry, what a species / form / game allows, the
 * suggestions a game's sources offer for "method" and "location", light validation, and the
 * conversion back into what the save store takes.
 */

import type { EncounterRow, FormSummary, SpeciesDetail, SpeciesSummary } from '@shared/dex-types'
import type { CatchEntry, EntryGender, EntryKind } from '@shared/save-types'
import { rowGender, rowLocation, type GameSources } from '@renderer/domain/encounters'
import type { Dex } from '@renderer/lib/data'
import { isIsoDate, kindLabel, levelRange } from '@renderer/lib/format'
import type { EntryInput, EntryPatch } from '@renderer/store/save'
import type { EntryPreset } from '@renderer/store/ui'

// ---------------------------------------------------------------- the draft

/** Every field of the form. Text is kept as typed; "not set" is null (or "" for text). */
export interface Draft {
  species: number
  form: number
  variant: number | null
  /** "" until a game is chosen. */
  game: string
  kind: EntryKind
  method: string
  location: string
  origin: [number, number] | null
  ball: number | null
  gender: EntryGender | null
  shiny: boolean
  gmax: boolean
  alpha: boolean
  level: number | null
  /** ISO yyyy-mm-dd, or "". */
  date: string
  nickname: string
  ot: string
  notes: string
}

export interface DraftDefaults {
  trainerName: string
  /** Today as yyyy-mm-dd. */
  today: string
}

export const TEXT_LIMITS = { method: 120, location: 160, nickname: 40, ot: 40, notes: 4000 } as const

const GMAX_GAMES: ReadonlySet<string> = new Set(['sword', 'shield'])
const ALPHA_GAMES: ReadonlySet<string> = new Set(['legendsarceus', 'legendsza'])
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,39}$/

/** Forms a user can pick: everything except the hidden category. */
export function visibleForms(species: SpeciesSummary): FormSummary[] {
  return species.forms.filter((f) => f.cat !== 'hidden')
}

/** The form with that index, else the first one a user can pick. */
export function pickForm(species: SpeciesSummary, formIndex: number | undefined): FormSummary | undefined {
  return species.forms.find((f) => f.f === formIndex) ?? visibleForms(species)[0] ?? species.forms[0]
}

/** The genders this Pokémon can be. One element means there is no choice to make. */
export function genderChoices(species: SpeciesSummary | undefined, form: FormSummary | undefined): EntryGender[] {
  if (!species) return ['m', 'f', 'n']
  if (form?.gender !== undefined) return [form.gender]
  if (species.genderRate < 0) return ['n']
  if (species.genderRate === 0) return ['m']
  if (species.genderRate >= 8) return ['f']
  return ['m', 'f']
}

/** Gigantamax only exists in Sword and Shield, for forms that have a Gigantamax render. */
export function canGmax(form: FormSummary | undefined, gameId: string): boolean {
  return form?.gmax !== undefined && GMAX_GAMES.has(gameId)
}

/** Alpha Pokémon exist in Legends: Arceus and Legends: Z-A. */
export function canAlpha(gameId: string): boolean {
  return ALPHA_GAMES.has(gameId)
}

/**
 * Makes a draft consistent with its species, form and game after one of them changed: a variant
 * the form does not have, a gender the species cannot be, and Gigantamax / Alpha flags the game
 * does not know are dropped. Everything the user typed is kept.
 */
export function settleDraft(dex: Dex, draft: Draft): Draft {
  const species = dex.species(draft.species)
  if (!species) return draft
  const form = dex.form(draft.species, draft.form)
  const next = { ...draft }

  const variants = form?.variants ?? []
  if (variants.length === 0) next.variant = null
  else if (!variants.some((v) => v.id === next.variant)) next.variant = variants[0]!.id

  const genders = genderChoices(species, form)
  if (genders.length === 1) next.gender = genders[0]!
  else if (next.gender !== null && !genders.includes(next.gender)) next.gender = null

  if (next.gmax && !canGmax(form, next.game)) next.gmax = false
  if (next.alpha && !canAlpha(next.game)) next.alpha = false
  return next
}

/** Starting values for logging a new catch. Works with as little as `{ species, form }`. */
export function draftFromPreset(dex: Dex, preset: EntryPreset, defaults: DraftDefaults): Draft {
  const species = dex.species(preset.species)
  const form = species ? pickForm(species, preset.form) : undefined
  const draft: Draft = {
    species: preset.species,
    form: form?.f ?? (Number.isInteger(preset.form) ? preset.form : 0),
    variant: preset.variant ?? null,
    game: preset.game ?? '',
    kind: preset.kind ?? 'other',
    method: preset.method ?? '',
    location: preset.location ?? '',
    origin: preset.origin ? [preset.origin[0], preset.origin[1]] : null,
    ball: preset.ball ?? null,
    gender: preset.gender ?? null,
    shiny: preset.shiny === true,
    gmax: preset.gmax === true,
    alpha: preset.alpha === true,
    level: preset.level ?? null,
    date: preset.date !== undefined && isIsoDate(preset.date) ? preset.date : defaults.today,
    nickname: preset.nickname ?? '',
    ot: preset.ot ?? defaults.trainerName,
    notes: preset.notes ?? ''
  }
  return settleDraft(dex, draft)
}

/** The draft of an existing entry, exactly as it was saved. */
export function draftFromEntry(entry: CatchEntry): Draft {
  return {
    species: entry.species,
    form: entry.form,
    variant: entry.variant ?? null,
    game: entry.game,
    kind: entry.kind,
    method: entry.method ?? '',
    location: entry.location ?? '',
    origin: entry.origin ? [entry.origin[0], entry.origin[1]] : null,
    ball: entry.ball ?? null,
    gender: entry.gender ?? null,
    shiny: entry.shiny,
    gmax: entry.gmax === true,
    alpha: entry.alpha === true,
    level: entry.level ?? null,
    date: entry.date ?? '',
    nickname: entry.nickname ?? '',
    ot: entry.ot ?? '',
    notes: entry.notes ?? ''
  }
}

/** After "Save and log another game": the same Pokémon, with everything that belongs to one catch cleared. */
export function draftForAnotherGame(dex: Dex, draft: Draft, defaults: DraftDefaults): Draft {
  return settleDraft(dex, {
    ...draft,
    game: '',
    kind: 'other',
    method: '',
    location: '',
    origin: null,
    ball: null,
    gender: null,
    shiny: false,
    gmax: false,
    alpha: false,
    level: null,
    date: defaults.today,
    nickname: '',
    ot: defaults.trainerName,
    notes: ''
  })
}

export function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const text = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** The draft as a new entry: unset fields are left out. */
export function draftToInput(draft: Draft): EntryInput {
  const patch = draftToPatch(draft)
  const input: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) input[key] = value
  return input as unknown as EntryInput
}

/** The draft as a change to an existing entry: unset fields are present as `undefined`, which clears them. */
export function draftToPatch(draft: Draft): EntryPatch & Pick<EntryInput, 'species' | 'form' | 'game' | 'kind' | 'shiny'> {
  return {
    species: draft.species,
    form: draft.form,
    variant: draft.variant ?? undefined,
    gender: draft.gender ?? undefined,
    shiny: draft.shiny,
    gmax: draft.gmax ? true : undefined,
    alpha: draft.alpha ? true : undefined,
    game: draft.game,
    kind: draft.kind,
    method: text(draft.method),
    location: text(draft.location),
    origin: draft.origin ? [draft.origin[0], draft.origin[1]] : undefined,
    ball: draft.ball ?? undefined,
    level: draft.level ?? undefined,
    date: text(draft.date),
    nickname: text(draft.nickname),
    ot: text(draft.ot),
    notes: text(draft.notes)
  }
}

/** A stand-in entry for the live preview card. */
export function draftToPreview(draft: Draft, now: string): CatchEntry {
  return { ...draftToInput(draft), id: 'entry-preview', createdAt: now, updatedAt: now }
}

// ---------------------------------------------------------------- validation

export interface DraftErrors {
  species?: string
  form?: string
  game?: string
  level?: string
  date?: string
}

export interface ValidateOptions {
  today: string
  /** The saved entry being edited: values it already had are not second-guessed. */
  original?: Pick<CatchEntry, 'species' | 'form' | 'game'>
}

/** Species, form and game are required; a level or date that is filled in has to make sense. */
export function validateDraft(dex: Dex, draft: Draft, options: ValidateOptions): DraftErrors {
  const errors: DraftErrors = {}
  const { original } = options
  const species = dex.species(draft.species)
  const keptSpecies = original !== undefined && original.species === draft.species
  if (!species && !keptSpecies) errors.species = 'Choose a Pokémon.'
  if (species && !dex.form(draft.species, draft.form) && !(keptSpecies && original.form === draft.form)) errors.form = 'Choose a form.'
  if (draft.game === '') errors.game = 'Choose the game you got it in.'
  else if (!GAME_ID.test(draft.game) && original?.game !== draft.game) errors.game = 'Choose a game from the list.'
  if (draft.level !== null && (!Number.isInteger(draft.level) || draft.level < 1 || draft.level > 100)) errors.level = 'Use a whole number from 1 to 100.'
  if (draft.date !== '') {
    if (!isIsoDate(draft.date)) errors.date = 'Enter a real date.'
    else if (draft.date > options.today) errors.date = 'The date cannot be in the future.'
  }
  return errors
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0
}

// ---------------------------------------------------------------- suggestions

/** One way the chosen game offers this form, reduced to what the form fields need. */
export interface Suggestion {
  key: string
  kind: EntryKind
  /** "" when the source has no method label. */
  method: string
  /** "" when the source has no place. */
  location: string
  /** Envelope of the level ranges, null when unknown. */
  levels: [number, number] | null
  /** Set when every merged row agrees. */
  shiny?: 'locked' | 'forced'
  ball?: number
  gender?: EntryGender
  /** Every merged row is an Alpha. */
  alpha: boolean
  ot?: string
  origin?: [number, number]
}

const BRED_METHOD = 'Hatched from an Egg'

function mergeRow(into: Suggestion, row: EncounterRow, first: boolean): void {
  const [min, max] = row.lv
  if (max > 0 || min > 0) {
    const lo = min > 0 ? min : max
    const hi = max > 0 ? max : min
    into.levels = into.levels ? [Math.min(into.levels[0], lo), Math.max(into.levels[1], hi)] : [lo, hi]
  }
  const gender = rowGender(row)
  const alpha = row.c?.includes('Alpha') === true
  if (first) {
    if (row.s !== undefined) into.shiny = row.s
    if (row.b !== undefined) into.ball = row.b
    if (gender !== undefined) into.gender = gender
    if (row.x?.ot !== undefined) into.ot = row.x.ot
    into.alpha = alpha
    return
  }
  // A fixed property only stays when every row of the group has it.
  if (into.shiny !== row.s) delete into.shiny
  if (into.ball !== row.b) delete into.ball
  if (into.gender !== gender) delete into.gender
  if (into.ot !== row.x?.ot) delete into.ot
  if (!alpha) into.alpha = false
}

/**
 * The sources of one game as suggestions, one per distinct kind + method + place (rows that only
 * differ in time of day or level are merged), then evolutions and form changes, then breeding.
 */
export function buildSuggestions(detail: SpeciesDetail, sources: Pick<GameSources, 'rows' | 'evolve' | 'breed'> | undefined): Suggestion[] {
  if (!sources) return []
  const out: Suggestion[] = []
  const byKey = new Map<string, Suggestion>()
  for (const row of sources.rows) {
    const method = row.m ?? ''
    const location = rowLocation(detail, row) ?? ''
    const key = `${row.k}|${method}|${location}`
    const existing = byKey.get(key)
    if (existing) {
      mergeRow(existing, row, false)
      continue
    }
    const fresh: Suggestion = { key, kind: row.k, method, location, levels: null, alpha: false }
    mergeRow(fresh, row, true)
    byKey.set(key, fresh)
    out.push(fresh)
  }
  for (const source of sources.evolve) {
    const key = `evolved|${source.how}||${source.from[0]}-${source.from[1]}`
    if (byKey.has(key)) continue
    const fresh: Suggestion = { key, kind: 'evolved', method: source.how, location: '', levels: null, alpha: false, origin: [source.from[0], source.from[1]] }
    byKey.set(key, fresh)
    out.push(fresh)
  }
  if (sources.breed) out.push({ key: `bred|${BRED_METHOD}|`, kind: 'bred', method: BRED_METHOD, location: '', levels: [1, 1], alpha: false })
  return out
}

const sameOrigin = (a: [number, number] | null | undefined, b: [number, number] | null | undefined): boolean => (a ? b != null && a[0] === b[0] && a[1] === b[1] : b == null)

/** The suggestion the draft currently describes (same kind, method and place), if any. */
export function matchSuggestion(suggestions: readonly Suggestion[], draft: Pick<Draft, 'kind' | 'method' | 'location' | 'origin'>): Suggestion | null {
  const method = draft.method.trim()
  const location = draft.location.trim()
  const hits = suggestions.filter((s) => s.kind === draft.kind && s.method === method && s.location === location)
  if (hits.length <= 1) return hits[0] ?? null
  return hits.find((s) => s.origin !== undefined && sameOrigin(s.origin, draft.origin)) ?? hits[0]!
}

/** What a method option stands for: every suggestion with that kind and method. */
export interface MethodOption {
  key: string
  kind: EntryKind
  method: string
  /** Text shown and written into the field. */
  label: string
  places: string[]
  levels: [number, number] | null
  /** One of its suggestions is at the place currently typed. */
  here: boolean
}

export function methodOptions(suggestions: readonly Suggestion[], location: string): MethodOption[] {
  const here = location.trim()
  const byKey = new Map<string, MethodOption>()
  for (const s of suggestions) {
    const key = `${s.kind}|${s.method}`
    let option = byKey.get(key)
    if (!option) byKey.set(key, (option = { key, kind: s.kind, method: s.method, label: s.method === '' ? kindLabel(s.kind) : s.method, places: [], levels: null, here: false }))
    if (s.location !== '') option.places.push(s.location)
    if (s.levels) option.levels = option.levels ? [Math.min(option.levels[0], s.levels[0]), Math.max(option.levels[1], s.levels[1])] : [s.levels[0], s.levels[1]]
    if (here !== '' && s.location === here) option.here = true
  }
  const all = [...byKey.values()]
  return [...all.filter((o) => o.here), ...all.filter((o) => !o.here)]
}

export interface LocationOption {
  location: string
  /** Method labels available there. */
  methods: string[]
  /** The method currently chosen is available there. */
  fits: boolean
}

export function locationOptions(suggestions: readonly Suggestion[], kind: EntryKind, method: string): LocationOption[] {
  const want = method.trim()
  const byPlace = new Map<string, LocationOption>()
  for (const s of suggestions) {
    if (s.location === '') continue
    let option = byPlace.get(s.location)
    if (!option) byPlace.set(s.location, (option = { location: s.location, methods: [], fits: false }))
    const label = s.method === '' ? kindLabel(s.kind) : s.method
    if (!option.methods.includes(label)) option.methods.push(label)
    if (s.kind === kind && s.method === want) option.fits = true
  }
  const all = [...byPlace.values()]
  return [...all.filter((o) => o.fits), ...all.filter((o) => !o.fits)]
}

export interface ApplyContext {
  trainerName: string
}

/** Clears values that only the previously matching source put there. */
function release(draft: Draft, previous: Suggestion | null, context: ApplyContext): Draft {
  if (!previous) return draft
  const next = { ...draft }
  if (previous.ball !== undefined && next.ball === previous.ball) next.ball = null
  if (previous.gender !== undefined && next.gender === previous.gender) next.gender = null
  if (previous.shiny === 'forced' && next.shiny) next.shiny = false
  if (previous.alpha && next.alpha) next.alpha = false
  if (previous.levels && previous.levels[0] === previous.levels[1] && next.level === previous.levels[0]) next.level = null
  if (previous.ot !== undefined && next.ot === previous.ot) next.ot = context.trainerName
  if (previous.origin && sameOrigin(previous.origin, next.origin)) next.origin = null
  return next
}

/**
 * Fills the draft from a suggestion: kind, method and place together, plus whatever the source
 * fixes (ball, gender, always-shiny, Alpha, a single level, the event's OT, what it evolved from).
 * Values the previous source had forced are taken back first, so they do not linger.
 */
export function applySuggestion(draft: Draft, suggestion: Suggestion, previous: Suggestion | null, context: ApplyContext): Draft {
  const next: Draft = { ...release(draft, previous, context) }
  next.kind = suggestion.kind
  next.method = suggestion.method
  next.location = suggestion.location
  if (suggestion.ball !== undefined) next.ball = suggestion.ball
  if (suggestion.gender !== undefined) next.gender = suggestion.gender
  if (suggestion.shiny === 'forced') next.shiny = true
  if (suggestion.alpha && canAlpha(next.game)) next.alpha = true
  if (suggestion.levels && suggestion.levels[0] === suggestion.levels[1]) next.level = suggestion.levels[0]
  if (suggestion.ot !== undefined) next.ot = suggestion.ot
  if (suggestion.origin) next.origin = [suggestion.origin[0], suggestion.origin[1]]
  return next
}

/**
 * The user picked a method from the list. When that pins down one source (it only exists in one
 * place, or at the place already typed) the whole source is applied; otherwise only the kind and
 * method are set and the place stays open.
 */
export function chooseMethod(draft: Draft, suggestions: readonly Suggestion[], option: Pick<MethodOption, 'kind' | 'method'>, context: ApplyContext): Draft {
  const previous = matchSuggestion(suggestions, draft)
  const candidates = suggestions.filter((s) => s.kind === option.kind && s.method === option.method)
  const here = draft.location.trim()
  const exact = (here !== '' ? candidates.find((s) => s.location === here) : undefined) ?? (candidates.length === 1 ? candidates[0] : undefined)
  if (exact) return applySuggestion(draft, exact, previous, context)
  const next = { ...release(draft, previous, context), kind: option.kind, method: option.method }
  // A place that came from a source elsewhere would now be misleading.
  if (here !== '' && suggestions.some((s) => s.location === here)) next.location = ''
  return next
}

/** The user picked a place from the list; the mirror image of `chooseMethod`. */
export function chooseLocation(draft: Draft, suggestions: readonly Suggestion[], location: string, context: ApplyContext): Draft {
  const previous = matchSuggestion(suggestions, draft)
  const candidates = suggestions.filter((s) => s.location === location)
  const method = draft.method.trim()
  const exact = candidates.find((s) => s.kind === draft.kind && s.method === method) ?? (candidates.length === 1 ? candidates[0] : undefined)
  if (exact) return applySuggestion(draft, exact, previous, context)
  return { ...release(draft, previous, context), location }
}

/** The kind a manual entry starts with: how the game usually hands this Pokémon out. */
export function defaultKind(state: 'obtainable' | 'event' | 'transfer' | 'absent' | null, suggestions: readonly Suggestion[]): EntryKind {
  if (state === 'transfer') return 'transfer'
  if (state === null || state === 'absent') return 'other'
  return suggestions[0]?.kind ?? 'other'
}

/** "Lv. 15–20" for the matched source, "" when it says nothing. */
export function levelHint(suggestion: Suggestion | null): string {
  return suggestion?.levels ? levelRange(suggestion.levels) : ''
}

/** True when a filled-in level falls outside what the matched source hands out. */
export function levelOutside(suggestion: Suggestion | null, level: number | null): boolean {
  if (!suggestion?.levels || level === null) return false
  return level < suggestion.levels[0]
}
