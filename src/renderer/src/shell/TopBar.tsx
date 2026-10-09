import { useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { Chip, Icon, IconButton, Kbd, Tooltip } from '@renderer/components/ui'
import { useDex } from '@renderer/lib/data'
import { dexNo } from '@renderer/lib/format'
import { useSaveStore } from '@renderer/store/save'
import { useUiStore } from '@renderer/store/ui'
import { matchRoute, ROUTE_BY_ID, type RouteDef } from './routes'
import './TopBar.css'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

/** Title of the current page; a species route shows the Pokémon's number and name. */
function usePageTitle(route: RouteDef | null, path: string): string {
  const dex = useDex()
  if (!route) return 'Not found'
  if (route.id !== 'species') return route.title
  const id = Number(path.split('/')[2])
  const species = Number.isInteger(id) ? dex.species(id) : undefined
  return species ? `${dexNo(species.id)}  ${species.name}` : route.title
}

/**
 * The 40 px title bar. The bar itself drags the window; its controls opt out. In Electron the
 * right end stays clear for the native window buttons.
 */
export function TopBar() {
  const [path] = useLocation()
  const route = matchRoute(path)
  const title = usePageTitle(route, path)
  const parent = route?.parent ? ROUTE_BY_ID.get(route.parent) : undefined
  const dex = useDex()
  const saveError = useSaveStore((s) => s.lastError)
  const shinyView = useUiStore((s) => s.dexView.shinyView)
  const setDexView = useUiStore((s) => s.setDexView)
  const openPalette = useUiStore((s) => s.setCommandPalette)

  useEffect(() => {
    document.title = route?.id === 'home' ? 'Pelagix' : `${title.replace(/\s+/g, ' ')} · Pelagix`
  }, [route, title])

  return (
    <header className="shell-topbar">
      <div className="shell-topbar__title">
        {parent && (
          <>
            <Link href={parent.path} className="shell-topbar__crumb">
              {parent.title}
            </Link>
            <Icon name="chevron-right" size={14} className="shell-topbar__sep" />
          </>
        )}
        {/* Not a heading: every page carries its own <h1>. */}
        <span className="shell-topbar__current">{title}</span>
        {dex.isFixture && (
          <Tooltip content="The real datasets were not found, so a small development fixture is loaded. Run npm run data." placement="bottom">
            <span className="shell-topbar__flag">
              <Chip size="sm" tone="warning" icon="warning">
                Fixture data
              </Chip>
            </span>
          </Tooltip>
        )}
      </div>

      <div className="shell-topbar__actions">
        {saveError !== null && (
          <Tooltip content={saveError} placement="bottom">
            <span className="shell-topbar__flag" role="status">
              <Chip size="sm" tone="danger" icon="warning">
                Not saved
              </Chip>
            </span>
          </Tooltip>
        )}
        <button type="button" className="shell-search" aria-keyshortcuts="Control+K" onClick={() => openPalette(true)}>
          <Icon name="search" size={15} />
          <span className="shell-search__label">Search Pokémon…</span>
          <Kbd keys={[isMac ? '⌘' : 'Ctrl', 'K']} />
        </button>
        <IconButton
          icon="sparkle"
          size="sm"
          label={shinyView ? 'Shiny view is on' : 'Shiny view is off'}
          tooltip={shinyView ? 'Showing shiny sprites' : 'Show shiny sprites'}
          tooltipPlacement="bottom"
          pressed={shinyView}
          className="shell-topbar__shiny"
          onClick={() => setDexView({ shinyView: !shinyView })}
        />
      </div>
      <div className="shell-topbar__window-controls" aria-hidden="true" />
    </header>
  )
}
