/**
 * What a shot can do with the running app: go somewhere, click and type like a user, wait until
 * the page has really finished arriving, and take the picture.
 */

import { sleep } from './cdp.mjs'

/** Finds one element in the page. `target` is a CSS selector, or `{ css, text }` to pick by visible text. */
const FIND = `
  const find = (target) => {
    if (typeof target === 'string') return document.querySelector(target)
    const wanted = target.text
    const list = [...document.querySelectorAll(target.css)].filter((el) => el.getClientRects().length > 0)
    const text = (el) => (el.innerText ?? el.textContent ?? '').replace(/\\s+/g, ' ').trim()
    return (target.exact === false ? undefined : list.find((el) => text(el) === wanted)) ?? list.find((el) => text(el).startsWith(wanted)) ?? list.find((el) => text(el).includes(wanted)) ?? null
  }
`

export function createStage(page, { log = () => {} } = {}) {
  /** A resting place for the pointer: the empty strip between the rail and the page. */
  const REST = { x: 229, y: 470 }

  async function restPointer() {
    await page.moveTo(REST.x, REST.y)
  }

  /**
   * Navigates like a typed address: the app's hash router picks it up. The app treats that like
   * Back / Forward and puts the page where it was scrolled to last time, so give it a moment.
   */
  async function goto(path) {
    await page.evaluate(`location.hash = args.hash`, { hash: `#${path}` })
    await sleep(150)
  }

  /** Goes to a page and makes sure it is at its top. */
  async function open(path) {
    await goto(path)
    await scrollMain(0)
  }

  /**
   * Brings an element into view by scrolling only the containers the user can scroll. Never
   * `scrollIntoView`: that also shifts the app frame itself, which is clipped but not locked.
   */
  const REVEAL = `
    const scrollable = (el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
    const reveal = (el) => {
      for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
        if (!scrollable(box)) continue
        const frame = box.getBoundingClientRect()
        const top = Math.max(frame.top, 48) + 12
        const bottom = Math.min(frame.bottom, innerHeight) - 12
        const r = el.getBoundingClientRect()
        if (r.top < top || r.bottom > bottom) box.scrollTop = Math.round(box.scrollTop + r.top + r.height / 2 - (top + bottom) / 2)
      }
    }
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  `

  /** Centre of an element in viewport coordinates, after scrolling it into view when needed. */
  async function pointOf(target, { scroll = true } = {}) {
    return page.evaluate(
      `${FIND}${REVEAL}
      const el = find(args.target)
      if (!el) return null
      if (args.scroll) {
        reveal(el)
        await frames()
      }
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }`,
      { target, scroll }
    )
  }

  async function exists(target) {
    return page.evaluate(`${FIND} return !!find(args.target)`, { target })
  }

  async function waitForElement(target, timeoutMs = 10_000) {
    const ok = await page.waitFor(`${FIND} return !!find(args.target)`, { args: { target }, timeoutMs })
    if (!ok) throw new Error(`Not found in the page: ${JSON.stringify(target)}`)
  }

  /** A real mouse click on the element. */
  async function click(target, options) {
    await waitForElement(target)
    const point = await pointOf(target, options)
    await page.clickAt(point.x, point.y)
    await sleep(120)
  }

  /** Scrolls the page's own scroll container (the main region) to an absolute offset. */
  async function scrollMain(top) {
    await page.evaluate(
      `const scroller = [...document.querySelectorAll('.shell-main, .shell-main *')].find((el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))
      if (scroller) scroller.scrollTo({ top: args.top, behavior: 'instant' })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`,
      { top }
    )
  }

  /**
   * Scrolls so the element's top edge sits `offset` px below the title bar. Measured once the
   * page has stopped moving: a page that is still sliding in is not where it will end up.
   */
  async function scrollToElement(target, offset = 24) {
    await waitForElement(target)
    await page.evaluate(QUIET, { quietMs: 250, maxMs: 10_000 })
    await page.evaluate(
      `${FIND}
      const el = find(args.target)
      let scroller = el.parentElement
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement
      if (!scroller) return
      const delta = el.getBoundingClientRect().top - (scroller.getBoundingClientRect().top + args.offset)
      scroller.scrollTo({ top: Math.round(scroller.scrollTop + delta), behavior: 'instant' })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`,
      { target, offset }
    )
  }

  /** Closes every toast with its own close button and waits until none is left. */
  async function clearToasts() {
    for (let round = 0; round < 8; round++) {
      const point = await pointOf('.ui-toast__close', { scroll: false })
      if (!point) break
      await page.clickAt(point.x, point.y)
      await sleep(250)
    }
    await page.waitFor(`return document.querySelectorAll('.ui-toast').length === 0`, { timeoutMs: 15_000 })
    await restPointer()
  }

  /**
   * What is still arriving in the visible part of the page: sprites that have not loaded (or have
   * given up), other images, loading skeletons and web fonts.
   */
  const IN_VIEW = `
    const inView = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false
      for (let p = el; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (s.visibility === 'hidden' || s.display === 'none') return false
      }
      return true
    }
  `
  const PENDING = `${IN_VIEW}
    const sprites = [...document.querySelectorAll('.pk-sprite')].filter(inView)
    const failed = sprites.filter((s) => !s.querySelector('img')).length
    const loading = sprites.filter((s) => s.querySelector('img') && !s.classList.contains('is-loaded')).length
    const images = [...document.images].filter((img) => !img.closest('.pk-sprite') && inView(img) && !(img.complete && img.naturalWidth > 0)).length
    // Anywhere on the page, not only in view: what replaces a skeleton changes the page's height (and its scrollbar).
    const skeletons = [...document.querySelectorAll('.ui-skeleton, [aria-busy="true"]')].filter((el) => el.getClientRects().length > 0).length
    const fonts = document.fonts.status === 'loaded' ? 0 : 1
    return { sprites: sprites.length, failed, loading, images, skeletons, fonts }
  `

  /**
   * Resolves true once nothing has moved for `quietMs`: no running animation or transition that
   * ends (CSS or Web Animations), no change to the document (anime.js tweens write inline
   * styles and count-ups write text, so both show up as mutations) and no scrolling (the app
   * glides to a section or a slot with smooth scrolls). Decorative loops never end
   * and are left out: CSS ones by their infinite iteration count, the two scripted ones (the
   * floating logo of the Home hero and of the welcome screen) by selector.
   */
  const QUIET = `
    const loops = '.home-hero__logo-img, .home-welcome__logo-img'
    const running = () => document.getAnimations().some((a) => {
      if (a.playState !== 'running' && a.playState !== 'pending') return false
      const timing = a.effect?.getComputedTiming?.()
      return !timing || Number.isFinite(timing.endTime)
    })
    let last = performance.now()
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target.nodeType === 1 ? record.target : record.target.parentElement
        if (el && el.closest(loops)) continue
        last = performance.now()
        return
      }
    })
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true })
    const onScroll = () => { last = performance.now() }
    document.addEventListener('scroll', onScroll, true)
    const deadline = performance.now() + args.maxMs
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 80))
        const now = performance.now()
        if (running()) last = now
        else if (now - last >= args.quietMs) return true
        if (now > deadline) return false
      }
    } finally {
      observer.disconnect()
      document.removeEventListener('scroll', onScroll, true)
    }
  `

  /** Rewinds the decorative CSS loops (the shiny twinkle and friends) to their resting first frame, or lets them run again. */
  const LOOPS = `
    const loops = document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity)
    for (const a of loops) {
      if (args.hold) { a.pause(); a.currentTime = 0 } else a.play()
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return loops.length
  `

  /**
   * Text that is on screen but cut short with an ellipsis: worth knowing about before a picture
   * goes into a README. Only what is really showing counts (not what a scrolled list hides).
   */
  const CUT_TEXT = `${IN_VIEW}
    const out = new Set()
    for (const el of document.querySelectorAll('body *')) {
      const text = el.textContent.trim()
      if (text === '' || el.closest('.u-sr-only')) continue
      const s = getComputedStyle(el)
      const ellipsis = s.textOverflow === 'ellipsis' && s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1
      const clamped = s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '' && el.scrollHeight > el.clientHeight + 1
      if (!(ellipsis || clamped) || !inView(el)) continue
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(Math.min(innerWidth - 1, r.left + Math.min(r.width, 20) / 2), Math.min(innerHeight - 1, r.top + r.height / 2))
      if (top && (el.contains(top) || top.contains(el))) out.add(text.slice(0, 70))
    }
    return [...out]
  `

  /** Remarks about the last capture (text cut short on screen); the caller prints and clears them. */
  const remarks = []

  /**
   * Waits until the page is ready for its picture, then takes it: fonts in, every visible sprite
   * and image decoded, no skeletons, entrance animations and count-ups finished. A sprite that
   * failed to download is given another chance by `retry` (which should re-enter the page).
   */
  async function capture({ retry, timeoutMs = 90_000, quietMs = 500, minMs = 700 } = {}) {
    const deadline = Date.now() + timeoutMs
    let retries = 0
    await restPointer() // nothing is hovered in a picture
    await sleep(minMs) // delayed entrance animations have not started yet right after a navigation
    for (;;) {
      const pending = await page.evaluate(PENDING)
      const waiting = pending.failed + pending.loading + pending.images + pending.skeletons + pending.fonts
      if (pending.failed > 0 && retry && retries < 4) {
        retries++
        log(`  ${pending.failed} sprite(s) failed to download, retrying (${retries})`)
        await sleep(1500)
        await retry()
        await sleep(minMs)
        continue
      }
      if (Date.now() > deadline) throw new Error(`The page did not finish loading: ${JSON.stringify(pending)}`)
      if (waiting > 0) {
        await sleep(150)
        continue
      }
      const quiet = await page.evaluate(QUIET, { quietMs, maxMs: 30_000 })
      if (!quiet) throw new Error('The page never stopped moving.')
      // Something may have come into view (or started loading) while things were still moving.
      const after = await page.evaluate(PENDING)
      if (after.failed + after.loading + after.images + after.skeletons + after.fonts === 0) break
    }
    await page.evaluate(`await document.fonts.ready; await Promise.all([...document.images].filter((i) => i.complete && i.naturalWidth > 0).map((i) => i.decode().catch(() => {})))`)
    // The app frame is clipped, not locked: a stray scrollIntoView can push all of it out of place.
    const frame = await page.evaluate(`const r = document.querySelector('.shell').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), scroll: document.scrollingElement.scrollTop }`)
    if (frame.x !== 0 || frame.y !== 0 || frame.scroll !== 0) throw new Error(`The app frame is displaced by ${frame.x},${frame.y} px.`)
    // "Fixture data" and "Not saved" are the two warnings the title bar can carry; neither belongs in a README.
    const warning = await page.evaluate(`return document.querySelector('.shell-topbar__flag')?.innerText.trim() ?? null`)
    if (warning !== null) throw new Error(`The title bar shows a warning: "${warning}".`)
    const toasts = await page.evaluate(`return document.querySelectorAll('.ui-toast').length`)
    if (toasts > 0) throw new Error('A notification is on screen.')
    for (const text of await page.evaluate(CUT_TEXT)) remarks.push(`text cut short on screen: "${text}"`)
    await page.evaluate(LOOPS, { hold: true })
    try {
      return await page.screenshot()
    } finally {
      await page.evaluate(LOOPS, { hold: false })
    }
  }

  return { page, goto, open, click, exists, pointOf, waitForElement, scrollMain, scrollToElement, clearToasts, restPointer, capture, remarks, sleep }
}
