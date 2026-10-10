import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { GAME_BY_ID, GAMES, GENERATION_NAMES } from '@shared/games'
import { MAX_EV, MAX_IV, type CatchEntry, type EntryGender, type EntryKind } from '@shared/save-types'
import { GameIcon, GenderIcon, ShinyMark, Sprite } from '@renderer/components/pokemon'
import { Button, Checkbox, Combobox, cx, DateField, Dialog, Icon, Kbd, NumberField, SegmentedControl, Select, Switch, TextArea, TextField, type SelectOption } from '@renderer/components/ui'
import { describeEntry } from '@renderer/domain/entries'
import { sourcesByGame } from '@renderer/domain/encounters'
import { gameState, isBattleOnly, type GameState } from '@renderer/features/species/sources'
import { useSpeciesDetailRetry } from '@renderer/features/species/hooks'
import { shake } from '@renderer/lib/anim'
import type { Dex } from '@renderer/lib/data'
import { deleteEntryWithUndo, duplicateEntryWithToast } from '@renderer/lib/entry-actions'
import { dexNo, ENTRY_KINDS, errorMessage, formatDate, genderLabel, kindLabel, levelRange, todayIso } from '@renderer/lib/format'
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
  STAT_LABELS,
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

const STAT_SHORT = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'] as const

