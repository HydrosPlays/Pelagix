/**
 * Pokémon HOME render locations in the PokeAPI/sprites repository.
 * Pinned to one commit: upstream has renumbered variety sprites before, and the datasets'
 * sprite keys are only valid against the commit they were built from.
 * Dependency-free and erasable-syntax only (see games.ts).
 */

export const SPRITES_COMMIT = '35fdbe9bdec8f519f882c3edc3c0185f08af4d86'
/** PokeAPI/pokeapi commit the upstream CSVs in data/sources/pokeapi-upstream were taken from. */
export const POKEAPI_COMMIT = '2fe95532d27a9bf340575253aff50868319d8182'

const HOME_DIR = 'sprites/pokemon/other/home'

export const SPRITE_CDN_PRIMARY = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITES_COMMIT}/${HOME_DIR}/`
export const SPRITE_CDN_FALLBACK = `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_COMMIT}/${HOME_DIR}/`

export interface SpriteVariant {
  shiny?: boolean
  female?: boolean
}

/**
 * Path of a HOME render relative to the `home/` folder, e.g. `25.png`, `shiny/201-b.png`,
 * `shiny/female/25.png`. `key` is a `FormSummary.sprite` value. Callers must only request the
 * shiny / female variant when the form's `shiny` / `female` flag says the file exists.
 */
export function homeSpritePath(key: string, variant: SpriteVariant = {}): string {
  return `${variant.shiny ? 'shiny/' : ''}${variant.female ? 'female/' : ''}${key}.png`
}
