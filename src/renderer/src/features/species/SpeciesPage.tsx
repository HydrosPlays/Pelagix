import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearch } from 'wouter'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import type { CatchEntry } from '@shared/save-types'
import { DexNumber, GenderIcon, Sprite, TypeBadges } from '@renderer/components/pokemon'
import { Button, EmptyState, Icon, Skeleton, Tag, useScrollParent } from '@renderer/components/ui'
import type { SourcePreset } from '@renderer/domain/encounters'
import { generationName } from '@renderer/domain/generation'
import { useT } from '@renderer/i18n'
import { flavorText, formFullName, formLabel, speciesGenus, speciesName } from '@renderer/i18n/terms'
import { motionOK } from '@renderer/lib/anim'
import { useDex, type Dex } from '@renderer/lib/data'
import { dexNo, percent as percentOf } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useEntriesForSpecies } from '@renderer/store/save'
import { useUiStore } from '@renderer/store/ui'
import { FamilyTree } from './FamilyTree'
import { FormPicker } from './FormPicker'
import { useSpeciesDetailRetry, type DetailState } from './hooks'
import { formatHeight, formatWeight, genderSplit, manualPreset, regionalNumbers, tagLabel, type ViewChoices } from './sources'
import { SpeciesEntries } from './SpeciesEntries'
import { SpeciesHero, type Celebration, type HeroView } from './SpeciesHero'
import { WhereToFind } from './WhereToFind'
import './SpeciesPage.css'

// ---------------------------------------------------------------- navigation

/** How many Pokémon pages deep the user has clicked since leaving a list; kept in history state. */
const DEPTH_KEY = 'pelagixSpeciesDepth'

function currentDepth(): number {
  const state: unknown = window.history.state
  const depth = typeof state === 'object' && state !== null ? (state as Record<string, unknown>)[DEPTH_KEY] : undefined
  return typeof depth === 'number' && Number.isInteger(depth) && depth > 0 ? depth : 0
}

/** Another Pokémon or form in place of this one (previous / next, form picker): Back still leaves the page. */
function replaceWith(id: number, form?: number): void {
  navigate(paths.species(id, form), { replace: true, state: window.history.state })
}

/** Following a link to another Pokémon: a new history entry that remembers how deep it is. */
function openSpecies(id: number, form?: number): void {
  navigate(paths.species(id, form), { state: { [DEPTH_KEY]: currentDepth() + 1 } })
}

interface NavigationLike {
  entries?: () => Array<{ url?: string | null; index: number }>
  currentEntry?: { index: number } | null
}

/**
 * Back to the Pokédex the way the browser's Back button would: to the history entry of the grid,
 * so its filters and scroll position are as they were. Falls back to opening the Pokédex afresh
 * when the user did not come from it.
 */
