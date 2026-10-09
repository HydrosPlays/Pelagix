/** URLs of static assets shipped in the renderer's public folder. Relative, so they resolve under file:// too. */

import type { GameDef } from '@shared/games'

/** Icon of a game (100x100 PNG in `public/games/`). */
export function gameIconUrl(game: Pick<GameDef, 'icon'>): string {
  return `./games/${game.icon}`
}
