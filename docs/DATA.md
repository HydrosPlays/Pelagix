# The Pelagix datasets

Everything Pelagix knows about the games comes from generated JSON files: where each Pokémon can
be obtained, which forms exist, how they evolve and which balls each game has. This page explains
what is in them, how they are built and where they fall short.

- [What ships](#what-ships)
- [Where it comes from](#where-it-comes-from)
- [Obtainable, event only, transfer only](#obtainable-event-only-transfer-only)
- [Kinds of source](#kinds-of-source)
- [Forms](#forms)
- [Renders](#renders)
- [Rebuilding the datasets](#rebuilding-the-datasets)
- [Known limitations](#known-limitations)

## What ships

| File | Loaded | Contents |
| --- | --- | --- |
| `src/renderer/public/data/dex.json` | Once, at startup | Every species and form: names, types, category, tags, gender ratio, render keys, and for each form the games it exists in, can be obtained in, or is event-only in. Also the ball list of each game. About 0.5 MB. |
| `src/renderer/public/data/species/<id>.json` | When a Pokémon is opened | One file per National Pokédex number: Pokédex text, height and weight, regional numbers, the evolution family, and every source of every form. 1,025 files, about 4.1 MB together. |
| `src/renderer/public/data/pokedexes.json` | When a game is chosen in "Obtainable in" | The 32 regional Pokédexes, each as its species in regional order. Built by `tools/build-data/pokedexes.ts` from the pinned PokeAPI tables. Which Pokédexes belong to which game is a hand-kept table in `src/shared/pokedexes.ts`. |

The shapes are defined in [`src/shared/dex-types.ts`](../src/shared/dex-types.ts).

Current figures (`dex.json` → `meta`, also shown in Settings → About):

| | |
| --- | --- |
| Species | 1,025 |
| Forms | 1,491 |
| Ways to obtain (encounter rows) | 44,873 |
| Games and services | 46 |
| PKHeX version | 26.08.26 |
| PokeAPI commit | `2fe95532d27a9bf340575253aff50868319d8182` |
| PokeAPI/sprites commit | `35fdbe9bdec8f519f882c3edc3c0185f08af4d86` |

## Where it comes from

The build has three steps:

1. **Extract.** `tools/extractor`, a .NET program, reads the `PKHeX/` source tree and writes
   `data/pkhex/*.json`.
2. **Build.** `tools/build-data` combines that extract with the pinned PokeAPI tables in
   `data/sources/pokeapi-upstream/`, the Pokédex text from `PokeAPI/`, the list of HOME renders in
   `data/sources/home-sprites-tree.json` and its own hand-curated tables, and writes `dex.json`
   and the `species/` files.
3. **Validate.** `tools/build-data/validate.ts` re-reads the result and checks it.

**[PKHeX](https://github.com/kwsch/PKHeX)** is the authority for anything a game does. The
extractor in [`tools/extractor`](../tools/extractor) is a small .NET program that references
`PKHeX.Core` and dumps eleven JSON files: encounters, locations, gifts and event cards, Pokémon GO
availability, forms, which Pokémon are present in which game, evolutions, eggs, balls, and
strings. Their format is documented in
[`tools/extractor/SCHEMA.md`](../tools/extractor/SCHEMA.md). PKHeX itself is not part of the app;
only data derived from it is.

**[PokeAPI](https://github.com/PokeAPI/pokeapi)** supplies what a save editor does not need:
English names and categories, types, Pokédex text, height and weight, regional Pokédex numbers,
the Legendary, Mythical and Baby flags, and the numbering that the Pokémon HOME renders are filed
under. Its encounter tables are also used to give a place to some sources PKHeX lists without one.
The tables are pinned copies in `data/sources/pokeapi-upstream/`.

**Hand-curated tables** in [`tools/build-data`](../tools/build-data) cover what neither source
has in a usable form, for example the places of Generation I encounters (`gen1-locations.ts`),
details of in-game trades (`trades.ts`), Scarlet and Violet version exclusives
(`sv-exclusives.ts`), version-bound fossils, prizes and legendaries (`curated.ts`), in-game form
changes (`form-changes.ts`) and encounters that need an event item (`event-items.ts`).

**The validator** (`npm run data:validate`) re-reads the built files and checks structural rules
(every index resolves, every "obtainable" claim is backed by a source, and so on) plus a list of
known facts in `facts.ts` that must stay true. On the committed datasets it reports:

```
Checked 1025 species, 1491 forms, 44873 rows: 768899 checks, 452 known facts.
All structural invariants hold and every known fact is reproduced.
```

## Obtainable, event only, transfer only

For every form and every game, Pelagix answers one question: can you get it there?

| State | Meaning |
| --- | --- |
| **Obtainable** | It can be caught, received as a gift, traded for in-game, raided, evolved, bred, or reached by an in-game form change, without any event. |
| **Event only** | Every source in that game is time-limited: a Mystery Gift or other real-world distribution, an event raid, an event mass outbreak, or something that depends on one of those (for example evolving an event-only Pokémon). |
| **Transfer only** | The form exists in the game's data but has to be traded or transferred in. |
| **Not in this game** | The form does not exist in the game. |

Evolution, breeding and form changes count: if Pichu can be caught in a game and Pikachu evolves
from it there, Pikachu is obtainable there even with no wild Pikachu.

Mega Evolutions are never "obtainable": they only exist during a battle, and the app says so
instead of calling them transfer-only. The same goes for the other battle-only forms, except the
eleven Totem-sized Pokémon that Ultra Sun and Ultra Moon hand out, which are listed as gifts.

## Kinds of source

Each row in a species file is one way to get one form in one or more games.

| Kind | Rows | What it is |
| --- | ---: | --- |
| Wild | 30,847 | Ordinary wild encounters: grass, caves, surfing, fishing, Headbutt, hordes, SOS calls, Friend Safari, Hidden Grottoes, Safari Zones, mass outbreaks, Wild Zones, Pokémon GO |
| Raid | 4,421 | Max Raid dens, event dens, Dynamax Adventures |
| Outbreak | 3,576 | Event mass outbreaks in Scarlet and Violet |
| Static | 2,195 | Fixed overworld and scripted battles, roaming Pokémon, Island Scan |
| Event | 1,775 | Mystery Gift and other real-world distributions, and gifts from Stadium, Stadium 2, Box and HOME |
| Tera | 844 | Tera Raid Battles, by star rating, including event raids |
| Gift | 365 | Starters, fossils, prizes and gifts from characters |
| Dream | 303 | Dream World, Dream Radar, Global Link promotions |
| Trade | 195 | In-game trades |
| Shadow | 171 | Shadow Pokémon in Colosseum and XD |
| Walker | 156 | Pokéwalker courses |
| Egg | 25 | Gift eggs |
| **Total** | **44,873** | |

Beside the rows, each form lists the Pokémon it evolves from with the method per game, in-game
form changes and fusions, and the games it can be hatched in.

A row can also carry: a level range, conditions (time of day, weather, raid stars, "Alpha"), a
shiny lock or forced shiny, a fixed ball, a fixed gender, a note (a trade nickname, an event
title), the Original Trainer of a distribution, and the side product a gift arrives through.

<details>
<summary>Rows per game</summary>

<br>

A row that applies to several games is counted once for each.

| Game | Rows | Game | Rows | Game | Rows |
| --- | ---: | --- | ---: | --- | ---: |
| Red | 305 | Diamond | 1,183 | Sun | 1,154 |
| Green | 306 | Pearl | 1,177 | Moon | 1,154 |
| Blue | 306 | Platinum | 1,087 | Ultra Sun | 1,317 |
| Yellow | 303 | HeartGold | 1,916 | Ultra Moon | 1,318 |
| Gold | 1,138 | SoulSilver | 1,923 | Let's Go, Pikachu! | 562 |
| Silver | 1,143 | Black | 1,289 | Let's Go, Eevee! | 563 |
| Crystal | 1,171 | White | 1,323 | Sword | 6,924 |
| Ruby | 776 | Black 2 | 1,345 | Shield | 6,921 |
| Sapphire | 757 | White 2 | 1,346 | Brilliant Diamond | 1,755 |
| Colosseum | 88 | X | 1,031 | Shining Pearl | 1,760 |
| FireRed | 846 | Y | 1,031 | Legends: Arceus | 5,523 |
| LeafGreen | 848 | Omega Ruby | 1,081 | Scarlet | 11,818 |
| Emerald | 711 | Alpha Sapphire | 1,081 | Violet | 11,831 |
| XD | 106 | Pokémon GO | 1,163 | Legends: Z-A | 1,943 |

Stadium, Stadium 2, Box and HOME have no rows of their own: what they hand out is listed under
the receiving game.

</details>

## Forms

Every form PKHeX knows is in the data, sorted into one category. The category decides which
[Living Dex rule](../README.md#forms-and-the-living-dex-rules) gives it a slot.

| Category | Forms | Examples | Living Dex rule |
| --- | ---: | --- | --- |
| Base | 1,025 | The first form of each species | Always has a slot |
| Regional | 57 | Alolan, Galarian, Hisuian, Paldean | Regional forms |
| Gender | 4 | Meowstic, Indeedee, Basculegion, Oinkologne ♀ | Gender forms |
| Cosmetic | 100 | Unown, Vivillon, Flabébé colours, Alcremie creams, Shellos | Cosmetic forms |
| Changeable | 80 | Rotom, Arceus plates, Deoxys, Oricorio, Ogerpon masks | Changeable forms |
| Fusion | 6 | Kyurem, Necrozma and Calyrex fusions | Fusions |
| Event | 16 | Cap Pikachu, Spiky-eared Pichu, Fancy and Poké Ball Vivillon | Event forms |
| Partner | 2 | Let's Go partner Pikachu and Eevee | Partner forms |
| Mega | 99 | Mega Evolutions and Primal Reversions | Mega Evolutions |
| Battle | 41 | Other battle-only states and totems | Battle forms |
| Hidden | 61 | Forms that are never owned or look no different | Never counted or shown |
| **Total** | **1,491** | | |

Separately from the form list, three rules split a slot further: **Gender differences** (a ♂ and
a ♀ slot where the genders look different), **Alcremie sweets** (each of the 9 creams in each of
the 7 sweets, 63 in all) and **Gigantamax**.

## Renders

Pokémon HOME renders are not in the repository or in the installer. They come from the
[PokeAPI/sprites](https://github.com/PokeAPI/sprites) repository, pinned to one commit so that
the keys in the datasets always match the files.

- The app asks for a render through its own `sprite://` address. The main process answers from
  the cache, or downloads the file from
  `cdn.jsdelivr.net/gh/PokeAPI/sprites@<commit>/sprites/pokemon/other/home/`, falling back to
  `raw.githubusercontent.com`.
- Originals (512 px) are stored under `sprite-cache\full\`. Smaller copies are made on demand at
  96, 128, 160, 256 and 384 px and stored beside them.
- `data/sources/home-sprites-tree.json` is the list of render files at the pinned commit. The
  build uses it to record which shiny and female renders exist, so the app only asks for the ones
  that do.

## Rebuilding the datasets

The built files are committed, so this is only needed after changing the tooling or to move to a
newer PKHeX.

**You need** the [.NET SDK 10](https://dotnet.microsoft.com/download), Node.js 24, and two source
trees in the project root (both git-ignored, both only read):

```
git clone --depth 1 --branch 26.08.26 https://github.com/kwsch/PKHeX PKHeX
git clone --depth 1 https://github.com/PokeAPI/pokeapi PokeAPI
```

Then:

```
npm run data
```

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `npm run data:extract` | Builds the extractor into `tools/extractor/.artifacts` and writes `data/pkhex/*.json` (git-ignored). It stops if it finds build output inside `PKHeX/`, so that tree stays untouched. |
| 2 | `npm run data:build` | Reads the extract, the PokeAPI tables and the render list, and writes `src/renderer/public/data/`. |
| 3 | `npm run data:validate` | Checks the result. A failure exits with code 1 and lists what is wrong. |

Notes:

- The extractor was written against PKHeX 26.08.26, which targets .NET 10. A newer PKHeX can
  rename or reshape what the extractor reads, and then the extractor has to follow.
- Only one file is read from `PokeAPI/`: `data/v2/csv/pokemon_species_flavor_text.csv`. Every
  other PokeAPI table comes from the pinned copies in `data/sources/pokeapi-upstream/`.
  `node tools/fetch-sources.ts` downloads any that are missing at the pinned commit, and
  `--force` downloads all of them again.
- Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning when it runs the TypeScript scripts. It is
  harmless.
- `npm run typecheck:tools` type-checks the tooling.

## Known limitations

### How sources are classified

- **Closed services still count as obtainable.** The Dream World, the Pokéwalker's "Beyond the
  Sea" course (which needed the GTS), the Friend Safari in X and Y, and the Key System and Funfest
  Missions in Black 2 and White 2 are all listed as ordinary sources. This is why X, Y, Black,
  White, Black 2 and White 2 show more Pokémon as obtainable than a list of version exclusives
  would suggest.
- **So do two sources outside the games themselves.** The 22 gifts from My Pokémon Ranch (a
  WiiWare title that can no longer be bought) are ordinary gifts in Diamond and Pearl. For Mew
  that gift is the only source that is not an event, so Mew reads "Obtainable" in Diamond and
  Pearl. The three Japan-only e-Reader Shadow Pokémon of Colosseum (Togepi, Mareep and Scizor) are
  ordinary Shadow Pokémon, and are what makes those three obtainable in Colosseum.
- **Time-limited sources never make a Pokémon "obtainable".** Event Max Raids, event and 7★ Tera
  Raids and event mass outbreaks are listed, but a game whose only sources are those is "Event
  only".
- **Gifts from Stadium, Stadium 2, Box and HOME are filed as events**, although the Stadium and
  Box ones are permanent rewards.
- **Event status spreads through evolution and breeding**, which produces a few odd entries, such
  as Raichu being event-only in Colosseum because a distributed Pikachu exists there.
- **Generation III hand-outs** are listed for all five Game Boy Advance games, Japanese
  distributions included.

### Places, methods and levels

- **Some sources have no place.** Many in-game trades from Generation V onward (Black and White
  through Scarlet, Violet and Legends: Z-A); the My Pokémon Ranch gifts; a few gift eggs; a number
  of Hidden Grotto Pokémon; and three raid dens. Pokémon GO has no places at all.
- **Many wild rows have no method** and read "Wild".
- **Poké Radar and DexNav** encounters are not labelled: PKHeX only records that the feature
  works in an area.
- **"Tall grass" or "Cave"** is decided from the name of the place where PKHeX has a single land
  slot type. Places with both, such as Mt. Pyre and the Ruins of Alph, are wrong for some rows.
- **Level ranges are envelopes.** Two separate level bands at one place become one range.
- **In-game trades in Generations I to III** show a level range that runs up to 100, because the
  level is that of the Pokémon you hand over.
- **The Pokémon a trade asks for** is known for Generations I to IV, Brilliant Diamond, Shining
  Pearl and Let's Go only.
- **Scarlet and Violet**: the weather is never listed (the time of day is), and a large share of
  the wild rows are Pokémon that wander in from a neighbouring area.
- **Qwilfish on Route 32** has a level 5 Old Rod row beside its "Swarm" row; PKHeX's own table
  already contains the swarm slot.

### Forms and evolutions

- **Form changes are generic.** They name the item or action, not where to find it, and the
  mechanism is assumed to work in every game whose data has both forms, apart from listed
  exceptions.
- **Resolute Keldeo has no source in Legends: Z-A.**
- **Evolution methods in the family tree** come from the most recent game that has the evolution,
  which is often Legends: Z-A, so they can read "Evolve with high friendship" where an older game
  says "Level up with high friendship". The per-game methods under *Where to find it* are
  specific to that game.
- **Vivillon's base form is the Icy Snow pattern**, as in PKHeX. With form slots switched off,
  any pattern fills the Vivillon slot.

### Events

- **Titles are uneven.** Where a distribution has no usable English title it is named after the
  Pokémon ("Manaphy gift"). A Generation VI or VII title in another language can still appear when
  no English card exists.
- **Original Trainer names** are those of the distribution, so they can be in Japanese, Korean or
  another language.
- **Dates.** Cards from Generations V to VII carry a single date, stored as a start date with no
  end. That does not mean the event is still running.
- **Diancie in Legends: Z-A** is listed as obtainable, with the note that it requires the
  Diancite from Mystery Gift. Whether that gift is still available is unconfirmed.

### Renders

- **Eight visible forms have no HOME render of their own** and show the closest one, with a
  "Closest render" label: Partner Pikachu, Partner Eevee, Spiky-eared Pichu, Mega Meowstic
  (Female), Antique Sinistea, Antique Polteageist, Artisan Poltchageist and Masterpiece Sinistcha.
- **Seven cap Pikachu have no shiny render**, so they are always shown in their normal colours.

### Scope

- **English only.**
- **As recent as PKHeX 26.08.26.** Games, events and distributions added to PKHeX later are not
  in the data until it is rebuilt.
- **Pokémon GO** lists availability and whether a shiny is possible, nothing more. Spinda and
  Zygarde are marked as unable to be sent to Pokémon HOME; other GO-only restrictions were not
  checked.
- **Not verified row by row.** The data passes its validator and a set of spot checks against
  published lists, but 44,873 rows have not each been confirmed in a game. If something is wrong,
  please open an issue naming the Pokémon, the game and what the game actually does.
