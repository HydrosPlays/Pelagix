/**
 * The README screenshots: for each file, how to get the app into the state it shows.
 * Everything is done the way a user would: addresses, real clicks, real key presses.
 */

const CTRL = 2

/**
 * Closes whatever is open on top of the page: dialogs, the drawer, the command palette, menus.
 * An entry editor with something filled in asks before it goes; the answer is "Discard".
 */
async function closeLayers(stage) {
  const LAYERS = '.ui-modal, .cmdk, .dex-pop, .ui-listbox, .ui-menu'
  for (let round = 0; round < 8; round++) {
    const discard = { css: '.ui-modal button', text: 'Discard' }
    if (await stage.exists(discard)) await stage.click(discard)
    else if (await stage.exists(LAYERS)) await stage.page.press('Escape')
    else return
    await stage.sleep(350) // exit animation
  }
  throw new Error('A dialog would not close.')
}

/** Switches the theme in Settings > Appearance, like a user would. */
async function setTheme(stage, theme) {
  const current = await stage.page.evaluate(`return document.documentElement.dataset.theme`)
  if (current === theme) return
  await stage.goto('/settings')
  await stage.click({ css: '.settings-index__link', text: 'Appearance' })
  await stage.click({ css: '.settings-section .ui-seg__item', text: theme === 'light' ? 'Light' : 'Dark' })
  const applied = await stage.page.waitFor(`return document.documentElement.dataset.theme === args.theme`, { args: { theme }, timeoutMs: 5000 })
  if (!applied) throw new Error(`The theme did not change to ${theme}.`)
}

/**
 * Puts the app back into its neutral state and steps onto an empty address, so the next page is
 * mounted from scratch (which is also what gives a sprite that failed to download a new try):
 * dialogs closed, shiny view off, dark theme.
 */
async function leave(stage, { theme = 'dark' } = {}) {
  await closeLayers(stage)
  if (await stage.exists('.shell-topbar__shiny[aria-pressed="true"]')) await stage.click('.shell-topbar__shiny')
  await setTheme(stage, theme)
  await stage.goto('/_blank')
  await stage.sleep(120)
}

function shot(file, setup, options = {}) {
  return {
    file,
    async take(stage) {
      const enter = async () => {
        await leave(stage, options)
        await stage.restPointer()
        await setup(stage)
      }
      await enter()
      return stage.capture({ retry: enter })
    }
  }
}

/** A species page with one game picked in "Where to find it". */
async function openSpecies(stage, path, game) {
  await stage.open(path)
  await stage.waitForElement('.sp-where')
  if (game) await stage.click(`.sp-game[aria-label^="${game}:"]`)
}

export const SHOTS = [
  shot('01-home.png', async (stage) => {
    await stage.open('/')
  }),

  shot('02-pokedex.png', async (stage) => {
    await stage.open('/dex?view=species&sort=number')
  }),

  // "What can I still get in Scarlet?": obtainable there, not in the Living Dex yet.
  shot('03-pokedex-filters.png', async (stage) => {
    await stage.open('/dex?game=scarlet&missing=1&view=species&sort=number')
  }),

  shot('04-species.png', async (stage) => {
    await stage.open('/dex/25')
  }),

  shot('05-where-to-find.png', async (stage) => {
    await openSpecies(stage, '/dex/25', 'Pokémon Shield')
    await stage.scrollToElement('.sp-where', 14)
  }),

  // The editor as the "Log" button of a source opens it, with the catch filled in.
  shot('06-log-entry.png', async (stage) => {
    await openSpecies(stage, '/dex/25', 'Pokémon Shield')
    await stage.scrollToElement('.sp-where', 14)
    await stage.click('.sp-log[aria-label="Log Pikachu: Overworld at Route 4 in Pokémon Shield"]')
    await stage.waitForElement('.ee-dialog')
    await stage.click('.ee-ball[aria-label="Dream Ball"]')
    await stage.click({ css: '.ee-dialog .ui-seg__item', text: 'Female' })
    await stage.click('.ee-dialog input[placeholder="1–100"]')
    await stage.page.type('15')
    await stage.click('.ee-dialog .ui-modal__title') // take the focus out of the level field
  }),

  shot('07-species-entries.png', async (stage) => {
    await stage.open('/dex/25')
    await stage.scrollToElement('.sp-entries', 14)
  }),

  shot('08-living-dex.png', async (stage) => {
    await stage.open('/living')
  }),

  shot('09-living-dex-shiny.png', async (stage) => {
    await stage.open('/living')
    await stage.click({ css: '.living-hero__mode .ui-seg__item', text: 'Shiny' })
  }),

  shot('10-forms.png', async (stage) => {
    await stage.open('/dex/869?form=8')
  }),

  shot('11-journal.png', async (stage) => {
    await stage.open('/journal')
  }),

  shot('12-achievements.png', async (stage) => {
    await stage.open('/achievements')
  }),

  shot('13-settings-rules.png', async (stage) => {
    await stage.open('/settings')
    await stage.click({ css: '.settings-index__link', text: 'Living Dex rules' })
  }),

  shot('14-command-palette.png', async (stage) => {
    await stage.open('/')
    await stage.waitForElement('.home-hero')
    await stage.page.press('k', CTRL)
    await stage.waitForElement('.cmdk__input')
    await stage.page.type('char')
  }),

  shot(
    '15-light-theme.png',
    async (stage) => {
      await stage.open('/dex/133')
    },
    { theme: 'light' }
  ),

  // A slot with several entries: the female Pikachu slot, opened from its box.
  shot('16-living-dex-slot.png', async (stage) => {
    await stage.open('/living')
    await stage.click('.living-slot[data-key="25:f"]')
    await stage.waitForElement('.living-drawer')
  }),

  // A Pokémon that is only reached by evolving: Sylveon in X, with Eevee's own sources opened under it.
  shot('17-evolve-source.png', async (stage) => {
    await openSpecies(stage, '/dex/700', 'Pokémon X')
    await stage.click({ css: '.sp-evo__actions button', text: 'Where to find Eevee' })
    await stage.scrollToElement('.sp-where', 14)
  }),

  // A game in which every source is a past event: Manaphy in Diamond.
  shot('18-event-only.png', async (stage) => {
    await openSpecies(stage, '/dex/490', 'Pokémon Diamond')
    await stage.scrollToElement('.sp-where', 14)
  })
]
