/**
 * Getting keyboard focus back after a modal closes.
 *
 * The shared Dialog / Drawer hand focus back to whatever had it when they opened. That is not
 * always where the keyboard should go next: the element may be gone (a windowed row that was
 * re-rendered, a slot that changed), or it was only the page's main region (what a mouse press on
 * plain content focuses). A page that cares waits until no modal holds the page and then places
 * focus itself.
 */

/** Focus is nowhere useful: on the body, on the page's main region, or on something that left the DOM. */
export function focusIsLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body || !active.isConnected || active.id === 'main'
}

/**
 * Runs `run` once no modal holds the page any more (or after about a second, whichever comes
 * first). `isAlive` lets a component that unmounted in the meantime opt out.
 */
export function whenPageReleased(run: () => void, isAlive: () => boolean = () => true): void {
  let tries = 0
  const attempt = (): void => {
    if (!isAlive()) return
    if (document.getElementById('root')?.inert === true && ++tries < 14) {
      setTimeout(attempt, 60)
      return
    }
    run()
  }
  setTimeout(attempt, 200)
}
