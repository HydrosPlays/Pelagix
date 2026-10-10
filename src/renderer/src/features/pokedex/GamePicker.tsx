import { useMemo, type ReactNode } from 'react'
import { GameIcon } from '@renderer/components/pokemon'
import { Button, Combobox, type SelectOption } from '@renderer/components/ui'
import { generationName } from '@renderer/domain/generation'
import { useT } from '@renderer/i18n'
import { gameGroupName, gameName, gameShortName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { obtainGames } from './dex-query'
import './GamePicker.css'

/** The game choice behind "Obtainable in": every game something can be obtained in, grouped by generation. */
export function GamePicker({ dex, value, onChange, wrapperClassName }: { dex: Dex; value: string | null; onChange: (game: string | null) => void; wrapperClassName?: string }) {
  const t = useT()
  const options = useMemo<SelectOption<string>[]>(
    () =>
      obtainGames(dex).map((game) => ({
        value: game.id,
        label: gameName(game.id),
        // Found by its name in the active language and by its English one.
        keywords: [...new Set([gameShortName(game.id), gameGroupName(game.group), game.short, game.groupName, ...(gameName(game.id) === game.name ? [] : [game.name])])].join(' '),
        icon: <GameIcon game={game} size={22} tooltip={false} alt="" />,
        group: game.generation === 0 ? t('pokedex.game.services') : generationName(game.generation)
      })),
    [dex, t]
  )
  return <Combobox ariaLabel={t('pokedex.game.label')} options={options} value={value} onChange={onChange} placeholder={t('pokedex.game.placeholder')} icon="gamepad" emptyText={t('pokedex.game.empty')} maxHeight={280} wrapperClassName={wrapperClassName} />
}

/** The heading of one Pokédex section of a game view, with whatever count the page keeps for it. */
export function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="gdex-section">
      <h2 className="gdex-section__title">{title}</h2>
      {children !== undefined && <span className="gdex-section__count">{children}</span>}
      <span className="gdex-section__line" aria-hidden="true" />
    </div>
  )
}

/**
 * "Obtainable in" as a bar of its own, for the Living Dex and the HOME Dex: with a game chosen the
 * page shows only what that game has, in its Pokédex order, caught by what was obtained there.
 */
export function GameDexBar({ dex, game, onGame }: { dex: Dex; game: string | null; onGame: (game: string | null) => void }) {
  const t = useT()
  return (
    <div className="gdex-bar" role="group" aria-label={t('pokedex.game.obtainableIn')}>
      <span className="gdex-bar__label" aria-hidden="true">
        {t('pokedex.game.obtainableIn')}
      </span>
      <GamePicker dex={dex} value={game} onChange={onGame} wrapperClassName="gdex-bar__picker" />
      {game === null ? (
        <span className="gdex-bar__hint">{t('pokedex.game.hint.none')}</span>
      ) : (
        <>
          <span className="gdex-bar__hint">{t('pokedex.game.hint.chosen')}</span>
          <Button variant="ghost" size="sm" icon="close" onClick={() => onGame(null)}>
            {t('pokedex.game.showAll')}
          </Button>
        </>
      )}
    </div>
  )
}
