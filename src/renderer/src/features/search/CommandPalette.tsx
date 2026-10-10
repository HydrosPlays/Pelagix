/**
 * The Ctrl/Cmd+K command palette: jump to any Pokémon or page, or run a quick action, from the
 * keyboard. Mounted once by the app shell; open state is `useUiStore().commandPalette`.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useSearch } from 'wouter'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import { ShinyMark, Sprite, TypeBadges } from '@renderer/components/pokemon'
import { cx, Icon, Kbd, Portal, useEscapeLayer, useFocusTrap, useModalRoot, usePresence } from '@renderer/components/ui'
import { CaughtMark } from '@renderer/features/pokedex/CaughtMark'
import { activeLanguage, rich, t, translate, useT, type MessageKey } from '@renderer/i18n'
import { popIn } from '@renderer/lib/anim'
import { useDexStore } from '@renderer/lib/data'
import { dexNo } from '@renderer/lib/format'
import { resolveFormSprite, speciesSpritePath } from '@renderer/lib/sprites'
import { navigate, paths } from '@renderer/shell/router'
import { NAV_ITEMS } from '@renderer/shell/routes'
import { entriesBySpecies, useEntries, useSaveStore, useSettings } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'
import { buildPalette, type ActionItem, type PaletteItem, type PalettePage, type PokemonItem } from './palette-model'
import { readRecent, recentFromLocation, recordRecent } from './recent'
import './CommandPalette.css'

const EXIT_MS = 110

const PAGE_KEYWORDS: Readonly<Record<string, MessageKey>> = {
  home: 'search.keywords.page.home',
  dex: 'search.keywords.page.dex',
  living: 'search.keywords.page.living',
  homedex: 'search.keywords.page.homedex',
  journal: 'search.keywords.page.journal',
  achievements: 'search.keywords.page.achievements',
  settings: 'search.keywords.page.settings'
}

/**
 * The pages the palette lists, named in the active language. Each is also found by its extra
 * words and, in another language than English, by its English name and English extra words.
 */
function palettePages(): PalettePage[] {
  const english = activeLanguage() === 'en'
  return NAV_ITEMS.map((item) => {
    const key = PAGE_KEYWORDS[item.id]
    const words: string[] = key ? [t(key)] : []
    if (!english) {
      const nameKey = `shell.route.${item.id}`
      const name = translate('en', nameKey as MessageKey)
      if (name !== nameKey) words.push(name)
      if (key) words.push(translate('en', key))
    }
    return { id: `page-${item.id}`, label: item.label, icon: item.icon, href: item.href, keywords: words.length > 0 ? [...new Set(words)].join(' ') : undefined }
  })
}

/** Remembers every Pokémon page the user lands on, however they got there. */
function useRecentTracker(): void {
  const [path] = useLocation()
  const search = useSearch()
  useEffect(() => {
    const ref = recentFromLocation(path, search)
    if (ref) recordRecent(ref)
  }, [path, search])
}

// ---------------------------------------------------------------- rows

/** A species result shows the species' default render; a form result shows the form's own. */
function renderPath(species: SpeciesSummary, form: FormSummary, shiny: boolean): string {
  return form === species.forms[0] ? speciesSpritePath(species, shiny) : resolveFormSprite(species, form, { shiny }).path
}

function PokemonRow({ item, shinyView }: { item: PokemonItem; shinyView: boolean }) {
  const t = useT()
  const entries = useEntries()
  const own = useMemo(() => {
    const all = entriesBySpecies(entries).get(item.species.id) ?? []
    // A form result counts its own catches; a species result counts every form.
    return item.form === item.species.forms[0] ? all : all.filter((entry) => entry.form === item.form.f)
  }, [entries, item])
  const shiny = own.some((entry) => entry.shiny)
  return (
    <>
      <span className="cmdk-item__media">
        <Sprite path={renderPath(item.species, item.form, shinyView)} size={40} lazy={false} />
      </span>
      <span className="cmdk-item__text">
        <span className="cmdk-item__label">{item.label}</span>
        <span className="cmdk-item__sub">{dexNo(item.species.id)}</span>
      </span>
      <TypeBadges types={item.form.types} size="sm" className="cmdk-item__types" />
      <span className="cmdk-item__state">
        {shiny && <ShinyMark size={14} label={t('search.row.shiny')} />}
        {own.length > 0 ? <CaughtMark entries={own.length} labelled /> : <span className="u-sr-only">{t('search.row.missing')}</span>}
      </span>
    </>
  )
}