function backToDex(): void {
  const navigation = (window as unknown as { navigation?: NavigationLike }).navigation
  try {
    const entries = navigation?.entries?.() ?? []
    const at = navigation?.currentEntry?.index
    if (entries.length > 0 && typeof at === 'number') {
      for (let i = at - 1; i >= 0; i--) {
        const hash = new URL(entries[i]?.url ?? '', window.location.href).hash.replace(/^#\/?/, '')
        if (hash.split('?')[0] === 'dex') {
          window.history.go(i - at)
          return
        }
      }
      navigate(paths.dex())
      return
    }
  } catch {
    // No Navigation API here (or it refused): use the remembered depth instead.
  }
  const steps = currentDepth() + 1
  if (window.history.length > steps) window.history.go(-steps)
  else navigate(paths.dex())
}

const ARROW_BLOCKERS = 'input, textarea, select, [contenteditable="true"], [role="radiogroup"], [role="tablist"], [role="listbox"], [role="menu"], [role="combobox"], [role="grid"], [role="slider"], [role="spinbutton"], [role="dialog"]'

// ---------------------------------------------------------------- pieces

function Neighbour({ species, direction }: { species: SpeciesSummary | undefined; direction: 'prev' | 'next' }) {
  const t = useT()
  if (!species) return <span className="sp-nav__gap" aria-hidden="true" />
  const label = t(direction === 'prev' ? 'species.nav.previous' : 'species.nav.next', { number: dexNo(species.id), name: speciesName(species) })
  return (
    <button type="button" className={`sp-neighbour sp-neighbour--${direction}`} aria-label={label} aria-keyshortcuts={direction === 'prev' ? 'ArrowLeft' : 'ArrowRight'} onClick={() => replaceWith(species.id)}>
      {direction === 'prev' && <Icon name="chevron-left" size={16} />}
      <Sprite species={species} size={28} />
      <span className="sp-neighbour__text">
        <span className="sp-neighbour__no">{dexNo(species.id)}</span>
        <span className="sp-neighbour__name">{speciesName(species)}</span>
      </span>
      {direction === 'next' && <Icon name="chevron-right" size={16} />}
    </button>
  )
}

function GenderRatio({ species, form }: { species: SpeciesSummary; form: FormSummary }) {
  const t = useT()
  const split = genderSplit(species.genderRate)
  if (!split) {
    return (
      <span className="sp-gender sp-gender--none">
        <GenderIcon gender="n" size={14} />
        {t('common.genderless')}
      </span>
    )
  }
  const percent = (value: number): string => percentOf(value, 100)
  const fixed = form.gender
  const text = (fixed ? fixed === 'm' : split.female === 0) ? t('species.about.gender.male') : (fixed ? fixed === 'f' : split.male === 0) ? t('species.about.gender.female') : t('species.about.gender.split', { male: percent(split.male), female: percent(split.female) })
  const male = fixed ? (fixed === 'm' ? 100 : 0) : split.male
  return (
    <span className="sp-gender" role="img" aria-label={text}>
      <span className="sp-gender__bar" aria-hidden="true">
        <span className="sp-gender__male" style={{ flexGrow: male }} />
        <span className="sp-gender__female" style={{ flexGrow: 100 - male }} />
      </span>
      <span className="sp-gender__text" aria-hidden="true">
        {male > 0 && (
          <span className="sp-gender__m">
            <GenderIcon gender="m" size={13} />
            {percent(male)}
          </span>
        )}
        {male < 100 && (
          <span className="sp-gender__f">
            <GenderIcon gender="f" size={13} />
            {percent(100 - male)}
          </span>
        )}
      </span>
    </span>
  )
}

function About({ dex, species, form, detail, shiny }: { dex: Dex; species: SpeciesSummary; form: FormSummary; detail: DetailState; shiny: boolean }) {
  const t = useT()
  const [allNumbers, setAllNumbers] = useState(false)
  const data = detail.data
  const numbers = useMemo(() => (data ? regionalNumbers(data.dex) : []), [data])
  const shownNumbers = allNumbers ? numbers : numbers.slice(0, 5)
  const current = useMemo(() => ({ species: species.id, form: form.f }), [species.id, form.f])

  return (
    <div className="sp-about">
      {data ? (
        <p className="sp-about__flavor u-selectable">{flavorText(species.id, data.flavor)}</p>
      ) : detail.error ? (
        <div className="sp-about__error" role="alert">
          <Icon name="warning" size={16} />
          <span>{t('species.about.flavorError')}</span>
          <Button size="sm" icon="refresh" onClick={detail.retry}>
            {t('species.retry')}
          </Button>
        </div>
      ) : (
        <div className="sp-about__flavor" aria-busy="true">
          <Skeleton variant="text" width="96%" />
          <Skeleton variant="text" width="88%" />
          <Skeleton variant="text" width="52%" />
        </div>
      )}

      <dl className="sp-facts">
        <div className="sp-fact">
          <dt>{t('species.about.height')}</dt>
          <dd>{data ? formatHeight(data.height) : detail.error ? '–' : <Skeleton variant="text" width={96} />}</dd>
        </div>
        <div className="sp-fact">
          <dt>{t('species.about.weight')}</dt>
          <dd>{data ? formatWeight(data.weight) : detail.error ? '–' : <Skeleton variant="text" width={104} />}</dd>
        </div>
        <div className="sp-fact sp-fact--gender">
          <dt>{t('species.about.gender')}</dt>
          <dd>
            <GenderRatio species={species} form={form} />
          </dd>
        </div>
      </dl>

      {(numbers.length > 0 || detail.loading) && (
        <div className="sp-numbers">
          <span className="u-eyebrow">{t('species.about.regional')}</span>
          {data ? (
            <ul className="sp-numbers__list">
              {shownNumbers.map((n) => (
                <li key={n.key} className="sp-number">
                  <span>{n.label}</span>
                  <b>{n.number}</b>
                </li>
              ))}
              {numbers.length > 5 && (
                <li>
                  <button type="button" className="sp-numbers__toggle" aria-expanded={allNumbers} onClick={() => setAllNumbers(!allNumbers)}>
                    {allNumbers ? t('species.showFewer') : t('species.about.regional.more', { count: numbers.length - 5 })}
                  </button>
                </li>
              )}
            </ul>
          ) : (
            <Skeleton variant="text" width="70%" />
          )}
        </div>
      )}

      <div className="sp-family">
        <span className="u-eyebrow">{t('species.about.family')}</span>
        {data ? <FamilyTree dex={dex} family={data.family} current={current} shiny={shiny} onOpen={(s, f) => (s === species.id ? replaceWith(s, f) : openSpecies(s, f))} /> : detail.error ? <p className="sp-fam__alone">{t('species.about.family.error')}</p> : <Skeleton height={76} radius={12} width="60%" />}
      </div>
    </div>
  )
}

function UnknownSpecies({ id }: { id: string | undefined }) {
  const t = useT()
  return (
    <div className="page">
      <EmptyState
        size="lg"
        icon="search"
        title={t('species.unknown.title')}
        description={id ? t('species.unknown.description', { id }) : t('species.unknown.noId')}
        action={
          <Button variant="primary" icon="dex" onClick={() => navigate(paths.dex())}>
            {t('species.unknown.open')}
          </Button>
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------- the page

function SpeciesView({ dex, species }: { dex: Dex; species: SpeciesSummary }) {
  const t = useT()
  const search = useSearch()
  const scroller = useScrollParent()
  const whereRef = useRef<HTMLHeadingElement>(null)

  const forms = useMemo(() => species.forms.filter((f) => f.cat !== 'hidden'), [species])
  const wantedForm = Number(new URLSearchParams(search).get('form') ?? '0')
  const form = forms.find((f) => f.f === wantedForm) ?? forms[0] ?? species.forms[0]!

  const detail = useSpeciesDetailRetry(species.id)
  const entries = useEntriesForSpecies(species.id)
  const globalShiny = useUiStore((s) => s.dexView.shinyView)
  const lastCapture = useUiStore((s) => s.lastCapture)
  const openCreate = useUiStore((s) => s.openCreate)

  // What the stage shows. Each choice only applies while the selected form supports it.
  const [shinyChoice, setShinyChoice] = useState<boolean | null>(null)
  const [femaleChoice, setFemaleChoice] = useState(false)
  const [gmaxChoice, setGmaxChoice] = useState(false)
  const [variantChoice, setVariantChoice] = useState<number | undefined>(undefined)
  const [celebration, setCelebration] = useState<(Celebration & { id: string }) | null>(null)

  const shinyWanted = shinyChoice ?? globalShiny
  const gmax = gmaxChoice && form.gmax !== undefined
  const variant = gmax ? undefined : (form.variants?.find((v) => v.id === variantChoice) ?? form.variants?.[0])
  const shinyExists = gmax ? true : variant ? variant.shiny : form.shiny
  const view = useMemo<HeroView>(
    () => ({ shiny: shinyWanted && shinyExists, female: femaleChoice && form.female && !gmax && !variant, gmax, variant: variant?.id }),
    [shinyWanted, shinyExists, femaleChoice, form.female, gmax, variant]
  )
  const choices = useMemo<ViewChoices>(() => ({ variant: form.variants?.length ? (variant?.id ?? form.variants[0]?.id) : undefined, female: femaleChoice && form.female, gmax }), [form, variant, femaleChoice, gmax])

  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const entry of entries) map.set(entry.form, (map.get(entry.form) ?? 0) + 1)
    return map
  }, [entries])

  const index = dex.speciesList.indexOf(species)
  const previous = index > 0 ? dex.speciesList[index - 1] : undefined
  const next = index >= 0 ? dex.speciesList[index + 1] : undefined

  // Left / Right step through the Pokédex unless a control that uses the arrows has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const ui = useUiStore.getState()
      if (ui.entryEditor.open || ui.commandPalette || document.getElementById('root')?.inert) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(ARROW_BLOCKERS)) return
      const to = event.key === 'ArrowLeft' ? previous : next
      if (!to) return
      event.preventDefault()
      replaceWith(to.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previous, next])

  // A catch of this Pokémon was just logged: take the marker (once) and celebrate it.
  useEffect(() => {
    if (lastCapture === null) return
    const entry: CatchEntry | undefined = entries.find((e) => e.id === lastCapture)
    if (!entry) return
    if (useUiStore.getState().consumeLastCapture() !== lastCapture) return
    // Show what was caught: its form, and the shiny, female, Gigantamax or sweet render when that is what it is.
    if (entry.form !== form.f && forms.some((f) => f.f === entry.form)) replaceWith(species.id, entry.form)
    if (entry.shiny) setShinyChoice(true)
    if (entry.gender === 'f') setFemaleChoice(true)
    if (entry.gmax) setGmaxChoice(true)
    if (entry.variant !== undefined) setVariantChoice(entry.variant)
    setCelebration((old) => ({ id: entry.id, shiny: entry.shiny, nonce: (old?.nonce ?? 0) + 1 }))
    scroller?.scrollTo({ top: 0, behavior: motionOK() ? 'smooth' : 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCapture, entries])

  // The gold ring on the new card fades out after a while.
  const celebratedId = celebration?.id ?? null
  useEffect(() => {
    if (celebratedId === null) return
    const timer = setTimeout(() => setCelebration((old) => (old && old.id === celebratedId ? null : old)), 6000)
    return () => clearTimeout(timer)
  }, [celebratedId, celebration?.nonce])

  const log = useCallback((preset: SourcePreset) => openCreate(preset), [openCreate])
  const open = useCallback((id: number, f: number) => (id === species.id ? replaceWith(id, f) : openSpecies(id, f)), [species.id])
  const findIt = (): void => {
    const heading = whereRef.current
    if (!heading) return
    // Only the page's own scroller moves: `scrollIntoView` would also nudge the app frame around it.
    if (scroller) {
      const top = scroller.scrollTop + heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16
      scroller.scrollTo({ top, behavior: motionOK() ? 'smooth' : 'auto' })
    }
    heading.focus({ preventScroll: true })
  }

  const baseNamed = form.cat === 'base' && form.name !== ''

  return (
    <div className="page sp">
      <nav className="sp-nav" aria-label={t('species.nav.label')}>
        <Button variant="ghost" icon="arrow-left" onClick={backToDex}>
          {t('species.nav.back')}
        </Button>
        <div className="sp-nav__neighbours">
          <Neighbour species={previous} direction="prev" />
          <Neighbour species={next} direction="next" />
        </div>
      </nav>

      <div className="sp-hero">
        <SpeciesHero
          species={species}
          form={form}
          view={view}
          shinyWanted={shinyWanted}
          onShiny={setShinyChoice}
          onFemale={setFemaleChoice}
          onGmax={setGmaxChoice}
          onVariant={setVariantChoice}
          celebration={celebration}
        />

        <div className="sp-hero__info">
          <header className="sp-id">
            <div className="sp-id__meta">
              <DexNumber id={species.id} />
              <span className="sp-id__gen">{generationName(species.gen)}</span>
              {species.tags.map((tag) => (
                <Tag key={tag} tone={tag === 'legendary' || tag === 'mythical' ? 'gold' : 'accent'}>
                  {tagLabel(tag)}
                </Tag>
              ))}
            </div>
            <h1 className="page-title sp-id__name">{formFullName(species, form)}</h1>
            <div className="sp-id__sub">
              <span className="sp-id__genus">{speciesGenus(species)}</span>
              {baseNamed && <span className="sp-id__form">{formLabel(species, form)}</span>}
              <TypeBadges types={form.types} />
            </div>
          </header>
          <About dex={dex} species={species} form={form} detail={detail} shiny={view.shiny} />
        </div>
      </div>

      {forms.length > 1 && <FormPicker species={species} forms={forms} selected={form} counts={counts} shiny={shinyWanted} onSelect={(f) => replaceWith(species.id, f.f)} />}

      <SpeciesEntries species={species} form={form} entries={entries} highlightId={celebratedId} onLogAnother={() => log(manualPreset({ species, form, view: choices }, null, null))} onFindIt={findIt} />

      <WhereToFind dex={dex} species={species} form={form} detail={detail} entries={entries} view={choices} onLog={log} onOpenSpecies={open} headingRef={whereRef} />
    </div>
  )
}

/** Route /dex/:id (?form=): everything about one Pokémon, where to find it and the user's catches of it. */
export default function SpeciesPage() {
  const { id } = useParams<{ id: string }>()
  const dex = useDex()
  const number = id !== undefined && /^\d{1,5}$/.test(id) ? Number(id) : Number.NaN
  const species = Number.isInteger(number) ? dex.species(number) : undefined
  if (!species) return <UnknownSpecies id={id} />
  return <SpeciesView key={species.id} dex={dex} species={species} />
}
