/**
 * A minimal Chrome DevTools Protocol client for the one page of the running app.
 * Uses Node's built-in fetch and WebSocket; no dependencies.
 */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits for the app's page to show up on the debugging port and connects to it. */
export async function connect(port, { timeoutMs = 30_000, alive = () => true } = {}) {
  const deadline = Date.now() + timeoutMs
  let target
  while (!target) {
    if (!alive()) throw new Error('Electron exited before its page was reachable.')
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = list.find((t) => t.type === 'page' && t.url.startsWith('file:'))
    } catch {
      // not listening yet
    }
    if (!target) {
      if (Date.now() > deadline) throw new Error(`No page on debugging port ${port} after ${timeoutMs} ms.`)
      await sleep(150)
    }
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('Could not open the DevTools socket.'))
  })

  let nextId = 0
  const pending = new Map()
  /** Uncaught exceptions and console errors of the page, for the run report. */
  const problems = []
  /** One-shot listeners for protocol events, by method name. */
  const waiters = new Map()
  ws.onmessage = (message) => {
    const msg = JSON.parse(message.data)
    const waiting = msg.method !== undefined ? waiters.get(msg.method) : undefined
    if (waiting) {
      waiters.delete(msg.method)
      for (const resolve of waiting) resolve(msg.params)
    }
    if (msg.id !== undefined) {
      const waiter = pending.get(msg.id)
      pending.delete(msg.id)
      if (!waiter) return
      if (msg.error) waiter.reject(new Error(`${waiter.method}: ${msg.error.message}`))
      else waiter.resolve(msg.result)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      problems.push(`exception: ${d.exception?.description ?? d.text}`)
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      problems.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`)
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`.trim())
    }
  }
  ws.onclose = () => {
    for (const waiter of pending.values()) waiter.reject(new Error(`${waiter.method}: the DevTools socket closed.`))
    pending.clear()
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject, method })
      ws.send(JSON.stringify({ id, method, params }))
    })

  /**
   * Runs the body of an async function in the page and returns its (JSON) result.
   * `args` is available inside as `args`.
   */
  async function evaluate(body, args = {}) {
    const expression = `(async (args) => { ${body} })(${JSON.stringify(args)})`
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(`In page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n${body.slice(0, 300)}`)
    return r.result.value
  }

  /** Resolves with the parameters of the next protocol event of that name. */
  const once = (method) =>
    new Promise((resolve) => {
      if (!waiters.has(method)) waiters.set(method, [])
      waiters.get(method).push(resolve)
    })

  /**
   * Polls `body` (which returns a truthy value when done) until it does. Returns that value, or
   * null on timeout. A page that is in the middle of loading simply counts as "not yet".
   */
  async function waitFor(body, { args = {}, timeoutMs = 15_000, everyMs = 100 } = {}) {
    const end = Date.now() + timeoutMs
    for (;;) {
      let value = null
      try {
        value = await evaluate(body, args)
      } catch (err) {
        if (!/navigated or closed|context was destroyed|Cannot find context|Execution context/i.test(err.message)) throw err
      }
      if (value) return value
      if (Date.now() > end) return null
      await sleep(everyMs)
    }
  }

  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra })

  async function moveTo(x, y) {
    await mouse('mouseMoved', x, y)
  }

  async function clickAt(x, y) {
    await mouse('mouseMoved', x, y)
    await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 })
    await mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 })
  }

  const VK = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, End: 35, Home: 36 }

  /** Presses one key. `modifiers`: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift. */
  async function press(key, modifiers = 0) {
    const named = VK[key]
    const code = named !== undefined ? key : `Key${key.toUpperCase()}`
    const vk = named ?? key.toUpperCase().charCodeAt(0)
    const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
    if (key === 'Enter' && modifiers === 0) await send('Input.dispatchKeyEvent', { type: 'char', ...base, text: '\r' })
    else if (named === undefined && modifiers === 0) await send('Input.dispatchKeyEvent', { type: 'char', ...base, text: key })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  }

  /** Types text into the focused field, one character at a time (so per-keystroke handlers run). */
  async function type(text, delayMs = 25) {
    for (const ch of text) {
      await send('Input.insertText', { text: ch })
      await sleep(delayMs)
    }
  }

  async function screenshot() {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    return Buffer.from(r.data, 'base64')
  }

  function close() {
    try {
      ws.close()
    } catch {
      // already closed
    }
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')

  return { send, once, evaluate, waitFor, moveTo, clickAt, press, type, screenshot, close, problems }
}