function ActionRow({ item }: { item: ActionItem }) {
  return (
    <>
      <span className={cx('cmdk-item__icon', item.action === 'log' && 'is-catch', item.action === 'shiny' && 'is-gold')}>
        {item.action === 'log' && item.target ? <Sprite path={renderPath(item.target.species, item.target.form, false)} size={30} lazy={false} /> : <Icon name={item.icon} size={18} />}
      </span>
      <span className="cmdk-item__text">
        <span className="cmdk-item__label">{item.label}</span>
      </span>
      {item.hint !== undefined && <span className="cmdk-item__hint">{item.hint}</span>}
    </>
  )
}

// ---------------------------------------------------------------- palette

function Palette({ closing }: { closing: boolean }) {
  const t = useT()
  const pages = useMemo(palettePages, [])
  const dex = useDexStore((s) => s.dex)
  const settings = useSettings()
  const shinyView = useUiStore((s) => s.dexView.shinyView)
  const editorOpen = useUiStore((s) => s.entryEditor.open)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recent] = useState(readRecent)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`

  const close = (): void => useUiStore.getState().setCommandPalette(false)

  // Order matters on close: the page stops being inert first, so the focus trap can then hand
  // focus back to an element inside it (an inert element cannot take focus).
  useModalRoot(!closing)
  useEscapeLayer(!closing, close)
  useFocusTrap(!closing, panelRef, inputRef)

  useLayoutEffect(() => {
    popIn(panelRef.current, { from: 0.965 })
  }, [])

  const live = useMemo(
    () => buildPalette({ dex, query, recent, pages, shinyView, theme: settings.theme, reduceMotion: settings.reduceMotion, editorOpen }),
    [dex, query, recent, pages, shinyView, settings.theme, settings.reduceMotion, editorOpen]
  )
  // While it fades out the list stays as it was: the action that was just run has already changed what it would say.
  const shown = useRef(live)
  if (!closing) shown.current = live
  const sections = shown.current
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const current = Math.min(active, items.length - 1)

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current, items])

  const run = (item: PaletteItem): void => {
    if (item.kind === 'pokemon') {
      close()
      navigate(paths.species(item.species.id, item.form.f))
    } else if (item.kind === 'page') {
      close()
      navigate(item.href)
    } else if (item.action === 'log') {
      // `openCreate` closes the palette itself.
      if (item.target) useUiStore.getState().openCreate({ species: item.target.species.id, form: item.target.form.f })
    } else if (item.action === 'shiny') {
      close()
      useUiStore.getState().setDexView({ shinyView: !shinyView })
      toast({ kind: 'info', icon: 'sparkle', title: shinyView ? t('search.toast.shiny.off') : t('search.toast.shiny.on'), body: shinyView ? undefined : t('search.toast.shiny.on.body') })
    } else if (item.action === 'theme') {
      close()
      useSaveStore.getState().setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
    } else {
      close()
      useSaveStore.getState().setSettings({ reduceMotion: !settings.reduceMotion })
      toast({ kind: 'info', icon: 'motion', title: settings.reduceMotion ? t('search.toast.motion.off') : t('search.toast.motion.on') })
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const last = items.length - 1
    const { key } = event
    if (key === 'Tab') {
      // The search box is the only stop; focus stays in the palette.
      event.preventDefault()
      return
    }
    if (last < 0) return
    let next: number | null = null
    if (key === 'ArrowDown') next = current >= last ? 0 : current + 1
    else if (key === 'ArrowUp') next = current <= 0 ? last : current - 1
    else if (key === 'Home' && !event.shiftKey) next = 0
    else if (key === 'End' && !event.shiftKey) next = last
    else if (key === 'PageDown') next = Math.min(last, current + 6)
    else if (key === 'PageUp') next = Math.max(0, current - 6)
    else if (key === 'Enter') {
      event.preventDefault()
      const item = items[current]
      if (item) run(item)
      return
    }
    if (next === null) return
    event.preventDefault()
    setActive(next)
  }

  const searching = query.trim() !== ''
  let index = -1

  return (
    <Portal>
      <div
        className="cmdk"
        data-state={closing ? 'closing' : 'open'}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div ref={panelRef} className="cmdk__panel" role="dialog" aria-modal="true" aria-label={t('search.label')} tabIndex={-1}>
          <div className="cmdk__search">
            <Icon name="search" size={20} className="cmdk__search-icon" />
            <input
              ref={inputRef}
              className="cmdk__input"
              type="text"
              role="combobox"
              aria-label={t('search.input')}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={items[current] ? `${baseId}-${items[current].id}` : undefined}
              placeholder={t('search.input')}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
            />
            <Kbd>Esc</Kbd>
          </div>

          <div ref={listRef} id={listId} role="listbox" aria-label={t('search.results')} className="cmdk__list" onMouseDown={(event) => event.preventDefault()}>
            {items.length === 0 && (
              <div className="cmdk__empty">
                <Icon name="search" size={22} />
                <p className="cmdk__empty-title">{t('search.empty.title', { query: query.trim() })}</p>
                <p className="cmdk__empty-hint">{t('search.empty.hint')}</p>
              </div>
            )}
            {sections.map((section) => (
              <div key={section.id} role="group" aria-labelledby={`${baseId}-${section.id}`} className="cmdk__group">
                <div id={`${baseId}-${section.id}`} className="cmdk__group-title u-eyebrow">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  index++
                  const at = index
                  const selected = at === current
                  return (
                    <div
                      key={item.id}
                      id={`${baseId}-${item.id}`}
                      role="option"
                      aria-selected={selected}
                      className={cx('cmdk-item', `cmdk-item--${item.kind}`, selected && 'is-active')}
                      onPointerMove={() => at !== current && setActive(at)}
                      onClick={() => run(item)}
                    >
                      {item.kind === 'pokemon' ? (
                        <PokemonRow item={item} shinyView={shinyView} />
                      ) : item.kind === 'action' ? (
                        <ActionRow item={item} />
                      ) : (
                        <>
                          <span className="cmdk-item__icon">
                            <Icon name={item.icon} size={18} />
                          </span>
                          <span className="cmdk-item__text">
                            <span className="cmdk-item__label">{item.label}</span>
                          </span>
                        </>
                      )}
                      <span className="cmdk-item__enter" aria-hidden="true">
                        <Kbd>↵</Kbd>
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="cmdk__footer" aria-hidden="true">
            <span className="cmdk__key">{rich('search.footer.move', { keys: () => <Kbd keys={['↑', '↓']} /> })}</span>
            <span className="cmdk__key">{rich('search.footer.open', { keys: () => <Kbd>↵</Kbd> })}</span>
            <span className="cmdk__key">{rich('search.footer.close', { keys: () => <Kbd>Esc</Kbd> })}</span>
          </div>
          <span className="u-sr-only" role="status">
            {searching ? (items.length === 0 ? t('search.status.none') : t('search.status.count', { count: items.length })) : ''}
          </span>
        </div>
      </div>
    </Portal>
  )
}

export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPalette)
  const presence = usePresence(open, EXIT_MS)
  useRecentTracker()
  if (presence === null) return null
  return <Palette closing={presence === 'closing'} />
}
