/**
 * Hash routing for wouter that also works under file://.
 *
 * Everything lives in the fragment, query string included: `#/dex/25?form=1`. (wouter's stock
 * hash hook moves the query into `location.search`, where it then survives later navigations.)
 * Use wouter's own hooks in pages: `useLocation`, `useParams`, `useSearch`, `<Link href>`.
 */

import { useSyncExternalStore } from 'react'
import type { BaseLocationHook } from 'wouter'

const listeners = new Set<() => void>()
let lastNavigation: 'push' | 'replace' | 'pop' = 'pop'

function emit(): void {
  for (const listener of [...listeners]) listener()
}

function onExternalChange(): void {
  // Back / forward buttons and hand-edited URLs.
  lastNavigation = 'pop'
  emit()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('hashchange', onExternalChange)
    window.addEventListener('popstate', onExternalChange)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('hashchange', onExternalChange)
      window.removeEventListener('popstate', onExternalChange)
    }
  }
}

const hashBody = (): string => window.location.hash.replace(/^#\/?/, '')

function currentPath(): string {
  const body = hashBody()
  const cut = body.indexOf('?')
  return `/${cut < 0 ? body : body.slice(0, cut)}`
}

function currentSearch(): string {
  const body = hashBody()
  const cut = body.indexOf('?')
  return cut < 0 ? '' : body.slice(cut + 1)
}

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  replace?: boolean
  state?: unknown
}

/** Goes to an app path such as `/dex/25?form=1`. Usable outside React. */
export function navigate(to: string, options: NavigateOptions = {}): void {
  const target = `#/${to.replace(/^#?\/?/, '')}`
  if (target === (window.location.hash || '#/') && !options.replace) return
  lastNavigation = options.replace ? 'replace' : 'push'
  window.history[options.replace ? 'replaceState' : 'pushState'](options.state ?? null, '', target)
  emit()
}

/** How the current location was reached; "pop" means back / forward (restore scroll), else start at the top. */
export function navigationType(): 'push' | 'replace' | 'pop' {
  return lastNavigation
}

export function goBack(fallback: string): void {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback, { replace: true })
}

const useHashSearch = (): string => useSyncExternalStore(subscribe, currentSearch, () => '')

/** Location hook for `<Router hook={useHashLocation}>`. */
export const useHashLocation: BaseLocationHook = Object.assign((): [string, typeof navigate] => [useSyncExternalStore(subscribe, currentPath, () => '/'), navigate], {
  hrefs: (href: string): string => `#${href}`,
  searchHook: useHashSearch
})

/** Builders for every app path; use these instead of string literals. */
export const paths = {
  home: (): string => '/',
  dex: (): string => '/dex',
  species: (id: number, form?: number): string => (form !== undefined && form > 0 ? `/dex/${id}?form=${form}` : `/dex/${id}`),
  living: (): string => '/living',
  homeDex: (): string => '/home-dex',
  journal: (): string => '/journal',
  achievements: (): string => '/achievements',
  settings: (): string => '/settings',
  kit: (): string => '/_kit'
} as const