/** Six small number boxes for one value per stat, with one message under the row. */
function StatRow({ name, max, value, onChange, error }: { name: string; max: number; value: StatBoxes; onChange: (value: StatBoxes) => void; error?: string }) {
  return (
    <div className="ui-field ee-span" role="group" aria-label={name}>
      <span className="ui-field__label">
        {name}
        <span className="ui-field__optional">0–{max}</span>
      </span>
      <div className="ee-stats">
        {STAT_SHORT.map((short, i) => (
          <NumberField
            key={short}
            size="sm"
            steppers={false}
            label={short}
            aria-label={`${name}: ${STAT_LABELS[i]!}`}
            value={value[i] ?? null}
            onChange={(v) => onChange(STAT_SHORT.map((_, j) => (j === i ? v : (value[j] ?? null))))}
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
    toast({ kind: 'error', title: 'That entry no longer exists', body: 'It may have been deleted already.' })
    useUiStore.getState().closeEditor()
  }, [editing, original])

  // ---------------------------------------------------------------- saving

  const today = todayIso()
  const errors = useMemo(() => {
    const found = validateDraft(dex, draft, { today, original: original ?? undefined })
    return speciesCleared ? { species: 'Choose a Pokémon.', ...found } : found
  }, [dex, draft, today, original, speciesCleared])
  const shownErrors = showErrors ? errors : {}

  const announce = (entry: CatchEntry): void => {
    const view = describeEntry(dex, entry)
    const name = `${entry.shiny ? 'Shiny ' : ''}${view.name}`
    const onItsPage = path === `/dex/${entry.species}`
    toast({
      kind: 'success',
      title: `${name} registered in your Living Dex`,
      body: [view.game?.name, entry.location].filter(Boolean).join(' · ') || undefined,
      icon: 'pokeball',
      ...(onItsPage ? {} : { action: { label: 'View', onSelect: () => navigate(paths.species(entry.species, entry.form)) } })
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
          toast({ kind: 'error', title: 'That entry no longer exists', body: 'Your changes could not be saved because it was deleted.' })
        } else {
          toast({ kind: 'success', title: 'Changes saved', body: `${describeEntry(dex, updated).name} · ${GAME_BY_ID.get(updated.game)?.name ?? 'Unknown game'}`, icon: 'check' })
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
        setSavedNote(`${describeEntry(dex, entry).name} saved in ${GAME_BY_ID.get(entry.game)?.name ?? 'that game'}. Pick the next game.`)
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
      toast({ kind: 'error', title: 'This entry could not be saved', body: errorMessage(err) })
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
        toast({ kind: 'error', title: 'This entry could not be saved', body: errorMessage(err) })
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
    () => (speciesLocked ? [] : dex.speciesList.map((s) => ({ value: s.id, label: s.name, description: dexNo(s.id), keywords: String(s.id), icon: <Sprite species={s} size={26} /> }))),
    [dex, speciesLocked]
  )

  const formOptions = useMemo<SelectOption<number>[]>(() => {
    if (!species) return []
    const list = visibleForms(species)
    if (form && !list.includes(form)) list.push(form)
    return list.map((f) => ({ value: f.f, label: f.cat === 'base' && f.name !== '' ? `${f.full} (${f.name})` : f.full, icon: <Sprite species={species} form={f} size={26} /> }))
  }, [species, form])

  const variantOptions = useMemo<SelectOption<number>[]>(
    () => (species && form?.variants ? form.variants.map((v) => ({ value: v.id, label: v.name, icon: <Sprite species={species} form={form} variant={v.id} size={26} /> })) : []),
    [species, form]
  )

  const gameOptions = useMemo<SelectOption<string>[]>(() => {
    const here: SelectOption<string>[] = []
    const rest: SelectOption<string>[] = []
    for (const g of GAMES) {
      const s = form ? gameState(dex, form, g.id) : null
      // Short names ("Scarlet") so typing ranks by how players say them; the full title still matches.
      const option: SelectOption<string> = { value: g.id, label: g.short, keywords: g.name, icon: <GameIcon game={g} size={22} tooltip={false} alt="" /> }
      if (s === 'obtainable' || s === 'event') {
        here.push({ ...option, group: 'Where you can get it', description: s === 'event' ? <span className="ee-opt ee-opt--event">Event only</span> : <span className="ee-opt ee-opt--ok">Obtainable</span> })
      } else {
        rest.push({ ...option, group: GENERATION_NAMES[g.generation] ?? 'Other', description: s === 'transfer' ? 'Transfer only' : undefined })
      }
    }
    const all = [...here, ...rest]
    // An old entry may carry a game this version does not know; it stays selectable as it is.
    if (draft.game !== '' && !GAME_BY_ID.has(draft.game)) all.unshift({ value: draft.game, label: 'Unknown game', description: draft.game, icon: <Icon name="help" size={18} /> })
    return all
  }, [dex, form, draft.game])

  const kindOptions = useMemo<SelectOption<EntryKind>[]>(() => ENTRY_KINDS.map((k) => ({ value: k, label: kindLabel(k) })), [])

  const methods = useMemo(() => methodOptions(suggestions, draft.location), [suggestions, draft.location])
  const methodSelect = useMemo<SelectOption<string>[]>(() => {
    const anyHere = methods.some((m) => m.here)
    const place = draft.location.trim()
    return methods.map((m) => ({
      value: m.key,
      label: m.label,
      keywords: kindLabel(m.kind),
      group: anyHere ? (m.here ? `At ${place}` : 'Elsewhere in this game') : undefined,
      description: m.places.length === 0 ? levelRange(m.levels) || undefined : m.places.length === 1 ? m.places[0] : `${m.places.length} places`
    }))
  }, [methods, draft.location])
  const methodKey = `${draft.kind}|${draft.method.trim()}`
  const methodValue = methods.some((m) => m.key === methodKey) && (draft.method.trim() !== '' || matched !== null) ? methodKey : null

  const places = useMemo(() => locationOptions(suggestions, draft.kind, draft.method), [suggestions, draft.kind, draft.method])
  const placeSelect = useMemo<SelectOption<string>[]>(() => {
    const anyFit = places.some((p) => p.fits)
    const how = draft.method.trim() !== '' ? draft.method.trim() : kindLabel(draft.kind)
    return places.map((p) => ({
      value: p.location,
      label: p.location,
      group: anyFit ? (p.fits ? `With ${how}` : 'Other places') : undefined,
      description: p.methods.length <= 2 ? p.methods.join(', ') : `${p.methods.length} ways`
    }))
  }, [places, draft.kind, draft.method])
  const placeValue = places.some((p) => p.location === draft.location.trim()) ? draft.location.trim() : null

  const originOptions = useMemo<SelectOption<string>[]>(() => {
    const out: SelectOption<string>[] = [{ value: NO_ORIGIN, label: 'Not set' }]
    const seen = new Set<string>()
    const add = (s: number, f: number): void => {
      const key = `${s}-${f}`
      if (seen.has(key) || (s === draft.species && f === draft.form)) return
      const originForm = dex.form(s, f)
      if (!originForm || (originForm.cat === 'hidden' && !(draft.origin && draft.origin[0] === s && draft.origin[1] === f))) return
      seen.add(key)
      out.push({ value: key, label: originForm.full, icon: <Sprite species={s} form={f} size={26} /> })
    }
    if (detail.data) for (const node of detail.data.family) add(node.s, node.f)
    else if (species) for (const member of dex.familyMembers(species.family)) add(member.id, member.forms[0]?.f ?? 0)
    if (species) for (const f of visibleForms(species)) add(species.id, f.f)
    if (draft.origin) add(draft.origin[0], draft.origin[1])
    return out
  }, [dex, detail.data, species, draft.species, draft.form, draft.origin])

  const genders = genderChoices(species, form)
  const genderOptions = useMemo(
    () => [
      ...genders.map((g) => ({ value: g as string, label: genderLabel(g), icon: <GenderIcon gender={g} size={14} /> })),
      { value: UNSET, label: 'Not set' }
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
  if (draft.game === '') sourceHint = 'Choose a game to see the ways it offers this Pokémon.'
  else if (detail.error) {
    sourceHint = (
      <>
        Suggestions could not be loaded.{' '}
        <button type="button" className="ee-link" onClick={detail.retry}>
          Try again
        </button>
      </>
    )
  } else if (waitingForSources) sourceHint = 'Loading suggestions…'
  else if (matched) {
    sourceHint = (
      <span className="ee-known">
        <Icon name="check" size={13} strokeWidth={2.6} />
        A known way to get it in {game?.name ?? 'this game'}
        {levelHint(matched) !== '' ? ` · ${levelHint(matched)}` : ''}
      </span>
    )
  } else if (suggestions.length === 0) sourceHint = state === 'transfer' ? 'It cannot be obtained in this game, so describe how you got it in your own words.' : 'No known sources here. Describe it in your own words.'
  else sourceHint = 'Pick a suggestion or type your own.'

  const levelNote = matched?.levels ? (levelOutside(matched, draft.level) ? `Lower than this source gives (${levelHint(matched)}).` : `This source gives ${levelHint(matched)}.`) : undefined
  const forcedFieldsDiffer = matched !== null && ((matched.ball !== undefined && draft.ball !== matched.ball) || (matched.shiny === 'forced' && !draft.shiny))

  const preview = useMemo(() => draftToPreview(draft, original?.createdAt ?? new Date().toISOString()), [draft, original])
  const spritePath = useMemo(() => resolveEntrySprite(dex, preview).path, [dex, preview])
  const title = editing ? 'Edit entry' : savedCount > 0 ? 'Log another catch' : 'Log a catch'
  const description = editing ? (original ? `Logged ${formatDate(original.createdAt, 'long')}` : undefined) : species ? `Add ${form?.full ?? species.name} to your Living Dex.` : 'Add a Pokémon to your Living Dex.'

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
                  Delete
                </Button>
                <Button variant="ghost" icon="copy" disabled={busy} onClick={duplicate}>
                  Duplicate
                </Button>
              </div>
            )}
            <span className="ee-foot__hint" aria-hidden="true">
              <Kbd keys={['Ctrl', 'Enter']} /> saves
            </span>
            <Button variant="ghost" disabled={busy} onClick={requestClose}>
              Cancel
            </Button>
            {!editing && (
              <Button disabled={busy} onClick={() => save(true)}>
                Save and log another game
              </Button>
            )}
            <Button variant={editing ? 'primary' : 'catch'} icon={editing ? 'check' : 'pokeball'} loading={busy} aria-keyshortcuts="Control+Enter" onClick={() => save(false)}>
              {editing ? 'Save changes' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="ee">
          <div ref={formRef} className="ee-form" inert={busy}>
            <Group title="Pokémon">
              {speciesLocked && species ? (
                <div className={cx('ee-mon', formOptions.length <= 1 && 'ee-span')}>
                  <span className="ee-mon__art">
                    <Sprite species={species} form={form} size={40} />
                  </span>
                  <span className="ee-mon__text">
                    <span className="u-sr-only">Pokémon: </span>
                    <span className="ee-mon__name">{species.name}</span>
                    <span className="ee-mon__no">{dexNo(species.id)}</span>
                  </span>
                </div>
              ) : (
                <Combobox id={ids.species} label="Pokémon" options={speciesOptions} value={species && !speciesCleared ? species.id : null} onChange={changeSpecies} filter={speciesFilter} placeholder={!species && draft.species > 0 && !speciesCleared ? `Pokémon ${dexNo(draft.species)} (not in the data)` : 'Search by name or number'} emptyText="No Pokémon matches" error={shownErrors.species} wrapperClassName={formOptions.length <= 1 ? 'ee-span' : undefined} />
              )}
              {formOptions.length > 1 && <Select label="Form" options={formOptions} value={form ? form.f : null} onChange={(f) => setDraft((d) => settleDraft(dex, { ...d, form: f }))} error={shownErrors.form} placeholder="Choose a form" />}
              {variantOptions.length > 0 && <Select label={variantOptions.every((v) => v.label.endsWith('Sweet')) ? 'Sweet' : 'Variant'} options={variantOptions} value={draft.variant} onChange={(variant) => patch({ variant })} />}
            </Group>

            <Group title="Where and how">
              <Combobox id={ids.game} label="Game" options={gameOptions} value={draft.game !== '' ? draft.game : null} onChange={changeGame} icon="gamepad" placeholder="Which game did you get it in?" emptyText="No game matches" maxItems={GAMES.length + 1} error={shownErrors.game} />
              <Select label="How you got it" options={kindOptions} value={draft.kind} onChange={changeKind} />
              <Combobox
                id={ids.method}
                label="Method"
                optional
                options={methodSelect}
                value={methodValue}
                onChange={pickMethod}
                freeText={{ text: draft.method, onTextChange: (method) => patch({ method: method.slice(0, TEXT_LIMITS.method) }) }}
                icon="pokeball"
                placeholder="Tall grass, Gift, Max Raid…"
                loading={waitingForSources}
                maxItems={80}
              />
              <Combobox
                id={ids.location}
                label="Location"
                optional
                options={placeSelect}
                value={placeValue}
                onChange={pickPlace}
                freeText={{ text: draft.location, onTextChange: (location) => patch({ location: location.slice(0, TEXT_LIMITS.location) }) }}
                icon="map-pin"
                placeholder="Where was it?"
                loading={waitingForSources}
                maxItems={80}
              />
              <p className="ee-hint ee-span">
                {sourceHint}
                {forcedFieldsDiffer && (
                  <>
                    {' '}
                    <button type="button" className="ee-link" onClick={useMatched}>
                      Use this source's ball and details
                    </button>
                  </>
                )}
              </p>
              {showOrigin && (
                <Select
                  label="Caught as"
                  optional
                  hint="The Pokémon it was when you got it."
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

            <Group title="The catch">
              <div className="ee-span">
                <BallPicker legal={legalBalls} value={draft.ball} onChange={(ball) => patch({ ball })} forced={matched?.ball} gameName={game?.name} />
              </div>
              <div className="ui-field">
                <span className="ui-field__label">Gender</span>
                {genders.length === 1 ? (
                  <span className="ee-static">
                    <GenderIcon gender={genders[0]} size={15} />
                    {genders[0] === 'n' ? 'Genderless' : `Always ${genderLabel(genders[0]).toLowerCase()}`}
                  </span>
                ) : (
                  <SegmentedControl label="Gender" fill options={genderOptions} value={draft.gender ?? UNSET} onChange={(value) => patch({ gender: value === UNSET ? null : (value as EntryGender) })} disabled={genderFixed} />
                )}
                {genders.length > 1 && matched?.gender !== undefined && <span className="ui-field__hint">This source is always {genderLabel(matched.gender).toLowerCase()}.</span>}
              </div>
              <NumberField id={ids.level} label="Level" optional value={draft.level} onChange={(level) => patch({ level })} min={1} max={100} placeholder="1–100" error={errors.level} hint={levelNote} />
              <DateField label="Date caught" optional value={draft.date} onChange={(date) => patch({ date })} max={today} error={errors.date} />
              <div className="ee-switches">
                <Switch
                  checked={draft.shiny}
                  onChange={(shiny) => patch({ shiny })}
                  label={
                    <span className="ee-switchlabel">
                      Shiny <ShinyMark size={14} label="" />
                    </span>
                  }
                  description={matched?.shiny === 'forced' ? 'Always shiny from this source.' : undefined}
                />
                {showGmax && <Switch checked={draft.gmax} onChange={(gmax) => patch({ gmax })} label="Gigantamax" description="It has the Gigantamax Factor." />}
                {showAlpha && <Switch checked={draft.alpha} onChange={(alpha) => patch({ alpha })} label="Alpha" description="A larger, red-eyed Alpha Pokémon." />}
              </div>
              {draft.shiny && matched?.shiny === 'locked' && (
                <p className="ee-warning ee-span" role="status">
                  <Icon name="warning" size={16} />
                  <span>This one is shiny-locked in the game, so it normally cannot be shiny. It is your record: keep it on if yours really is.</span>
                </p>
              )}
            </Group>

            <Group title="Details">
              <TextField id={ids.nickname} label="Nickname" optional value={draft.nickname} onChange={(nickname) => patch({ nickname })} maxLength={TEXT_LIMITS.nickname} placeholder="None" />
              <TextField label="Original Trainer" optional value={draft.ot} onChange={(ot) => patch({ ot })} maxLength={TEXT_LIMITS.ot} icon="user" placeholder="OT name" />
              <div className="ee-ability ee-span">
                <Combobox label="Ability" optional options={abilitySelect} value={draft.ability} onChange={changeAbility} placeholder="Type to search" emptyText="No ability matches" maxItems={abilitySelect.length} />
                <Checkbox checked={draft.ability !== null && draft.abilityHidden} onChange={(abilityHidden) => patch({ abilityHidden })} label="Hidden Ability" disabled={draft.ability === null} />
              </div>
              <TextArea label="Notes" optional value={draft.notes} onChange={(notes) => patch({ notes })} maxLength={TEXT_LIMITS.notes} counter={draft.notes.length > TEXT_LIMITS.notes - 400} rows={3} placeholder="Anything worth remembering about this catch" wrapperClassName="ee-span" />
              <div className="ee-span">
                <Switch checked={draft.inHome} onChange={(inHome) => patch({ inHome })} label="In Pokémon HOME" description="You have sent this Pokémon to Pokémon HOME." />
              </div>
            </Group>

            <fieldset className="ee-group">
              <legend className="ee-group__title ee-group__title--fold u-eyebrow">
                <span>PID, IVs and EVs</span>
                <Button size="sm" variant="ghost" icon={valuesOpen ? 'chevron-up' : 'chevron-down'} aria-expanded={valuesOpen} aria-controls={ids.values} onClick={() => setValuesOpen(!valuesOpen)}>
                  {valuesOpen ? 'Hide' : hasValues(draft) ? 'Show' : 'Add'}
                </Button>
              </legend>
              {valuesOpen && (
                <div className="ee-grid" id={ids.values}>
                  <TextField id={ids.pid} label="PID" optional value={draft.pid} onChange={(pid) => patch({ pid })} maxLength={8} placeholder="8 hex digits" className="ee-pid" error={errors.pid} hint="The personality value, as PKHeX shows it." wrapperClassName="ee-span" />
                  <StatRow name="IVs" max={MAX_IV} value={draft.ivs} onChange={(ivs) => patch({ ivs })} error={shownErrors.ivs} />
                  <StatRow name="EVs" max={MAX_EV} value={draft.evs} onChange={(evs) => patch({ evs })} error={shownErrors.evs} />
                </div>
              )}
            </fieldset>
          </div>

          <aside className="ee-side" aria-label="Preview of the entry">
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
        title={editing ? 'Discard your changes?' : 'Discard this entry?'}
        description={editing ? 'The entry stays as it was saved.' : 'What you filled in will not be saved.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} data-autofocus>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false)
                finishClose()
              }}
            >
              Discard
            </Button>
          </>
        }
      />
    </>
  )
}
