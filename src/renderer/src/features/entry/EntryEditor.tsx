import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { GAME_BY_ID, GAMES } from '@shared/games'
import { MAX_EV, MAX_IV, type CatchEntry, type EntryGender, type EntryKind } from '@shared/save-types'
import { GameIcon, GenderIcon, ShinyMark, Sprite } from '@renderer/components/pokemon'
import { Button, Checkbox, Combobox, cx, DateField, Dialog, Icon, Kbd, NumberField, SegmentedControl, Select, Switch, TextArea, TextField, type SelectOption } from '@renderer/components/ui'
import { describeEntry } from '@renderer/domain/entries'
import { sourcesByGame } from '@renderer/domain/encounters'
import { generationName } from '@renderer/domain/generation'
import { gameState, isBattleOnly, type GameState } from '@renderer/features/species/sources'
import { useSpeciesDetailRetry } from '@renderer/features/species/hooks'
import { rich, useT } from '@renderer/i18n'
import { formFullName, formLabel, gameName, gameShortName, locationName, speciesName, variantName } from '@renderer/i18n/terms'
import { shake } from '@renderer/lib/anim'
import type { Dex } from '@renderer/lib/data'
import { deleteEntryWithUndo, duplicateEntryWithToast } from '@renderer/lib/entry-actions'
import { dexNo, ENTRY_KINDS, errorMessage, formatDate, genderLabel, kindLabel, levelRange, shownMethod, todayIso } from '@renderer/lib/format'
import { getDexSearch } from '@renderer/lib/search'
import { resolveEntrySprite } from '@renderer/lib/sprites'
import { navigate, paths } from '@renderer/shell/router'
import { useSaveStore, useSettings } from '@renderer/store/save'
import { toast, useUiStore, type EntryEditorState } from '@renderer/store/ui'
import { BallPicker } from './BallPicker'
import { CapturePreview, type CaptureHandle } from './CapturePreview'
import {
  abilityOptions,
  applySuggestion,
  buildSuggestions,
  canAlpha,
  canGmax,
  chooseLocation,
  chooseMethod,
  defaultKind,
  draftForAnotherGame,
  draftFromEntry,
  draftFromPreset,
  draftToInput,
  draftToPatch,
  draftToPreview,
  genderChoices,
  hasErrors,
  hasValues,
  levelHint,
  levelOutside,
  locationOptions,
  matchSuggestion,
  methodOptions,
  pickForm,
  sameDraft,
  settleDraft,
  STAT_IDS,
  statLabel,
  TEXT_LIMITS,
  validateDraft,
  visibleForms,
  type Draft,
  type DraftDefaults,
  type StatBoxes
} from './draft'
import './EntryEditor.css'

export type EditorRequest = Extract<EntryEditorState, { open: true }>

export interface EntryEditorProps {
  dex: Dex
  request: EditorRequest
  /** False while the dialog plays its exit. */
  open: boolean
}

type FocusField = 'species' | 'game' | 'method' | 'ball' | 'nickname'

const UNSET = 'unset'
const NO_ORIGIN = 'none'
const KINDS_WITHOUT_PLACE: ReadonlySet<EntryKind> = new Set(['evolved', 'bred', 'transfer', 'other'])

function firstFocus(draft: Draft, speciesKnown: boolean): FocusField {
  if (!speciesKnown) return 'species'
  if (draft.game === '') return 'game'
  if (draft.method === '' && draft.location === '' && !KINDS_WITHOUT_PLACE.has(draft.kind)) return 'method'
  if (draft.ball === null) return 'ball'
  return 'nickname'
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="ee-group">
      <legend className="ee-group__title u-eyebrow">{title}</legend>
      <div className="ee-grid">{children}</div>
    </fieldset>
  )
}

