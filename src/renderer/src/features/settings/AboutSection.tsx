import type { ReactNode } from 'react'
import logo from '@renderer/assets/logo-small.png'
import { Chip, Kbd } from '@renderer/components/ui'
import { useDex } from '@renderer/lib/data'
import { formatCount, formatDate } from '@renderer/lib/format'
import { ExternalLink, Fact, SettingsSection, type AppInfoState } from './parts'
import { shortCommit } from './settings-model'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const LINKS = {
  pkhex: 'https://github.com/kwsch/PKHeX',
  pokeapi: 'https://pokeapi.co/',
  sprites: 'https://github.com/PokeAPI/sprites',
  gpl: 'https://www.gnu.org/licenses/gpl-3.0.html'
} as const

interface Shortcut {
  keys: readonly string[]
  /** A second way to press it, shown after "or". */
  alt?: readonly string[]
  does: string
  where: string
}

const SHORTCUTS: readonly Shortcut[] = [
  { keys: [MOD, 'K'], does: 'Search for any Pokémon', where: 'Anywhere' },
  { keys: ['/'], does: 'Jump to the search box', where: 'Pokédex' },
  { keys: ['←'], alt: ['→'], does: 'Previous or next Pokémon', where: 'Pokémon page' },
  { keys: [MOD, 'Enter'], does: 'Save the entry', where: 'Entry editor' },
  { keys: ['F6'], does: 'Jump to the newest notification and back', where: 'Anywhere' },
  { keys: ['Esc'], does: 'Close a dialog, menu or search', where: 'Anywhere' }
]

function Credit({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="settings-credit">
      <span className="settings-credit__title">{title}</span>
      <span className="settings-credit__text">{children}</span>
    </li>
  )
}

export function AboutSection({ app }: { app: AppInfoState }) {
  const dex = useDex()
  const { meta } = dex
  const version = app.info?.version

  return (
    <SettingsSection id="about" description="The app, the data behind it, and the people whose work it stands on.">
      <div className="settings-about">
        <div className="settings-about__logo">
          <img src={logo} alt="Pelagix" draggable={false} />
        </div>
        <div className="settings-about__text">
          <div className="settings-about__name">
            Pelagix
            {version !== undefined ? <Chip size="sm" tone="accent">{`Version ${version}`}</Chip> : !app.desktop && <Chip size="sm">Running in a browser</Chip>}
          </div>
          <p className="settings-text">A Living Dex tracker for every Pokémon game: find a Pokémon, see where it can be obtained, and log each one you catch.</p>
          {app.info && (
            <p className="settings-about__runtime">
              Electron {app.info.electron} · Chromium {app.info.chrome}
            </p>
          )}
          {app.error !== null && <p className="settings-about__runtime">{app.error}</p>}
        </div>
      </div>

      <h3 className="settings-subtitle">Pokédex data</h3>
      {dex.isFixture && <p className="settings-text settings-text--warning">A small development sample is loaded, not the full dataset.</p>}
      <dl className="settings-facts">
        <Fact label="Pokémon">{formatCount(meta.counts.species)}</Fact>
        <Fact label="Forms">{formatCount(meta.counts.forms)}</Fact>
        <Fact label="Ways to obtain">{formatCount(meta.counts.rows)}</Fact>
        <Fact label="Games">{formatCount(dex.games.length)}</Fact>
        <Fact label="Data built">{formatDate(meta.builtAt, 'long') || 'Unknown'}</Fact>
        <Fact label="PKHeX">{meta.pkhexVersion || 'Unknown'}</Fact>
        <Fact label="PokeAPI">
          <code className="u-selectable" title={meta.pokeapiCommit}>
            {shortCommit(meta.pokeapiCommit) || 'Unknown'}
          </code>
        </Fact>
        <Fact label="Sprites">
          <code className="u-selectable" title={meta.spritesCommit}>
            {shortCommit(meta.spritesCommit) || 'Unknown'}
          </code>
        </Fact>
      </dl>

      <h3 className="settings-subtitle">Keyboard shortcuts</h3>
      <ul className="settings-shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.does} className="settings-shortcut">
            <span className="settings-shortcut__keys">
              <Kbd keys={shortcut.keys} />
              {shortcut.alt && (
                <>
                  <span className="settings-shortcut__or">or</span>
                  <Kbd keys={shortcut.alt} />
                </>
              )}
            </span>
            <span className="settings-shortcut__does">{shortcut.does}</span>
            <span className="settings-shortcut__where">{shortcut.where}</span>
          </li>
        ))}
      </ul>

      <h3 className="settings-subtitle">Credits and licences</h3>
      <ul className="settings-credits">
        <Credit title="Encounters and forms">
          Where each Pokémon can be obtained, and the list of forms, are derived from <ExternalLink href={LINKS.pkhex}>PKHeX</ExternalLink>, which is published under the <ExternalLink href={LINKS.gpl}>GNU General Public License v3</ExternalLink>.
        </Credit>
        <Credit title="Names and details">
          Names, types, Pokédex text and other details come from <ExternalLink href={LINKS.pokeapi}>PokeAPI</ExternalLink>.
        </Credit>
        <Credit title="Renders">
          Pokémon HOME renders are loaded from the <ExternalLink href={LINKS.sprites}>PokeAPI sprites</ExternalLink> repository. They are not part of Pelagix.
        </Credit>
      </ul>
      <p className="settings-legal">
        Pokémon and all related names and images are trademarks and copyright of Nintendo, Game Freak, Creatures and The Pokémon Company. Pelagix is an unofficial, fan-made tool. It is not affiliated with, sponsored by or endorsed by any of them.
      </p>
    </SettingsSection>
  )
}
