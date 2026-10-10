import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Route, Switch, useLocation, useSearch } from 'wouter'
import { Button, EmptyState, ErrorBoundary, ScrollArea, Spinner } from '@renderer/components/ui'
import AchievementWatcher from '@renderer/features/achievements/AchievementWatcher'
import EntryEditorHost from '@renderer/features/entry/EntryEditorHost'
import CommandPalette from '@renderer/features/search/CommandPalette'
import { useT } from '@renderer/i18n'
import { pageEnter } from '@renderer/lib/anim'
import { useUiStore } from '@renderer/store/ui'
import { Backdrop } from './Backdrop'
import { NavRail } from './NavRail'
import { navigate, navigationType, paths } from './router'
import { matchRoute, ROUTES } from './routes'
import { TopBar } from './TopBar'
import './AppShell.css'

function NotFound() {
  const t = useT()
  return (
    <div className="page">
      <EmptyState
        size="lg"
        icon="map-pin"
        title={t('shell.notFound.title')}
        description={t('shell.notFound.description')}
        action={
          <Button variant="primary" icon="home" onClick={() => navigate(paths.home())}>
            {t('shell.notFound.back')}
          </Button>
        }
      />
    </div>
  )
}

/** Scroll positions of the main region per location, so Back returns to where the user was. */
const scrollMemory = new Map<string, number>()

/**
 * The application frame: navigation rail, title bar, the scrolling main region with the routed
 * page, and the app-wide hosts (entry editor, achievement watcher, command palette). The toasts
 * and the update windows are mounted one level up, by `App`: they also have to work when this
 * frame cannot be shown.
 */
export function AppShell() {
  const t = useT()
  const [path] = useLocation()
  const search = useSearch()
  const route = matchRoute(path)
  const routeId = route?.id ?? 'not-found'
  const locationKey = search ? `${path}?${search}` : path
  const mainRef = useRef<HTMLDivElement>(null)
  const outletRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef(locationKey)
  keyRef.current = locationKey
  const firstLayout = useRef(true)

  // Remember where each location was scrolled to.
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const onScroll = (): void => {
      scrollMemory.set(keyRef.current, main.scrollTop)
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  // New page: start at the top, or where the user left off when they came back to it.
  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return
    // A language switch mounts the shell afresh on the page it was on: stay where the user was.
    const remounted = firstLayout.current && scrollMemory.has(keyRef.current)
    firstLayout.current = false
    const target = navigationType() === 'pop' || remounted ? (scrollMemory.get(keyRef.current) ?? 0) : 0
    main.scrollTop = target
    if (target === 0) return
    // Virtualised pages reach their full height a frame or two after mounting.
    let tries = 0
    let frame = requestAnimationFrame(function retry() {
      if (Math.abs(main.scrollTop - target) > 1) main.scrollTop = target
      if (++tries < 3) frame = requestAnimationFrame(retry)
    })
    return () => cancelAnimationFrame(frame)
  }, [path])

  useLayoutEffect(() => {
    pageEnter(outletRef.current)
  }, [routeId])

  // Ctrl / Cmd + K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        useUiStore.getState().toggleCommandPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="shell">
      <Backdrop />
      <a href="#main" className="shell-skip" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())}>
        {t('shell.skipToContent')}
      </a>
      <NavRail />
      <TopBar />
      <ScrollArea className="shell-main" scrollRef={mainRef}>
        <main id="main" tabIndex={-1} className="shell-main__content">
          <div ref={outletRef} className="shell-outlet" data-route={routeId}>
            <ErrorBoundary resetKeys={[path]} title={t('shell.pageError')}>
              <Suspense
                fallback={
                  <div className="shell-suspense">
                    <Spinner size={22} />
                  </div>
                }
              >
                <Switch>
                  {ROUTES.map((r) => (
                    <Route key={r.id} path={r.path} component={r.component} />
                  ))}
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </ScrollArea>

      <ErrorBoundary fallback={() => null}>
        <EntryEditorHost />
      </ErrorBoundary>
      <ErrorBoundary fallback={() => null}>
        <CommandPalette />
      </ErrorBoundary>
      <ErrorBoundary fallback={() => null}>
        <AchievementWatcher />
      </ErrorBoundary>
    </div>
  )
}