/** Six small number boxes for one value per stat, with one message under the row. */
function StatRow({ name, max, value, onChange, error }: { name: string; max: number; value: StatBoxes; onChange: (value: StatBoxes) => void; error?: string }) {
  const t = useT()
  return (
    <div className="ui-field ee-span" role="group" aria-label={name}>
      <span className="ui-field__label">
        {name}
        <span className="ui-field__optional">{t('entry.stat.range', { max: String(max) })}</span>
      </span>
      <div className="ee-stats">
        {STAT_IDS.map((stat, i) => (
          <NumberField
            key={stat}
            size="sm"
            steppers={false}
            label={statLabel(stat, true)}
            aria-label={t('entry.stat.box', { group: name, stat: statLabel(stat) })}
            value={value[i] ?? null}
            onChange={(v) => onChange(STAT_IDS.map((_, j) => (j === i ? v : (value[j] ?? null))))}
            min={0}
            max={max}
            placeholder="–"
            className={cx(error !== undefined && value[i] == null && 'is-invalid')}
          />
        ))}
      </div>
      {error !== undefined && (
        <div className="ui-field__hint is-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * The entry editor: logs a new catch (from a source of the Pokémon page, from a Living Dex slot,
 * or by hand) or edits a saved one, with a live preview of the entry card.
 */
export function EntryEditor({ dex, request, open }: EntryEditorProps) {
  const t = useT()
  const uid = useId()
  const [path] = useLocation()
  const settings = useSettings()
  const editing = request.mode === 'edit'

  // Captured when the editor opens: later changes to the save must not rewrite the form under the user.
  const [original] = useState<CatchEntry | null>(() => (request.mode === 'edit' ? (useSaveStore.getState().save.entries.find((e) => e.id === request.entryId) ?? null) : null))
  const [defaults] = useState<DraftDefaults>(() => ({ trainerName: settings.trainerName, today: todayIso() }))
  const [baseline, setBaseline] = useState<Draft>(() => (original ? draftFromEntry(original) : request.mode === 'create' ? draftFromPreset(dex, request.preset, defaults) : draftFromPreset(dex, { species: 0, form: 0 }, defaults)))
  const [draft, setDraft] = useState<Draft>(baseline)
  // Until the user says how they got it, a manual entry follows what the chosen game usually offers.
  const [autoKind, setAutoKind] = useState(() => request.mode === 'create' && request.preset.kind === undefined)
  const [showErrors, setShowErrors] = useState(false)
  // PID, IVs and EVs stay folded away until asked for, unless the entry has some.
  const [valuesOpen, setValuesOpen] = useState(() => hasValues(baseline))
  const [confirming, setConfirming] = useState(false)
  // The method and location the user typed themselves in this editor: shown as typed, never translated.
  const [typedMethod, setTypedMethod] = useState<string | null>(null)
  const [typedLocation, setTypedLocation] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  // After "Save and log another game": what was just saved, said inside the dialog (a toast would sit on the buttons).
  const [savedNote, setSavedNote] = useState<string | null>(null)
  // The Pokémon box was emptied to search for another one; nothing is chosen until one is picked.
  const [speciesCleared, setSpeciesCleared] = useState(false)
  // Logged straight from a source: the Pokémon is a given.
  const speciesLocked = request.mode === 'create' && request.preset.kind !== undefined && request.preset.game !== undefined && dex.species(request.preset.species) !== undefined

  const formRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<HTMLElement | null>(null)
  const captureRef = useRef<CaptureHandle>(null)
  const lastSaved = useRef<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set the moment a save starts, so a second press cannot log the same catch twice.
  const saving = useRef(false)

  const ids = { species: `${uid}-species`, game: `${uid}-game`, method: `${uid}-method`, location: `${uid}-location`, nickname: `${uid}-nickname`, level: `${uid}-level`, pid: `${uid}-pid`, values: `${uid}-values` }

  // ---------------------------------------------------------------- what the draft refers to

  const species = dex.species(draft.species)
  const form = species ? dex.form(draft.species, draft.form) : undefined
  const game = draft.game !== '' ? GAME_BY_ID.get(draft.game) : undefined
  const state: GameState | null = form && draft.game !== '' ? gameState(dex, form, draft.game) : null
  const detail = useSpeciesDetailRetry(species ? species.id : null)
  const gameSources = useMemo(() => (detail.data && form && draft.game !== '' ? sourcesByGame(dex, detail.data, form).find((s) => s.game.id === draft.game) : undefined), [dex, detail.data, form, draft.game])
  const suggestions = useMemo(() => (detail.data ? buildSuggestions(detail.data, gameSources) : []), [detail.data, gameSources])
  const matched = useMemo(
    () => matchSuggestion(suggestions, { kind: draft.kind, method: draft.method, location: draft.location, origin: draft.origin }),
    [suggestions, draft.kind, draft.method, draft.location, draft.origin]
  )
  const context = useMemo(() => ({ trainerName: defaults.trainerName }), [defaults.trainerName])

  const waitingForSources = draft.game !== '' && species !== undefined && detail.loading
  useEffect(() => {
    if (!autoKind || waitingForSources) return
    // A Mega Evolution or other battle-only form is in the game without ever being transferred there.
    const kind = defaultKind(state === 'transfer' && form && isBattleOnly(form) ? null : state, suggestions)
    setDraft((d) => (d.kind === kind ? d : { ...d, kind }))
    setBaseline((b) => (b.kind === kind ? b : { ...b, kind }))
  }, [autoKind, waitingForSources, state, suggestions, form])

  // ---------------------------------------------------------------- closing

  const dirty = !sameDraft(draft, baseline)

  const finishClose = useCallback(() => {
    const ui = useUiStore.getState()
    if (lastSaved.current !== null) ui.setLastCapture(lastSaved.current)
    lastSaved.current = null
    ui.closeEditor()
  }, [])

  const requestClose = (): void => {
    if (busy) return
    if (dirty) setConfirming(true)
    else finishClose()
  }

  // Replaced or torn down mid-save: the catch is in the save, so it still gets its celebration.
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current)
      if (lastSaved.current !== null) useUiStore.getState().setLastCapture(lastSaved.current)
    },
    []
  )

  // An entry that is gone (deleted from another place) cannot be edited.
  const reportedGone = useRef(false)
  useEffect(() => {
    if (!editing || original || reportedGone.current) return
    reportedGone.current = true
    toast({ kind: 'error', title: t('entry.toast.gone.title'), body: t('entry.toast.gone.body') })
    useUiStore.getState().closeEditor()
  }, [editing, original])

  // ---------------------------------------------------------------- saving

  const today = todayIso()
  const errors = useMemo(() => {
    const found = validateDraft(dex, draft, { today, original: original ?? undefined })
    return speciesCleared ? { species: t('entry.error.species'), ...found } : found
  }, [dex, draft, today, original, speciesCleared])
  const shownErrors = showErrors ? errors : {}

  const announce = (entry: CatchEntry): void => {
    const view = describeEntry(dex, entry)
    const name = entry.shiny ? t('lib.entry.shinyName', { name: view.name }) : view.name
    const where = entry.location !== undefined && entry.location !== '' ? locationName(entry.location) : undefined
    const inGame = view.game ? gameName(view.game.id) : undefined
    const onItsPage = path === `/dex/${entry.species}`
    toast({
      kind: 'success',
      title: t('entry.toast.registered', { name }),
      body: inGame !== undefined && where !== undefined ? t('entry.toast.where', { game: inGame, location: where }) : (inGame ?? where),
      icon: 'pokeball',
      ...(onItsPage ? {} : { action: { label: t('entry.toast.view'), onSelect: () => navigate(paths.species(entry.species, entry.form)) } })
    })
  }

  const save = (another: boolean): void => {
    if (busy || !open || saving.current) return
    if (hasErrors(errors)) {
      setShowErrors(true)
      shake(formRef.current)
      if (errors.pid ?? errors.ivs ?? errors.evs) setValuesOpen(true)
      const firstInvalid = errors.species ? ids.species : errors.game ? ids.game : errors.level ? ids.level : errors.pid ? ids.pid : undefined
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }
    const store = useSaveStore.getState()
    saving.current = true
    try {
      if (original) {
        const updated = store.updateEntry(original.id, draftToPatch(draft))
        if (!updated) {
          toast({ kind: 'error', title: t('entry.toast.gone.title'), body: t('entry.toast.gone.bodySaving') })
        } else {
          toast({ kind: 'success', title: t('entry.toast.saved'), body: t('lib.entry.summary', { who: describeEntry(dex, updated).name, game: GAME_BY_ID.has(updated.game) ? gameName(updated.game) : t('lib.entry.unknownGame') }), icon: 'check' })
        }
        useUiStore.getState().closeEditor()
        return
      }
      // The entry is in the save before anything moves; the animation is only a flourish.
      const entry = store.addEntry(draftToInput(draft))
      lastSaved.current = entry.id
      const wait = captureRef.current?.play() ?? 0
      const after = (): void => {
        closeTimer.current = null
        if (!another) {
          announce(entry)
          finishClose()
          return
        }
        captureRef.current?.reset()
        setSavedNote(GAME_BY_ID.has(entry.game) ? t('entry.saved.note', { name: describeEntry(dex, entry).name, game: gameName(entry.game) }) : t('entry.saved.noteUnknownGame', { name: describeEntry(dex, entry).name }))
        const next = draftForAnotherGame(dex, draft, { trainerName: defaults.trainerName, today: todayIso() })
        setDraft(next)
        setBaseline(next)
        setAutoKind(true)
        setShowErrors(false)
        setSavedCount((n) => n + 1)
        setBusy(false)
        saving.current = false
        requestAnimationFrame(() => document.getElementById(ids.game)?.focus())
      }
      if (wait <= 0) after()
      else {
        setBusy(true)
        closeTimer.current = setTimeout(after, wait)
      }
    } catch (err) {
      saving.current = false
      toast({ kind: 'error', title: t('entry.toast.failed'), body: errorMessage(err) })
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (!open || confirming) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) saveRef.current(false)
      }
    }
    // Capture phase: an open list inside the dialog must not swallow the shortcut.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, confirming])

  const duplicate = (): void => {
    if (!original || busy) return
    if (dirty) {
      if (hasErrors(errors)) {
        setShowErrors(true)
        shake(formRef.current)
        return
      }
      try {
        useSaveStore.getState().updateEntry(original.id, draftToPatch(draft))
      } catch (err) {
        toast({ kind: 'error', title: t('entry.toast.failed'), body: errorMessage(err) })
        return
      }
    }
    const copy = duplicateEntryWithToast(original.id)
    if (copy) useUiStore.getState().openEdit(copy.id)
  }

  // ---------------------------------------------------------------- first focus

  const [focusField] = useState<FocusField>(() => firstFocus(draft, species !== undefined))
  useLayoutEffect(() => {
    const root = formRef.current
    if (!root) return
    const byId: Record<Exclude<FocusField, 'ball'>, string> = { species: ids.species, game: ids.game, method: ids.method, nickname: ids.nickname }
    focusRef.current = focusField === 'ball' ? root.querySelector<HTMLElement>('[data-ee-balls] [role="radio"][tabindex="0"]') : document.getElementById(byId[focusField])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------- field options

  const patch = (changes: Partial<Draft>): void => setDraft((d) => ({ ...d, ...changes }))

  const searchCache = useRef<{ query: string; ids: Set<number> } | null>(null)
  const speciesFilter = useCallback(
    (option: SelectOption<number>, query: string): boolean => {
      let hit = searchCache.current
      if (!hit || hit.query !== query) {
        hit = { query, ids: new Set(getDexSearch(dex).speciesIds(query)) }
        searchCache.current = hit
      }
      return hit.ids.has(option.value)
    },
    [dex]
  )
  const speciesOptions = useMemo<SelectOption<number>[]>(
    () => (speciesLocked ? [] : dex.speciesList.map((s) => ({ value: s.id, label: speciesName(s), description: dexNo(s.id), keywords: String(s.id), icon: <Sprite species={s} size={26} /> }))),
    [dex, speciesLocked]
  )

  const formOptions = useMemo<SelectOption<number>[]>(() => {
    if (!species) return []
    const list = visibleForms(species)
    if (form && !list.includes(form)) list.push(form)
    return list.map((f) => ({ value: f.f, label: f.cat === 'base' && f.name !== '' ? t('entry.form.named', { name: formFullName(species, f), form: formLabel(species, f) }) : formFullName(species, f), icon: <Sprite species={species} form={f} size={26} /> }))
  }, [species, form])

  const variantOptions = useMemo<SelectOption<number>[]>(
    () => (species && form?.variants ? form.variants.map((v) => ({ value: v.id, label: variantName(species, form, v.id) ?? v.name, icon: <Sprite species={species} form={form} variant={v.id} size={26} /> })) : []),
    [species, form]
  )

  const gameOptions = useMemo<SelectOption<string>[]>(() => {
    const here: SelectOption<string>[] = []
    const rest: SelectOption<string>[] = []
    for (const g of GAMES) {
      const s = form ? gameState(dex, form, g.id) : null
      // Short names ("Scarlet") so typing ranks by how players say them; the full title still matches, and so do the English names.
      const option: SelectOption<string> = { value: g.id, label: gameShortName(g.id), keywords: `${gameName(g.id)} ${g.name}`, icon: <GameIcon game={g} size={22} tooltip={false} alt="" /> }
      if (s === 'obtainable' || s === 'event') {
        here.push({ ...option, group: t('entry.game.groupHere'), description: s === 'event' ? <span className="ee-opt ee-opt--event">{t('entry.game.eventOnly')}</span> : <span className="ee-opt ee-opt--ok">{t('entry.game.obtainable')}</span> })
      } else {
        rest.push({ ...option, group: g.generation >= 1 && g.generation <= 9 ? generationName(g.generation) : t('entry.game.groupOther'), description: s === 'transfer' ? t('entry.game.transferOnly') : undefined })
      }
    }
    const all = [...here, ...rest]
    // An old entry may carry a game this version does not know; it stays selectable as it is.
    if (draft.game !== '' && !GAME_BY_ID.has(draft.game)) all.unshift({ value: draft.game, label: t('lib.entry.unknownGame'), description: draft.game, icon: <Icon name="help" size={18} /> })
    return all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dex, form, draft.game])

  const kindOptions = useMemo<SelectOption<EntryKind>[]>(() => ENTRY_KINDS.map((k) => ({ value: k, label: kindLabel(k) })), [])

  const methods = useMemo(() => methodOptions(suggestions, draft.location), [suggestions, draft.location])
  const methodSelect = useMemo<SelectOption<string>[]>(() => {
    const anyHere = methods.some((m) => m.here)
    const place = draft.location.trim()
    return methods.map((m) => ({
      value: m.key,
      label: m.label,
      // The English label too, so a method is found by either name.
      keywords: `${kindLabel(m.kind)} ${m.method}`,
      group: anyHere ? (m.here ? t('entry.method.groupHere', { place: locationName(place) }) : t('entry.method.groupElsewhere')) : undefined,
      description: m.places.length === 0 ? levelRange(m.levels) || undefined : m.places.length === 1 ? locationName(m.places[0]!) : t('entry.method.places', { count: m.places.length })
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods, draft.location])
  const methodKey = `${draft.kind}|${draft.method.trim()}`
  const methodValue = methods.some((m) => m.key === methodKey) && (draft.method.trim() !== '' || matched !== null) ? methodKey : null

  const places = useMemo(() => locationOptions(suggestions, draft.kind, draft.method), [suggestions, draft.kind, draft.method])
  const placeSelect = useMemo<SelectOption<string>[]>(() => {
    const anyFit = places.some((p) => p.fits)
    const how = draft.method.trim() !== '' ? shownMethod(draft.method.trim()) : kindLabel(draft.kind)
    return places.map((p) => ({
      value: p.location,
      label: locationName(p.location),
      // The English name too, so a place is found by either name.
      keywords: p.location,
      group: anyFit ? (p.fits ? t('entry.location.groupFits', { method: how }) : t('entry.location.groupOther')) : undefined,
      description: p.methods.length === 2 ? t('entry.location.twoMethods', { first: p.methods[0]!, second: p.methods[1]! }) : p.methods.length < 2 ? p.methods[0] : t('entry.location.ways', { count: p.methods.length })
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, draft.kind, draft.method])
  const placeValue = places.some((p) => p.location === draft.location.trim()) ? draft.location.trim() : null

  const originOptions = useMemo<SelectOption<string>[]>(() => {
    const out: SelectOption<string>[] = [{ value: NO_ORIGIN, label: t('entry.notSet') }]
    const seen = new Set<string>()
    const add = (s: number, f: number): void => {
      const key = `${s}-${f}`
      if (seen.has(key) || (s === draft.species && f === draft.form)) return
      const originForm = dex.form(s, f)
      if (!originForm || (originForm.cat === 'hidden' && !(draft.origin && draft.origin[0] === s && draft.origin[1] === f))) return
      seen.add(key)
      out.push({ value: key, label: formFullName(s, originForm), icon: <Sprite species={s} form={f} size={26} /> })
    }
    if (detail.data) for (const node of detail.data.family) add(node.s, node.f)
    else if (species) for (const member of dex.familyMembers(species.family)) add(member.id, member.forms[0]?.f ?? 0)
    if (species) for (const f of visibleForms(species)) add(species.id, f.f)
    if (draft.origin) add(draft.origin[0], draft.origin[1])
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dex, detail.data, species, draft.species, draft.form, draft.origin])

  const genders = genderChoices(species, form)
  const genderOptions = useMemo(
    () => [
      ...genders.map((g) => ({ value: g as string, label: genderLabel(g), icon: <GenderIcon gender={g} size={14} /> })),
      { value: UNSET, label: t('entry.notSet') }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [genders.join('')]
  )
  const genderFixed = matched?.gender !== undefined && draft.gender === matched.gender

  const showGmax = canGmax(form, draft.game) || draft.gmax
  const showAlpha = canAlpha(draft.game) || draft.alpha
  const showOrigin = draft.kind === 'evolved' || draft.origin !== null
  const legalBalls = draft.game !== '' ? dex.ballsFor(draft.game) : []

  // ---------------------------------------------------------------- field handlers

  const changeSpecies = (id: number | null): void => {
    if (id === null) return setSpeciesCleared(true)
    const next = dex.species(id)
    if (!next) return
    setSpeciesCleared(false)
    if (id === draft.species) return
    setDraft((d) => settleDraft(dex, { ...d, species: id, form: pickForm(next, 0)?.f ?? 0, variant: null, origin: null }))
  }
  const changeGame = (id: string | null): void => setDraft((d) => settleDraft(dex, { ...d, game: id ?? '' }))
  const changeKind = (kind: EntryKind): void => {
    setAutoKind(false)
    patch({ kind })
  }
  const pickMethod = (key: string | null): void => {
    const option = methods.find((m) => m.key === key)
    if (!option) return
    setAutoKind(false)
    setDraft((d) => chooseMethod(d, suggestions, option, context))
  }
  const abilitySelect = useMemo<SelectOption<number>[]>(() => abilityOptions(draft.ability), [draft.ability])
  const changeAbility = (ability: number | null): void => patch(ability === null ? { ability, abilityHidden: false } : { ability })

  // The method and the location are stored in English (the datasets' labels) and shown in the active
  // language. What the user types is stored and shown exactly as typed, unless it is the shown name
  // of a suggestion, which then stands for that suggestion's own label.
  const methodText = typedMethod === draft.method ? draft.method : shownMethod(draft.method)
  const typeMethod = (typed: string): void => {
    if (typed === methodText) return
    const known = methods.find((m) => m.method !== '' && m.label === typed)
    const method = (known ? known.method : typed).slice(0, TEXT_LIMITS.method)
    setTypedMethod(known ? null : method)
    patch({ method })
  }
  const locationText = typedLocation === draft.location ? draft.location : locationName(draft.location)
  const typeLocation = (typed: string): void => {
    if (typed === locationText) return
    const known = places.find((p) => locationName(p.location) === typed)
    const location = (known ? known.location : typed).slice(0, TEXT_LIMITS.location)
    setTypedLocation(known ? null : location)
    patch({ location })
  }

  const pickPlace = (location: string | null): void => {
    if (location === null) return
    setAutoKind(false)
    setDraft((d) => chooseLocation(d, suggestions, location, context))
  }
  const useMatched = (): void => {
    if (matched) setDraft((d) => applySuggestion(d, matched, null, context))
  }

  // ---------------------------------------------------------------- hints

  let sourceHint: ReactNode
  if (draft.game === '') sourceHint = t('entry.hint.chooseGame')
  else if (detail.error) {
    sourceHint = rich('entry.hint.failed', {
      retry: (text) => (
        <button type="button" className="ee-link" onClick={detail.retry}>
          {text}
        </button>
      )
    })
  } else if (waitingForSources) sourceHint = t('entry.hint.loading')
  else if (matched) {
    const levels = levelHint(matched)
    sourceHint = (
      <span className="ee-known">
        <Icon name="check" size={13} strokeWidth={2.6} />
        {game
          ? levels !== ''
            ? t('entry.hint.knownLevels', { game: gameName(game.id), levels })
            : t('entry.hint.known', { game: gameName(game.id) })
          : levels !== ''
            ? t('entry.hint.knownHereLevels', { levels })
            : t('entry.hint.knownHere')}
      </span>
    )
  } else if (suggestions.length === 0) sourceHint = state === 'transfer' ? t('entry.hint.transferOnly') : t('entry.hint.noSources')
  else sourceHint = t('entry.hint.pick')

  const levelNote = matched?.levels ? t(levelOutside(matched, draft.level) ? 'entry.level.outside' : 'entry.level.source', { levels: levelHint(matched) }) : undefined
  const forcedFieldsDiffer = matched !== null && ((matched.ball !== undefined && draft.ball !== matched.ball) || (matched.shiny === 'forced' && !draft.shiny))

  const preview = useMemo(() => draftToPreview(draft, original?.createdAt ?? new Date().toISOString()), [draft, original])
  const spritePath = useMemo(() => resolveEntrySprite(dex, preview).path, [dex, preview])
  const title = editing ? t('entry.title.edit') : savedCount > 0 ? t('entry.title.another') : t('entry.title.create')
  const description = editing
    ? original
      ? t('entry.description.logged', { date: formatDate(original.createdAt, 'long') })
      : undefined
    : species
      ? t('entry.description.add', { name: form ? formFullName(species, form) : speciesName(species) })
      : t('entry.description.addAny')
  const fixedGender = genders.length === 1 ? genders[0] : undefined

  return (
    <>
      <Dialog
        open={open && !(editing && !original)}
        onClose={requestClose}
        size="xl"
        flush
        className="ee-dialog"
        title={title}
        description={description}
        initialFocus={focusRef}
        footer={
          <>
            {editing && (
              <div className="ee-foot__left">
                <Button variant="ghost" icon="trash" disabled={busy} onClick={() => original && deleteEntryWithUndo(original.id)}>
                  {t('common.delete')}
                </Button>
                <Button variant="ghost" icon="copy" disabled={busy} onClick={duplicate}>
                  {t('common.duplicate')}
                </Button>
              </div>
            )}
            <span className="ee-foot__hint" aria-hidden="true">
              {rich('entry.footer.shortcut', { keys: () => <Kbd keys={['Ctrl', 'Enter']} /> })}
            </span>
            <Button variant="ghost" disabled={busy} onClick={requestClose}>
              {t('common.cancel')}
            </Button>
            {!editing && (
              <Button disabled={busy} onClick={() => save(true)}>
                {t('entry.footer.saveAnother')}
              </Button>
            )}
            <Button variant={editing ? 'primary' : 'catch'} icon={editing ? 'check' : 'pokeball'} loading={busy} aria-keyshortcuts="Control+Enter" onClick={() => save(false)}>
              {editing ? t('entry.footer.saveChanges') : t('common.save')}
            </Button>
          </>
        }
      >
        <div className="ee">
          <div ref={formRef} className="ee-form" inert={busy}>
            <Group title={t('entry.group.pokemon')}>
              {speciesLocked && species ? (
                <div className={cx('ee-mon', formOptions.length <= 1 && 'ee-span')}>
                  <span className="ee-mon__art">
                    <Sprite species={species} form={form} size={40} />
                  </span>
                  <span className="ee-mon__text">
                    <span className="u-sr-only">{t('entry.pokemon.prefix')}</span>
                    <span className="ee-mon__name">{speciesName(species)}</span>
                    <span className="ee-mon__no">{dexNo(species.id)}</span>
                  </span>
                </div>
              ) : (
                <Combobox id={ids.species} label={t('entry.pokemon.label')} options={speciesOptions} value={species && !speciesCleared ? species.id : null} onChange={changeSpecies} filter={speciesFilter} placeholder={!species && draft.species > 0 && !speciesCleared ? t('entry.pokemon.missing', { number: dexNo(draft.species) }) : t('entry.pokemon.placeholder')} emptyText={t('entry.pokemon.noMatch')} error={shownErrors.species} wrapperClassName={formOptions.length <= 1 ? 'ee-span' : undefined} />
              )}
              {formOptions.length > 1 && <Select label={t('entry.form.label')} options={formOptions} value={form ? form.f : null} onChange={(f) => setDraft((d) => settleDraft(dex, { ...d, form: f }))} error={shownErrors.form} placeholder={t('entry.form.placeholder')} />}
              {variantOptions.length > 0 && <Select label={form?.variants?.every((v) => v.name.endsWith('Sweet')) ? t('entry.variant.sweet') : t('entry.variant.label')} options={variantOptions} value={draft.variant} onChange={(variant) => patch({ variant })} />}
            </Group>

            <Group title={t('entry.group.where')}>
              <Combobox id={ids.game} label={t('entry.game.label')} options={gameOptions} value={draft.game !== '' ? draft.game : null} onChange={changeGame} icon="gamepad" placeholder={t('entry.game.placeholder')} emptyText={t('entry.game.noMatch')} maxItems={GAMES.length + 1} error={shownErrors.game} />
              <Select label={t('entry.kind.label')} options={kindOptions} value={draft.kind} onChange={changeKind} />
              <Combobox
                id={ids.method}
                label={t('entry.method.label')}
                optional
                options={methodSelect}
                value={methodValue}
                onChange={pickMethod}
                freeText={{ text: methodText, onTextChange: typeMethod }}
                icon="pokeball"
                placeholder={t('entry.method.placeholder')}
                loading={waitingForSources}
                maxItems={80}
              />
              <Combobox
                id={ids.location}
                label={t('entry.location.label')}
                optional
                options={placeSelect}
                value={placeValue}
                onChange={pickPlace}
                freeText={{ text: locationText, onTextChange: typeLocation }}
                icon="map-pin"
                placeholder={t('entry.location.placeholder')}
                loading={waitingForSources}
                maxItems={80}
              />
              <p className="ee-hint ee-span">
                {sourceHint}
                {forcedFieldsDiffer && (
                  <>
                    {' '}
                    <button type="button" className="ee-link" onClick={useMatched}>
                      {t('entry.hint.useSource')}
                    </button>
                  </>
                )}
              </p>
              {showOrigin && (
                <Select
                  label={t('entry.origin.label')}
                  optional
                  hint={t('entry.origin.hint')}
                  options={originOptions}
                  value={draft.origin ? `${draft.origin[0]}-${draft.origin[1]}` : NO_ORIGIN}
                  onChange={(value) => {
                    if (value === NO_ORIGIN) return patch({ origin: null })
                    const [s, f] = value.split('-').map(Number)
                    if (s !== undefined && f !== undefined && Number.isInteger(s) && Number.isInteger(f)) patch({ origin: [s, f] })
                  }}
                />
              )}
            </Group>

            <Group title={t('entry.group.catch')}>
              <div className="ee-span">
                <BallPicker legal={legalBalls} value={draft.ball} onChange={(ball) => patch({ ball })} forced={matched?.ball} gameName={game ? gameName(game.id) : undefined} />
              </div>
              <div className="ui-field">
                <span className="ui-field__label">{t('entry.gender.label')}</span>
                {fixedGender !== undefined ? (
                  <span className="ee-static">
                    <GenderIcon gender={fixedGender} size={15} />
                    {fixedGender === 'n' ? t('common.genderless') : fixedGender === 'm' ? t('entry.gender.alwaysMale') : t('entry.gender.alwaysFemale')}
                  </span>
                ) : (
                  <SegmentedControl label={t('entry.gender.label')} fill options={genderOptions} value={draft.gender ?? UNSET} onChange={(value) => patch({ gender: value === UNSET ? null : (value as EntryGender) })} disabled={genderFixed} />
                )}
                {genders.length > 1 && matched?.gender !== undefined && <span className="ui-field__hint">{matched.gender === 'm' ? t('entry.gender.sourceMale') : matched.gender === 'f' ? t('entry.gender.sourceFemale') : t('entry.gender.sourceGenderless')}</span>}
              </div>
              <NumberField id={ids.level} label={t('common.level')} optional value={draft.level} onChange={(level) => patch({ level })} min={1} max={100} placeholder="1–100" error={errors.level} hint={levelNote} />
              <DateField label={t('entry.date.label')} optional value={draft.date} onChange={(date) => patch({ date })} max={today} error={errors.date} />
              <div className="ee-switches">
                <Switch
                  checked={draft.shiny}
                  onChange={(shiny) => patch({ shiny })}
                  label={
                    <span className="ee-switchlabel">
                      {rich('entry.shiny.label', { mark: () => <ShinyMark size={14} label="" /> })}
                    </span>
                  }
                  description={matched?.shiny === 'forced' ? t('entry.shiny.forced') : undefined}
                />
                {showGmax && <Switch checked={draft.gmax} onChange={(gmax) => patch({ gmax })} label={t('entry.gmax.label')} description={t('entry.gmax.description')} />}
                {showAlpha && <Switch checked={draft.alpha} onChange={(alpha) => patch({ alpha })} label={t('entry.alpha.label')} description={t('entry.alpha.description')} />}
              </div>
              {draft.shiny && matched?.shiny === 'locked' && (
                <p className="ee-warning ee-span" role="status">
                  <Icon name="warning" size={16} />
                  <span>{t('entry.shiny.locked')}</span>
                </p>
              )}
            </Group>

            <Group title={t('entry.group.details')}>
              <TextField id={ids.nickname} label={t('entry.nickname.label')} optional value={draft.nickname} onChange={(nickname) => patch({ nickname })} maxLength={TEXT_LIMITS.nickname} placeholder={t('entry.nickname.placeholder')} />
              <TextField label={t('entry.ot.label')} optional value={draft.ot} onChange={(ot) => patch({ ot })} maxLength={TEXT_LIMITS.ot} icon="user" placeholder={t('entry.ot.placeholder')} />
              <div className="ee-ability ee-span">
                <Combobox label={t('entry.ability.label')} optional options={abilitySelect} value={draft.ability} onChange={changeAbility} placeholder={t('entry.ability.placeholder')} emptyText={t('entry.ability.noMatch')} maxItems={abilitySelect.length} />
                <Checkbox checked={draft.ability !== null && draft.abilityHidden} onChange={(abilityHidden) => patch({ abilityHidden })} label={t('entry.ability.hidden')} disabled={draft.ability === null} />
              </div>
              <TextArea label={t('entry.notes.label')} optional value={draft.notes} onChange={(notes) => patch({ notes })} maxLength={TEXT_LIMITS.notes} counter={draft.notes.length > TEXT_LIMITS.notes - 400} rows={3} placeholder={t('entry.notes.placeholder')} wrapperClassName="ee-span" />
              <div className="ee-span">
                <Switch checked={draft.inHome} onChange={(inHome) => patch({ inHome })} label={t('entry.home.label')} description={t('entry.home.description')} />
              </div>
            </Group>

            <fieldset className="ee-group">
              <legend className="ee-group__title ee-group__title--fold u-eyebrow">
                <span>{t('entry.group.values')}</span>
                <Button size="sm" variant="ghost" icon={valuesOpen ? 'chevron-up' : 'chevron-down'} aria-expanded={valuesOpen} aria-controls={ids.values} onClick={() => setValuesOpen(!valuesOpen)}>
                  {valuesOpen ? t('entry.values.hide') : hasValues(draft) ? t('entry.values.show') : t('entry.values.add')}
                </Button>
              </legend>
              {valuesOpen && (
                <div className="ee-grid" id={ids.values}>
                  <TextField id={ids.pid} label={t('entry.pid.label')} optional value={draft.pid} onChange={(pid) => patch({ pid })} maxLength={8} placeholder={t('entry.pid.placeholder')} className="ee-pid" error={errors.pid} hint={t('entry.pid.hint')} wrapperClassName="ee-span" />
                  <StatRow name={t('lib.values.ivs')} max={MAX_IV} value={draft.ivs} onChange={(ivs) => patch({ ivs })} error={shownErrors.ivs} />
                  <StatRow name={t('lib.values.evs')} max={MAX_EV} value={draft.evs} onChange={(evs) => patch({ evs })} error={shownErrors.evs} />
                </div>
              )}
            </fieldset>
          </div>

          <aside className="ee-side" aria-label={t('entry.preview.label')}>
            {savedNote !== null && (
              <p className="ee-saved" role="status">
                <Icon name="check" size={15} strokeWidth={2.6} />
                <span>{savedNote}</span>
              </p>
            )}
            <CapturePreview ref={captureRef} entry={preview} spritePath={spritePath} types={form?.types ?? []} noGame={draft.game === ''} />
            {showErrors && hasErrors(errors) && (
              <p className="ee-warning" role="alert">
                <Icon name="warning" size={16} />
                <span>{errors.species ?? errors.form ?? errors.game ?? errors.level ?? errors.date ?? errors.pid ?? errors.ivs ?? errors.evs}</span>
              </p>
            )}
          </aside>
        </div>
      </Dialog>

      <Dialog
        open={confirming && open}
        onClose={() => setConfirming(false)}
        size="sm"
        hideClose
        title={editing ? t('entry.discard.titleEdit') : t('entry.discard.titleCreate')}
        description={editing ? t('entry.discard.descriptionEdit') : t('entry.discard.descriptionCreate')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} data-autofocus>
              {t('entry.discard.keep')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false)
                finishClose()
              }}
            >
              {t('entry.discard.confirm')}
            </Button>
          </>
        }
      />
    </>
  )
}
