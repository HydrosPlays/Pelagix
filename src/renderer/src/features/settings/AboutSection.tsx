import type { ReactNode } from 'react'
import logo from '@renderer/assets/logo-small.png'
import { Chip, Kbd } from '@renderer/components/ui'
import { rich, useT, type MessageKey } from '@renderer/i18n'
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
  /** What it does and where it works: message keys, resolved when shown. */
  does: MessageKey
  where: MessageKey
}

const SHORTCUTS: readonly Shortcut[] = [
  { keys: [MOD, 'K'], does: 'settings.about.shortcut.search', where: 'settings.about.where.anywhere' },
  { keys: ['/'], does: 'settings.about.shortcut.searchBox', where: 'settings.about.where.pokedex' },
  { keys: ['←'], alt: ['→'], does: 'settings.about.shortcut.neighbours', where: 'settings.about.where.species' },
  { keys: [MOD, 'Enter'], does: 'settings.about.shortcut.saveEntry', where: 'settings.about.where.editor' },
  { keys: ['F6'], does: 'settings.about.shortcut.notification', where: 'settings.about.where.anywhere' },
  { keys: ['Esc'], does: 'settings.about.shortcut.close', where: 'settings.about.where.anywhere' }
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
  const t = useT()
  const unknown = t('common.unknown')

  return (
    <SettingsSection id="about" description={t('settings.about.description')}>
      <div className="settings-about">
        <div className="settings-about__logo">
          <img src={logo} alt="Pelagix" draggable={false} />
        </div>
        <div className="settings-about__text">
          <div className="settings-about__name">
            Pelagix
            {version !== undefined ? <Chip size="sm" tone="accent">{t('settings.about.version', { version })}</Chip> : !app.desktop && <Chip size="sm">{t('settings.about.browser')}</Chip>}
          </div>
          <p className="settings-text">{t('settings.about.tagline')}</p>
          {app.info && (
            <p className="settings-about__runtime">
              Electron {app.info.electron} · Chromium {app.info.chrome}
            </p>
          )}
          {app.error !== null && <p className="settings-about__runtime">{app.error}</p>}
        </div>
      </div>

      <h3 className="settings-subtitle">{t('settings.about.data.title')}</h3>
      {dex.isFixture && <p className="settings-text settings-text--warning">{t('settings.about.data.fixture')}</p>}
      <dl className="settings-facts">
        <Fact label={t('settings.about.data.pokemon')}>{formatCount(meta.counts.species)}</Fact>
        <Fact label={t('settings.about.data.forms')}>{formatCount(meta.counts.forms)}</Fact>
        <Fact label={t('settings.about.data.ways')}>{formatCount(meta.counts.rows)}</Fact>
        <Fact label={t('settings.about.data.games')}>{formatCount(dex.games.length)}</Fact>
        <Fact label={t('settings.about.data.built')}>{formatDate(meta.builtAt, 'long') || unknown}</Fact>
        <Fact label="PKHeX">{meta.pkhexVersion || unknown}</Fact>
        <Fact label="PokeAPI">
          <code className="u-selectable" title={meta.pokeapiCommit}>
            {shortCommit(meta.pokeapiCommit) || unknown}
          </code>
        </Fact>
        <Fact label={t('settings.about.data.sprites')}>
          <code className="u-selectable" title={meta.spritesCommit}>
            {shortCommit(meta.spritesCommit) || unknown}
          </code>
        </Fact>
      </dl>

      <h3 className="settings-subtitle">{t('settings.about.shortcuts.title')}</h3>
      <ul className="settings-shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.does} className="settings-shortcut">
            <span className="settings-shortcut__keys">
              <Kbd keys={shortcut.keys} />
              {shortcut.alt && (
                <>
                  <span className="settings-shortcut__or">{t('settings.about.shortcuts.or')}</span>
                  <Kbd keys={shortcut.alt} />
                </>
              )}
            </span>
            <span className="settings-shortcut__does">{t(shortcut.does)}</span>
            <span className="settings-shortcut__where">{t(shortcut.where)}</span>
          </li>
        ))}
      </ul>

      <h3 className="settings-subtitle">{t('settings.about.credits.title')}</h3>
      <ul className="settings-credits">
        <Credit title={t('settings.about.credit.encounters.title')}>
          {rich('settings.about.credit.encounters.text', { pkhex: (c) => <ExternalLink href={LINKS.pkhex}>{c}</ExternalLink>, gpl: (c) => <ExternalLink href={LINKS.gpl}>{c}</ExternalLink> })}
        </Credit>
        <Credit title={t('settings.about.credit.names.title')}>{rich('settings.about.credit.names.text', { link: (c) => <ExternalLink href={LINKS.pokeapi}>{c}</ExternalLink> })}</Credit>
        <Credit title={t('settings.about.credit.renders.title')}>{rich('settings.about.credit.renders.text', { link: (c) => <ExternalLink href={LINKS.sprites}>{c}</ExternalLink> })}</Credit>
      </ul>
      <p className="settings-legal">{t('settings.about.legal')}</p>
    </SettingsSection>
  )
}
