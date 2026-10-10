import { useMemo, type ReactNode } from 'react'
import { GENERATION_NAMES } from '@shared/games'
import { GameIcon } from '@renderer/components/pokemon'
import { Button, Combobox, type SelectOption } from '@renderer/components/ui'
import type { Dex } from '@renderer/lib/data'
import { obtainGames } from './dex-query'
import './GamePicker.css'

/** The game choice behind "Obtainable in": every game something can be obtained in, grouped by generation. */
export function GamePicker({ dex, value, onChange, wrapperClassName }: { dex: Dex; value: string | null; onChange: (game: string | null) => void; wrapperClassName?: string }) {
  const options = useMemo<SelectOption<string>[]>(
    () =>
      obtainGames(dex).map((game) => ({
        value: game.id,
        label: game.name,
        keywords: `${game.short} ${game.groupName}`,
        icon: <GameIcon game={game} size={22} tooltip={false} alt="" />,
        group: game.generation === 0 ? 'Services' : (GENERATION_NAMES[game.generation] ?? `Generation ${game.generation}`)
      })),
    [dex]
  )
  return <Combobox ariaLabel="Game" options={options} value={value} onChange={onChange} placeholder="Choose a game" icon="gamepad" emptyText="No game with that name" maxHeight={280} wrapperClassName={wrapperClassName} />
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
  return (
    <div className="gdex-bar" role="group" aria-label="Obtainable in">
      <span className="gdex-bar__label" aria-hidden="true">
        Obtainable in
      </span>
      <GamePicker dex={dex} value={game} onChange={onGame} wrapperClassName="gdex-bar__picker" />
      {game === null ? (
        <span className="gdex-bar__hint">Choose a game to see only what it has, in its own Pokédex order.</span>
      ) : (
        <>
          <span className="gdex-bar__hint">Only Pokémon obtained in this game count here.</span>
          <Button variant="ghost" size="sm" icon="close" onClick={() => onGame(null)}>
            Show every game
          </Button>
        </>
      )}
    </div>
  )
}
