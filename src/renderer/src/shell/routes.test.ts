import { describe, expect, it } from 'vitest'
import { paths } from './router'
import { matchRoute, NAV_ITEMS, ROUTE_BY_ID, ROUTES } from './routes'

describe('routes', () => {
  it('lists the HOME Dex right under the Living Dex in the navigation', () => {
    expect(NAV_ITEMS.map((item) => item.id)).toEqual(['home', 'dex', 'living', 'homedex', 'journal', 'achievements', 'settings'])
    expect(NAV_ITEMS.find((item) => item.id === 'homedex')).toMatchObject({ label: 'HOME Dex', href: '/home-dex' })
  })

  it('gives every navigation item a route of its own', () => {
    for (const item of NAV_ITEMS) {
      expect(ROUTE_BY_ID.get(item.id)?.nav).toBe(item.id)
      expect(matchRoute(item.href)?.id).toBe(item.id)
    }
    expect(new Set(ROUTES.map((r) => r.path)).size).toBe(ROUTES.length)
  })

  it('routes /home-dex to the HOME Dex page', () => {
    expect(paths.homeDex()).toBe('/home-dex')
    expect(matchRoute('/home-dex')).toMatchObject({ id: 'homedex', title: 'HOME Dex', nav: 'homedex' })
    expect(matchRoute('/living')?.id).toBe('living')
    expect(matchRoute('/home-dex/extra')).toBeNull()
  })
})
