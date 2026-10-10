# PKHeX extract: output schema

`node tools/extractor/run.mjs` builds `tools/extractor` (Release, PKHeX.Core by project reference) and writes
twelve JSON files to `data/pkhex/`. This document is the contract for those files. Everything in them comes
from PKHeX.Core (v26.08.26 at the time of writing); nothing is hand-authored except the two small
classifications called out under [Kinds](#kinds).

## Conventions

- **Encoding:** UTF-8, no BOM, `\n` line ends, no insignificant whitespace. Records sit one per line
  (objects' members and the elements of record arrays), so the files are both minified and line-diffable.
- **Deterministic:** no timestamps, stable ordering. Two runs against the same PKHeX produce identical bytes.
- **Game codes:** PKHeX `GameVersion` names, with Colosseum and XD split out of PKHeX's shared `CXD` id.
  The canonical order (also `meta.json.games` and `encounters.json.games`) is

  `RD GN BU YW GD SI C R S E FR LG COLO XD D P Pt HG SS B W B2 W2 X Y OR AS SN MN US UM GP GE SW SH BD SP PLA SL VL ZA GO`

  `RD` = Red, `GN` = international Blue / Japanese Green, `BU` = Japanese Blue, `YW` = Yellow.
- **Game references:** `encounters.json` rows use *indices* into that list (`g`). Every other file uses the
  *codes* (as object keys or in a `games` array).
- **Species** are national dex numbers, **forms** are PKHeX form indices, **balls** are PKHeX `Ball` ids,
  **genders** are 0 male / 1 female / 2 genderless.
- **Omitted means default.** Optional keys are left out rather than written as `null`, `false`, `0` or `[]`.
  Flags outside a `c` object are written as `1`; flags inside `c` are written as `true`.
- **Contexts** are PKHeX `EntityContext` names: `Gen1` … `Gen9`, plus `Gen7b` (Let's Go), `Gen8a` (Legends:
  Arceus), `Gen8b` (BDSP), `Gen9a` (Legends: Z-A). `Gen8` alone means Sword/Shield, `Gen9` alone means
  Scarlet/Violet.

## meta.json

```jsonc
{
  "schema": 1,                    // bumped when a file's shape changes incompatibly
  "pkhexVersion": "26.08.26",
  "language": "en",
  "games": [ { "code": "RD", "generation": 1, "context": "Gen1" }, … ],   // canonical order
  "files": { "<file name>": { …counts… } },
  "templates": { "reflected": 232323, "placeholders": 16667, "encounters": 193364, "go": 22291, "giftEntities": 2619, "total": 218274 },
  "perKind": { "<kind>": [templates, rows] },
  "perGame": { "<code>": { "<kind>": [templates, rows] } },
  "sources": [ { "src": "Encounters1.SlotsRD", "type": "EncounterArea1[]", "total": 653, "new": 653 }, … ],
  "vocab": { … }
}
```

- `games[].generation` is 0 and `context` is `"None"` for `GO`. `COLO` and `XD` are generation 3, `Gen3`.
- `files` holds the row counts of each output file (see each file below for what a "row" is), e.g.
  `"encounters.json": { "rows": 87147, "templates": 193364 }`, `"presence.json": { "entries": 24156, "byGame": {…} }`.
- `templates.reflected` is every template instance PKHeX holds; `placeholders` are the species-0 filler
  slots that are dropped; `total` = encounters + GO slots + gift Pokémon. The run fails below 200,000.
- `perKind` / `perGame` count encounter templates and aggregated rows, with mystery gifts under kind `mystery`.
  GO is not in them (see `files["go.json"]`).
- `sources` is the reflection manifest in read order: `total` templates reachable from the field, `new` the
  ones not already seen through an earlier field (the Friend Safari area is shared by X and Y, for example).
- `vocab` lists every enumerated string `encounters.json` actually uses: `kind`, `type`, `source`, `method`,
  `locationSet`, `shiny`, `trainer`, `distribution`, and `conditions` as
  `{ "<key>": { "type": "true" | "number" | "number[]" | "string" | "string[]", "values": [strings seen] } }`.
  Treat it as the machine-readable version of the tables below.

## encounters.json

```jsonc
{ "games": ["RD", "GN", …],
  "rows": [
    {"g":[14],"s":25,"f":0,"l":[18,18],"k":"wild","t":"EncounterSlot4","src":"Encounters4DPPt.SlotsD","m":"Grass","x":"Gen4","L":[68],"c":{"radar":true},"label":"Wild Encounter (D) Grass","n":14},
    … ] }
```

One row per group of templates that are identical in every field below except their level range. Mystery
gifts (`gifts.json`) and Pokémon GO (`go.json`) are not in this file. Rows are sorted by species, form,
first game index, then by their serialized content.

| Key | Type | Always | Meaning |
|---|---|---|---|
| `g` | number[] | yes | Game indices, ascending. Never empty. |
| `s` | number | yes | Species. |
| `f` | number | yes | Form, raw. **30 and 31 are sentinels**, see [Pitfalls](#pitfalls). |
| `l` | [min, max] | yes | Level range over the merged templates. |
| `ls` | [min, max][] | no | Present only when the merged templates leave gaps: the disjoint level segments, ascending. `l` is then only the envelope (`"l":[20,70],"ls":[[20,20],[70,70]]` = level 20 or level 70). |
| `k` | string | yes | Kind, see [Kinds](#kinds). |
| `t` | string | yes | CLR type name of the template (`EncounterSlot4`, `EncounterStatic8N`, …). |
| `src` | string | yes | `Holder.Field` the template was read from (`Encounters8Nest.DynAdv_SWSH`). Use it for tagging PKHeX itself does not expose (DLC Tera tables, symbol vs hidden SwSh slots, Odd Egg, Celebi VC …). |
| `m` | string | no | Slot `Type` enum name, see [Methods](#methods-m). Only wild rows have one, and not all of them. |
| `x` | string | yes | Location set: key into `locations.json`. Also the template's context, except `CXD` (Colosseum / XD, context Gen3). |
| `L` | number[] | no | Primary location ids: where the Pokémon is found. In PKHeX's order (first = the one PKHeX reports as `Location`), not sorted. |
| `A` | number[] | no | Alternate location ids: places the Pokémon can only be *met* in by wandering over an area border or by joining someone else's raid. Never overlaps `L`. |
| `e` | 1 | no | `L` holds egg-received locations (the template has no met location, only an egg location). |
| `h` | string | no | Shiny state when it is not `Random`: `Never` (shiny-locked), `Always` (forced shiny), `FixedValue` (fixed PID; treat as never shiny). |
| `b` | number | no | Fixed ball id; absent = player's choice. |
| `d` | 0 / 1 / 2 | no | Fixed gender. |
| `c` | object | no | Conditions, see [Conditions](#conditions-c). Keys sorted. |
| `egg` | 1 | no | The template is received as an egg. |
| `nick` | string | no | English nickname the template forces (in-game trades, one Z-A gift). |
| `tr` | string | no | Trainer enum of Gen 1/2 event gifts and Z-A gifts, see below. |
| `dist` | string | no | Distribution enum of the Gen 3 Pokémon Center New York / Japan machines, see below. |
| `ot` | string | no | Original Trainer name the template forces, as an English-language game shows it. |
| `ots` | string[] | no | Every OT name the distribution used, when there are several (`ot` is the first). |
| `label` | string | yes | PKHeX `LongName`: an English fallback label (`"Stock Raid Den Encounter [063] 2-3★"`). |
| `n` | number | yes | How many templates were merged into the row. |

PKHeX holds no "requested species" for in-game trades, so there is no such field.

### Kinds

| `k` | Templates | Notes |
|---|---|---|
| `wild` | every `EncounterSlot*` | Details are in `m` and `c`. |
| `static` | `EncounterStatic*` with no fixed ball | Scripted / overworld battles. |
| `static-fixed` | `EncounterFixed9` | SV fixed overworld spawns (e.g. the sparkling Tera Pokémon). |
| `gift` | `EncounterStatic*` with a fixed ball, `EncounterGift3Colo`, `EncounterGift9a` | Handed over in-game: starters, fossils, prizes, NPC gifts. |
| `gift-egg` | `EncounterStatic*` with `IsEgg` | In-game gift eggs. |
| `starter` | `EncounterStarter3Colo` | Colosseum's Espeon and Umbreon. |
| `trade` | `EncounterTrade*` except Ranch | In-game NPC trades. |
| `ranch-gift` | `EncounterTrade4RanchGift` | My Pokémon Ranch. PKHeX files them under Diamond only. |
| `shadow` | `EncounterShadow3Colo`, `EncounterShadow3XD` | |
| `pokewalker` | `EncounterStatic4Pokewalker` | |
| `dream-world` | `EncounterStatic5Entree` | Dream World / Entree Forest. |
| `dream-radar` | `EncounterStatic5Radar` | |
| `n-pokemon` | `EncounterStatic5N` | N's Pokémon (B2/W2). |
| `raid` | `EncounterStatic8N` | Stock Max Raid dens. |
| `raid-event` | `EncounterStatic8ND` | Distributed (Wild Area News) dens. |
| `raid-crystal` | `EncounterStatic8NC` | Watchtower crystal dens. |
| `max-lair` | `EncounterStatic8U` | Dynamax Adventures. |
| `tera` | `EncounterTera9` | Stock Tera raids. `src` tells base game from DLC (`TeraBase`, `TeraDLC1`, `TeraDLC2`). |
| `tera-event` | `EncounterDist9` | Distributed Tera raids. |
| `tera-7star` | `EncounterMight9` | 7-star "Mightiest Mark" raids. |
| `outbreak-event` | `EncounterOutbreak9` | Distributed SV mass outbreaks. Ordinary outbreaks are plain `wild` rows. |
| `event` | `EncounterGift1`, `EncounterGift2`, `EncounterGift3`, `EncounterGift3NY`, `EncounterGift3JPN` | Gen 1-3 real-world distributions (they predate wonder cards). |
| `event-egg` | the same types with `IsEgg` | |

Two classifications are the extractor's own, because PKHeX has no data for them:

1. **Gen 1 / Gen 2 gift vs battle.** Every Gen 1/2 template reports `b: 4`, so the fixed-ball rule cannot
   work there. `EncounterStatic1` / `EncounterStatic2` species are split by a hand list in `Resolve.cs`:
   battles are Voltorb, Electrode, Snorlax, the birds, Mewtwo (Gen 1) and Geodude, Voltorb, Electrode, Koffing,
   Gyarados, Lapras, Snorlax, Sudowoodo, Qwilfish, Remoraid, the beasts, Lugia, Ho-Oh, Celebi (Gen 2);
   everything else is `gift` (starters, fossils, Game Corner prizes, Eevee, Tyrogue, Dratini …). An
   unclassified species fails the run.
2. **Legends: Arceus.** `EncounterStatic8a` is a `gift` only when its ball is the Poké Ball *and* it is not a
   fateful encounter; Dialga, Palkia (Origin Ball) and Arceus are `static`.

### Methods (`m`)

The slot type enum name, unchanged. The values that occur today, by template type (PKHeX's enums define a
few more that no data uses; `meta.json.vocab.method` always has the current list):

| `t` | Values of `m` |
|---|---|
| `EncounterSlot1` | `Grass`, `Surf`, `Old_Rod`, `Good_Rod`, `Super_Rod` |
| `EncounterSlot2` | `Grass`, `Surf`, `Old_Rod`, `Good_Rod`, `Super_Rod`, `Rock_Smash`, `Headbutt`, `HeadbuttSpecial`, `BugContest` |
| `EncounterSlot3` | `Grass`, `Surf`, `Old_Rod`, `Good_Rod`, `Super_Rod`, `Rock_Smash`, `SwarmFish50` |
| `EncounterSlot3Swarm` | `SwarmGrass50` |
| `EncounterSlot4` | `Grass`, `Surf`, `Old_Rod`, `Good_Rod`, `Super_Rod`, `Rock_Smash`, `Headbutt`, `HeadbuttSpecial`, `BugContest`, `HoneyTree`, `Safari_Grass`, `Safari_Surf`, `Safari_Old_Rod`, `Safari_Good_Rod`, `Safari_Super_Rod` |
| `EncounterSlot5` | `Grass`, `Surf`, `Super_Rod`, `Swarm`, `HiddenGrotto` |
| `EncounterSlot6XY` | `Standard`, `Grass`, `Horde`, `FriendSafari` |
| `EncounterSlot6AO` | `Standard`, `Rock_Smash`, `Horde` |
| `EncounterSlot7` | `Standard`, `SOS` |
| `EncounterSlot8` | `SymbolMain`, `SymbolMain2`, `SymbolMain3`, `HiddenMain`, `HiddenMain2`, `Surfing`, `Surfing2`, `Sky`, `Sky2`, `Ground`, `Ground2`, `Sharpedo`, `OnlyFishing` |
| `EncounterSlot8a` | `Standard`, `Distortion`, `Landmark`, `MassOutbreakRegular`, `MassOutbreakMassive` |
| `EncounterSlot8b` | `Grass`, `Surf`, `Old_Rod`, `Good_Rod`, `Super_Rod`, `HoneyTree` |
| `EncounterSlot9a` | `Standard`, `Hyperspace` |
| `EncounterSlot3XD`, `EncounterSlot7b`, `EncounterSlot9` | no `m` (XD's spot type is `c.pokeSpot`) |

The data is coarse in places: Gen 4 has no swarm / time-of-day / radio types (they are folded into `Grass`,
`c.radar` only says the Poké Radar *works* there), Gen 6 is mostly `Standard`, Gen 7 only knows `Standard`
and `SOS`. `SwarmFish50` is not a swarm: it is Route 119's Feebas tiles (see `c.feebasTiles`).

### Conditions (`c`)

Every discriminator the template type exposes. A flag is present (`true`) only when it applies.

| Key | Value | On | Meaning |
|---|---|---|---|
| `time` | string[] ⊆ `Morning`, `Day`, `Evening`, `Night` | `EncounterSlot2`, `EncounterSlot9` | Periods the slot can be met in; absent = any time. Gen 2 only has Morning / Day / Night. SV is decoded from PKHeX's exclusion mask (Dawn = Morning, Lunchtime = Day, Dusk = Evening, Sleepy-Time = Night). |
| `weather` | string[] | `EncounterSlot8`, `EncounterStatic8`, `EncounterSlot9`, `EncounterOutbreak9` | Weathers the template appears in. SwSh: `Normal`, `Overcast`, `Raining`, `Thunderstorm`, `Intense_Sun`, `Snowing`, `Snowstorm`, `Sandstorm`, `Heavy_Fog`. SV: `Normal`, `Overcast`, `Raining`, `Thunderstorm`, `Mist`, `Snowing`, `Snowstorm`, `Sandstorm`. A full list means no restriction. Absent when the data has no weather bit at all (SwSh slots that are fishing-only, a handful of SV slots) and on an `EncounterStatic8` that only has the property's default `Normal`. |
| `shakingTrees` | true | `EncounterSlot8` | Berry-tree encounter (a non-weather bit in SwSh's weather field). |
| `fishing` | true | `EncounterSlot8` | Can be fished up. |
| `curry` | true | `EncounterSlot8` | Can be attracted by cooking curry. |
| `radar` | true | `EncounterSlot4`, `EncounterSlot8b` | The Poké Radar can be used on this slot. |
| `swarm` | true | `EncounterSlot3Swarm` / `SwarmGrass50`, `EncounterSlot5` `Swarm` | Swarm / mass outbreak slot. |
| `safari` | true | `EncounterSlot3`, `EncounterSlot4`, `EncounterSlot8b` | Safari Zone / Great Marsh slot; `b` is 5 (Safari Ball). |
| `marsh` | true | `EncounterSlot4`, `EncounterSlot8b` | Great Marsh specifically. |
| `bugContest` | true | `EncounterSlot2`, `EncounterSlot4` | Bug-Catching Contest; in Gen 4 `b` is 24 (Sport Ball). |
| `honeyTree` | true | `EncounterSlot4` | Honey tree. |
| `headbutt` | true | `EncounterSlot2`, `EncounterSlot4` | Headbutt tree (ordinary or special). |
| `headbuttSpecial` | true | same | Special Headbutt tree; always together with `headbutt`. |
| `noTree` | true | `EncounterSlot2` | Headbutt slot no save can reach: PKHeX's tree table (`EncounterSlot2.IsTreeAvailable`) has no tree of that kind on the map for any Trainer ID. PKHeX keeps the slot data but never accepts it; drop these rows. |
| `feebasTiles` | true | `EncounterSlot3` `SwarmFish50`, `EncounterSlot4` | Feebas's random tiles (Route 119; Mt. Coronet). |
| `hiddenGrotto` | true | `EncounterSlot5` | |
| `horde` | true | `EncounterSlot6XY`, `EncounterSlot6AO` | |
| `friendSafari` | true | `EncounterSlot6XY` | |
| `dexNav` | true | `EncounterSlot6AO` | Can be found with the DexNav (every ORAS slot except Rock Smash). |
| `sos` | true | `EncounterSlot7` | SOS ally. |
| `pelago` | true | `EncounterSlot7` | Poké Pelago visitor (location 30016, `b` 4). |
| `totem` | true | `EncounterStatic7` | Totem-sized form. |
| `roaming` | true | `EncounterStatic2/3/4/5/8b` | Roamer. Gen 6 roamers carry no flag. |
| `alpha` | `"always"` \| `"random"` | `EncounterSlot8a`, `EncounterStatic8a`, `EncounterSlot9a`, `EncounterStatic9a`, `EncounterGift9a` | Alpha: guaranteed, or (PLA slots only) possible. Absent = never. |
| `underground` | true | `EncounterSlot8b` | Grand Underground. |
| `rank` | [min, max] | `EncounterStatic8N` | Den star range, 1-5. |
| `nest` | number | `EncounterStatic8N` | PKHeX nest (den table) index. |
| `dynamaxLevel` | number | all SwSh den types, `EncounterStatic8`, `EncounterTrade8` | When non-zero. |
| `gmax` | true | `EncounterStatic8`, all SwSh den types | Can Gigantamax. |
| `distIndex` | number | `EncounterStatic8ND`, `EncounterDist9`, `EncounterMight9` | Distribution number. |
| `stars` | number | `EncounterTera9`, `EncounterDist9`, `EncounterMight9` | Tera raid star count. |
| `teraType` | string | Tera raids, `EncounterStatic9`, `EncounterFixed9`, `EncounterTrade9` | Fixed Tera type: a type name, `Stellar`, or `Random`. Absent = the species' default. |
| `map` | `Paldea` \| `Kitakami` \| `Blueberry` | `EncounterTera9` | |
| `host` | string[] ⊆ `SL`, `VL` | all Tera raid types | Games that can host the raid. Identical to the row's `g`; the other game can still join online. |
| `mark` | string | `EncounterOutbreak9` | PKHeX `RibbonIndex` name of the mark the outbreak forces (`MarkRare`, …). |
| `titan` | true | `EncounterStatic9` | Titan Pokémon. |
| `rideLegend` | true | `EncounterStatic9` | The Koraidon / Miraidon you ride (untradable). |
| `hyperspace` | true | `EncounterSlot9a`, `EncounterStatic9a` | Z-A Hyperspace Lumiose (Mega Dimension DLC). |
| `course` | string | `EncounterStatic4Pokewalker` | Course display name (`"Yellow Forest"`). |
| `courseId` | number | same | `PokewalkerCourse4` value, 0-26. |
| `promotion` | string | `EncounterStatic5Entree` | `GlobalLinkPromotion` name when the Dream World Pokémon came from a promotion. |
| `shadowId` | number | Shadow types | Shadow Pokémon index. |
| `gauge` | number | Shadow types | Heart gauge. |
| `eReader` | true | `EncounterShadow3Colo` | Japanese e-Reader card Shadow Pokémon. |
| `pokeSpot` | `Rock` \| `Oasis` \| `Cave` | `EncounterSlot3XD` | |
| `starterPikachu` | true | `EncounterStatic1` | Yellow's starter. |
| `oddEgg` | true | `EncounterStatic2` | Crystal's Odd Egg. |
| `evolveOnTrade` | true | `EncounterTrade1/7/9` | The traded Pokémon evolves on arrival. |
| `fateful` | true | any | Fateful-encounter flag. |
| `language` | string | `EncounterGift1/2/3` | Language restriction: `Japanese`, `International`, `InternationalNotEnglish`, or a single language name. |
| `originGame` | `R` \| `S` | `EncounterGift3Colo` | Origin-game mark the Colosseum gift carries (see Pitfalls). |
| `bonusDisc` | `JP` | `EncounterGift3Colo` | Japanese bonus disc. |

`tr` values: `Stadium`, `VirtualConsoleMew`, `EuropeTour`, `JapanTour` (`EncounterGift1`); `GiftStadiumJPN`,
`GiftStadiumENG`, `GiftStadiumINT`, `PokemonCenterNewYork` (`EncounterGift2`); `Lucario`, `Floette`,
`Stunfisk`, `Gimmighoul`, `Magearna` (`EncounterGift9a`). The enum's default (`Recipient` / `None`) is omitted.

`dist` values: `Evolution`, `Dragon`, `Monster`, `Halloween`, `EXDragon`, `UnknownSpring`, `Colosseum`, `Box`,
`BabyTrade`, `SlitherSwim`, `AncientAliens`, `Sixth` (`EncounterGift3NY`); `First` … `Sixth`
(`EncounterGift3JPN`).

### Locations

`x` + an id from `L` / `A` look up a name in `locations.json`. How the lists are built:

| Template | `L` | `A` |
|---|---|---|
| `EncounterSlot8a` | every met location of its area | |
| `EncounterStatic8N` | the den's real locations | 162 "Pokémon Den" (caught in someone else's raid) |
| `EncounterStatic8ND` | 162 only (PKHeX has no den list for distributions) | |
| `EncounterFixed9` | its up to four locations | |
| `EncounterOutbreak9` | every location in its met mask | |
| `EncounterSlot8` | its area | areas the symbol Pokémon can wander into |
| `EncounterStatic8` | its location | crossover locations |
| `EncounterSlot7b` | its area | the one or two areas it can cross into |
| `EncounterSlot9` | the area it spawns in | the neighbouring area whose met location it gets after wandering (these rows duplicate that species' ordinary rows for the spawn area) |
| anything else | `Location`, else `EggLocation` (with `e`) | |

Rows with no `L` at all: every Gen 1 static, trade and gift, Gen 2 Odd Eggs and most Gen 2 event gifts,
three Gen 3 statics, one XD gift.

## locations.json

```jsonc
{ "Gen4": { "68": "Trophy Garden", "233": "Pokéwalker", "2001": "Link trade (NPC)", … }, "CXD": { … }, … }
```

`{ set: { id: name } }` for every id referenced by `encounters.json` (`L`, `A`) or `gifts.json` (`loc`,
`eggLoc`): 1,660 names over 14 sets (`CXD`, `Gen1` … `Gen9`, `Gen7b`, `Gen8a`, `Gen8b`, `Gen9a`). Names are
exactly what a Release build of PKHeX returns; ids not referenced by any row are not included. An id that
PKHeX cannot name fails the run. `Gen1` ids are PKHeX's own (Gen 1 has no met locations; the slot data is
pre-mapped to FireRed/LeafGreen ids).

## gifts.json

```jsonc
{ "rows": [
  {"type":"WC9","id":519,"title":"Marco’s Jumpluff Gift","s":189,"f":0,"lv":50,"games":["SL","VL"],"h":"Never","b":16,"d":0,"fateful":1,"ot":"Marco","from":"2025-02-20","to":"2025-03-01","x":"Gen9","loc":40035,"locName":"a Battle Competition","n":1},
  … ] }
```

Every Pokémon-granting mystery gift PKHeX ships (2,619 cards → 2,543 rows). Exact repeats are merged (`n`);
language variants stay separate because their `title` / `ot` differ. Sorted by card type (in the order
below), card id, species, then content.

| Key | Type | Always | Meaning |
|---|---|---|---|
| `type` | string | yes | Card type: `PCD` (Gen 4), `PGT` (only the Pokémon Ranger Manaphy egg), `PGF` (Gen 5), `WC6`, `WC7`, `WB7` (Let's Go), `WC8` (SwSh), `WA8` (PLA), `WB8` (BDSP), `WC9` (SV), `WA9` (Z-A). |
| `id` | number | yes | Card id. Not unique: 0 on PKHeX's simulated cards, -1 on the `PGT`, and shared by language variants. |
| `title` | string | yes | Card title exactly as PKHeX returns it. Gen 4-7 titles are in the card's own language (often Japanese, may contain ideographic spaces U+3000, may be empty); `WB7` and later are English. |
| `s`, `f` | number | yes | Species, form. |
| `lv` | number | yes | Level (1 for eggs). |
| `games` | string[] | yes | Game codes whose saves can receive the card. |
| `h` | string | no | Shiny state when not `Random`: `Never`, `Always`, `AlwaysStar`, `AlwaysSquare`. |
| `b` | number | yes | Ball id (16 = Cherish for most). |
| `d` | 0 / 1 / 2 | no | Fixed gender. |
| `egg` | 1 | no | Received as an egg. |
| `fateful` | 1 | no | Fateful-encounter flag (nearly all). |
| `ot` | string | no | Fixed Original Trainer name; absent = the recipient's own. |
| `lang` | string | no | PKHeX `LanguageID` name (`Japanese`, `English`, `French`, `Italian`, `German`, `Spanish`, `Korean`, `ChineseS`, `ChineseT`) of the card, for `PCD`, `PGF`, `WC6`, `WC7`: the language the card is restricted to, else the language its Pokémon is stamped with. The card's `title` and `ot` are written in it. Absent = unknown or any (and on every `WB7`+ card, whose titles PKHeX generates in English). |
| `home` | 1 | no | Pokémon HOME gift (card id ≥ 9000). |
| `origin` | string | no | Game code the Pokémon is stamped with when the card forces one, whichever game redeems it. |
| `date` | `yyyy-mm-dd` | no | Receipt date stored in the card (`PGF`, some `WC6` / `WC7`). Only kept when it falls inside that generation's lifetime: PKHeX stamps today's date on cards from its "full" dumps. |
| `from`, `to` | `yyyy-mm-dd` | no | Distribution window PKHeX knows (`WB7` and later; all `WC9` / `WA8` / `WA9`). `to` absent = still open. |
| `x` | string | yes | Context / location set. |
| `loc`, `locName` | number, string | no | Met location and its name. Mostly pseudo-places (`"a lovely place"`, `"Pokémon Event"`). |
| `eggLoc`, `eggLocName` | number, string | no | Egg location, for eggs. |
| `n` | number | yes | Cards merged into the row. |

Game rules, per card type: `PCD` reads the card-compatibility bits (masked with 0x1D80: D, P, Pt, HG, SS);
`PGF`, `WC6`, `WC7`, `WB7`, `WC8` ask PKHeX's `CanBeReceivedByVersion` for each game of the generation; `WC9`
reads `RestrictVersion` (1 SL, 2 VL, else both); `WA8` → PLA; `WB8` → BD + SP; `WA9` → ZA; the Ranger
Manaphy egg → all five Gen 4 games. A card that maps to no game fails the run.

## go.json

```jsonc
{ "rows": [
  {"s":25,"f":0,"home":{"n":112,"shiny":1,"types":["Wild","Egg","Raid","MaxBattle","PremierBallBug"],"lvMin":1,"fmt":"PB7"},"lgpe":{"n":112,"shiny":1,"types":[…],"lvMin":1}},
  {"s":151,"f":0,"home":{"n":5,"shiny":1,"from":"2018-03-30","types":["SpecialResearch","PremierBallBugMythical"],"lvMin":15,"fmt":"PB7"}},
  … ] }
```

One row per species-form Pokémon GO has ever offered (1,160), sorted by species, form. `home` is present when
it can be sent GO → HOME, `lgpe` when it can be sent through GO Park to Let's Go (170 of them). Each summary:

| Key | Meaning |
|---|---|
| `n` | Number of PKHeX slots summarised. |
| `shiny` | 1 when at least one slot can be shiny. |
| `from` | Earliest availability date, only when *every* slot has a start date. |
| `to` | Latest availability date, only when *every* slot has an end date (otherwise it is still obtainable). |
| `types` | Distinct `PogoType` names, in enum order. The enum: `Wild`, `Egg`, `Egg12km`, `Raid`, `RaidMythical`, `RaidUltraBeast`, `RaidShadow`, `RaidShadowMythical`, `RaidShadowUltraBeast`, `FieldResearch`, `ResearchBreakthrough`, `SpecialResearch`, `TimedResearch`, `CollectionChallenge`, `VivillonCollector`, `PartyPlay`, `StampRally`, `GOPass`, `ReferralBonus`, `GBL`, `GBLMythical`, `GBLEvent`, `Shadow`, `ShadowMythical`, `ShadowUltraBeast`, `MaxBattle`, `MaxBattleMythical`, `MaxBattleUltraBeast`, `MaxBattleGigantamax`, `PremierBallBug`, `PremierBallBugMythical` (24 of them occur today). |
| `lvMin` | Lowest slot level. |
| `fmt` | `home` only: earliest format the transfer lands in (`PK7`, `PB7`, `PK8`, `PA8`, `PK9`). |

Dates follow PKHeX's display convention (slots flagged "local time" are shifted by a day).

## forms.json

```jsonc
{ "contexts": ["Gen9a","Gen9","Gen8a","Gen8b","Gen8","Gen7b","Gen7","Gen6","Gen5","Gen4","Gen3","Gen2","Gen1"],
  "rows": [
    {"s":25,"forms":[
      {"f":0,"names":[{"n":"Normal","ctx":["Gen9a","Gen9","Gen8a","Gen8b","Gen8","Gen7b","Gen7","Gen6"]},{"n":"","ctx":["Gen5","Gen4","Gen3","Gen2","Gen1"]}],"gmax":1,"pt":"ZA","gr":127,"t":["Electric"]},
      {"f":1,"names":[{"n":"Original","ctx":["Gen9a",…,"Gen7"]},{"n":"Rock Star","ctx":["Gen6"]}],"pt":"SV","gr":0,"t":["Electric"]}, … ]},
    … ] }
```

`rows[i].s === i + 1` for species 1..1025. `forms` covers every form index from 0 up to the largest of: the
form-name list length in any context, `FormCount` in any PersonalTable, and the highest index any table
accepts (1,491 forms in total). `forms[j].f === j`.

| Key | Type | Meaning |
|---|---|---|
| `f` | number | Form index. |
| `names` | `{n, ctx[]}[]` | English form name per context, grouped: each entry is one name and the contexts that use it, newest context first, so `names[0].n` is the current name. Only contexts whose games contain the species are listed. `n` is a bare qualifier (`"Alola"`, `"Mega X"`, `"B"`); `""` means the species has no named forms there. Empty array = no context names this index. |
| `mega` | 1 | Mega Evolution. |
| `primal` | 1 | Primal Reversion. |
| `battleOnly` | string[] | Contexts in which the form only exists in battle (Megas, Primals, Zen Mode, Meteor Minior …). Listed by context because generation 9 covers both SV (no Megas) and Z-A. |
| `outOfBattle` | number | Only with `battleOnly`: the form it reverts to. |
| `outOfBattleIn` | `{context: form}` | Only when that differs between contexts (Complete Zygarde). |
| `fused` | 1 | Kyurem / Necrozma / Calyrex fusion. |
| `totem` | 1 | Totem form (Gen 7). |
| `lord` | 1 | Hisuian Lord / Lady form. |
| `changeable` | 1 | The player can change another form into this one, in the newest context that has it. |
| `changeableIn` | string[] | Contexts where that holds, only when it is not all of them (Zygarde, Deerling, Sawsbuck). |
| `untradable` | 1 | Cannot be traded (battle-only and fused forms, Spiky-eared Pichu, Let's Go starters). |
| `gmax` | 1 | Can have the Gigantamax factor (Sword/Shield). |
| `pt` | string | PersonalTable the next two fields come from: the newest Gen 5+ table that has the form (`ZA`, `SV`, `LA`, `BDSP`, `SWSH`, `GG`, `USUM`, `SM`, `AO`, `XY`, `B2W2`, `BW`). |
| `ptBase` | 1 | No such table has the form; `gr` / `t` are the species' base entry (only Spiky-eared Pichu). |
| `gr` | number | Gender ratio byte: 0 male only, 254 female only, 255 genderless, otherwise the female threshold (31 = 12.5 % female, 63 = 25 %, 127 = 50 %, 191 = 75 %, 225 = 87.5 %). |
| `t` | string[] | One or two type names. |

A species row also has `formArgs` when the form argument is a named index: only Alcremie, whose seven sweets
are `["Strawberry","Berry","Love","Star","Clover","Flower","Ribbon"]` (Alcremie's `forms` are its nine creams).

Form flags describe the index, not a game: gate everything on `presence.json`.

## presence.json

```jsonc
{ "RD": [[1,0],[2,0],…], "SW": [[1,0],…,[25,0],[25,1],…], …, "GO": [] }
```

Per game code, every `[species, form]` its PersonalTable accepts, sorted. "Present" means the game has data
for the Pokémon (it can exist in a save, e.g. by transfer), not that it can be obtained there. `GO` is `[]`
(it has no table); `COLO` and `XD` use the shared Gen 3 table.

## evolutions.json

```jsonc
{ "SL": [ {"from":[25,0],"to":[26,0],"m":"UseItem","id":8,"lv":0,"up":0,"arg":83,"argKind":"item","argName":"Thunder Stone"}, … ], …, "GO": [] }
```

Per game code, every forward evolution edge of that game's context whose two ends are both present in the
game, in species / form order.

| Key | Meaning |
|---|---|
| `from`, `to` | `[species, form]`. |
| `m`, `id` | PKHeX `EvolutionType` name and number (see below). |
| `lv` | Minimum level, 0 = none. Ignore it for trade and item methods (a few carry a stray value). |
| `up` | Non-zero when a level-up is required. Always 0 in PLA and Z-A. |
| `arg` | Raw argument. Without `argKind` it means nothing (in Gen 3-6 it repeats the level). |
| `argKind` | `item`, `move`, `species`, `type`, `version` or `count`, when the method uses its argument. |
| `argName` | English name of the item / move / species / type, or the game code for `version`. Not present for `count`. |

Methods that occur: 1 `LevelUpFriendship`, 2 `LevelUpFriendshipMorning`, 3 `LevelUpFriendshipNight`, 4
`LevelUp`, 5 `Trade`, 6 `TradeHeldItem`*, 7 `TradeShelmetKarrablast`, 8 `UseItem`*, 9 `LevelUpATK`, 10
`LevelUpAeqD`, 11 `LevelUpDEF`, 12 `LevelUpECl5`, 13 `LevelUpECgeq5`, 14 `LevelUpNinjask`, 15
`LevelUpShedinja`, 16 `LevelUpBeauty`#, 17 `UseItemMale`*, 18 `UseItemFemale`*, 19 `LevelUpHeldItemDay`*, 20
`LevelUpHeldItemNight`*, 21 `LevelUpKnowMove`†, 22 `LevelUpWithTeammate`‡, 23 `LevelUpMale`, 24
`LevelUpFemale`, 25 `LevelUpElectric`, 26 `LevelUpForest`, 27 `LevelUpCold`, 28 `LevelUpInverted`, 29
`LevelUpAffection50MoveType` (type), 30 `LevelUpMoveType`, 31 `LevelUpWeather`, 32 `LevelUpMorning`, 33
`LevelUpNight`, 34 `LevelUpFormFemale1`, 36 `LevelUpVersion`§, 37 `LevelUpVersionDay`§, 38
`LevelUpVersionNight`§, 39 `LevelUpSummit`, 40 `LevelUpDusk`, 41 `LevelUpWormhole`, 42 `UseItemWormhole`*, 43
`CriticalHitsInBattle`#, 44 `HitPointsLostInBattle`#, 45 `Spin`, 46 `LevelUpNatureAmped`, 47
`LevelUpNatureLowKey`, 48 `TowerOfDarkness`, 49 `TowerOfWaters`, 50 `LevelUpWalkStepsWith`#, 51
`LevelUpUnionCircle`, 52 `LevelUpInBattleEC100`, 53 `LevelUpInBattleECElse`, 54 `LevelUpCollect999`#, 55
`LevelUpDefeatEquals`#, 56 `LevelUpUseMoveSpecial`#, 57 `LevelUpKnowMoveECElse`†, 58 `LevelUpKnowMoveEC100`†,
59 `LevelUpRecoilDamageMale`#, 60 `LevelUpRecoilDamageFemale`#, 62 `UseMoveBarbBarrage`#, 90
`UseItemFullMoon`*, 91 `UseMoveAgileStyle`, 92 `UseMoveStrongStyle`.
(* item, † move, ‡ species, § version, # count.)

Quirks to handle:

- **48 / 49 in `PLA`** are not Urshifu's towers: there they mean "use item by day" / "use item by night" and
  carry `argKind: "item"`. In every other game they have no argument.
- **Item ids are generation-native in Gen 1-3** (Thunder Stone is 33 / 23 / 96, and 83 from Gen 4 on).
  `argName` is already resolved with the right table.
- **Gen 1 and Gen 2 trees are lossy:** only `LevelUp`, `Trade`, `UseItem` exist. Friendship evolutions
  appear as `LevelUp` with `lv` 0 (Eevee → Espeon and → Umbreon are indistinguishable), held-item trades as
  plain `Trade`. Take the method text for those from a later game.
- **The Gen 7 tree is USUM's:** in SN / MN, Pikachu → Raichu (form 0) is `UseItemWormhole` and Alolan Raichu is
  plain `UseItem`.
- **No edge leads to Alolan Raichu / Exeggutor / Marowak in Gen 8+.**
- **Version-gated edges** (`argKind: "version"`, Cosmoem and Rockruff): both edges are listed for every game
  of the context, and `argName` names a game of the pair the *tree* was built for, so filter on it. `US`,
  `SW`, `SL` mean "the first version of the pair" and `UM`, `SH`, `VL` the second; because the Gen 7 tree is
  USUM's, Sun / Moon rows also say `US` / `UM`.

## eggs.json

```jsonc
{ "RD": [], "HG": [[1,0],[4,0],…,[172,0],…], …, "GO": [] }
```

Per game code, the `[species, form]` pairs that hatch *directly* from an egg bred in that game, sorted. A
pair is listed when PKHeX's egg generator, asked about exactly that species and form, produces an egg of it:
either it is its family's egg species (Pichu, Eevee, Riolu) or a split-breed species that hatches as itself
(Marill, Snorlax … from Gen 3 to Gen 8). Evolved forms are *not* listed (Pikachu comes from a Pichu egg: join
with `evolutions.json`). Empty for games without breeding: Gen 1, `COLO`, `XD`, `GP`, `GE`, `PLA`, `ZA`, `GO`.
Regional forms that breed true are listed with their own form; Rotom, Castform and battle-only forms only as
their out-of-battle form (the extractor applies this itself: PKHeX's Gen 2-5 generators do not); SV Scatterbug only as
form 18 (Fancy).

## balls.json

```jsonc
{ "HG": {"wild":[1,2,3,4,6,…,23],"fixed":[4,5,24],"gift":[4,16]}, … }
```

Per game code:

- `wild`: balls an ordinary wild capture can legally be in (PKHeX's legality set, not a shop inventory).
  Gen 1/2 are `[4]` because those games do not record the ball. `GO` is the set a GO → HOME transfer can
  arrive in.
- `fixed`: distinct fixed-ball ids (`b`) over that game's encounter rows (for `GO`, over its slots).
- `gift`: distinct ball ids of the mystery gifts the game can receive.

## strings.json

```jsonc
{ "species": ["---","Bulbasaur",…],          // index = national number, 0..1025
  "types": ["Normal","Fighting",…,"Fairy","Stellar"],   // index = PKHeX type id, 0..18
  "balls": ["None","Master Ball",…,"Origin Ball"],       // index = Ball id, 0..37
  "games": { "RD": "Red", "GN": "Blue [INT]/Green [JP]", … },
  "items": { "Gen1": { "33": "Thunder Stone", … }, "Gen9": { … }, … },
  "moves": { "205": "Rollout", … } }
```

- `balls`: PKHeX's own list, in which the Hisuian balls 28, 29, 30 and 34 read plain `Poké Ball`, `Great
  Ball`, `Ultra Ball`, `Heavy Ball`. Use ids, not names, as keys.
- `games`: PKHeX's display names. `COLO` and `XD` both read `"Colosseum/XD"`.
- `items` / `moves`: only the entries evolution arguments refer to, keyed by context because Gen 1-3 use
  their own item numbering.

## localized.json

```jsonc
{ "ja": { "species": ["---", "フシギダネ", …], "types": […], "abilities": […], "balls": […],
          "games": { "RD": "赤", … }, "items": […], "moves": […],
          "forms": { "26": ["ノーマル", "アローラのすがた"], … },
          "locations": { "Gen9": { "6": "南１番エリア", … }, … } },
  "en": { … }, "fr": { … }, "it": { … }, "de": { … }, "es": { … }, "es-419": { … }, "ko": { … }, "zh-Hans": { … }, "zh-Hant": { … } }
```

The games' own text in the ten languages PKHeX carries (`GameInfo.GetStrings(language)`), for everything the other
files name in English. `en` repeats the English tables so that a consumer can line the others up against it.

- `species`, `types`, `abilities`, `balls`, `items`, `moves`: whole PKHeX tables, indexed by id like the English ones
  (`species` and `balls` are cut like strings.json). `items` is the modern item table; a language's `items` or `moves`
  may be a line longer or shorter than English at the end.
- `games`: `GameVersion` name per game code, the version word only ("Scarlet", "Écarlate"). `COLO` and `XD` share
  PKHeX's one name; `GN` is "Blue [INT]/Green [JP]" in every language.
- `forms`: species -> the primary name of each form index, i.e. what forms.json `names[0].n` is in English. Species
  with no named form are left out.
- `locations`: the same sets and ids as locations.json, looked up the same way. A language PKHeX has no text for
  repeats the English name (Korean Colosseum / XD). The names keep PKHeX's suffixes, as in locations.json.

A line PKHeX has not translated is the English line again. Not listed in `meta.json.files`.

## Pitfalls

1. **Sentinel forms.** `f` 31 means "random form" and 30 means "form decided by the save's region":
   Unown 31 (Gen 2, Gen 4, ORAS), Minior 31 (SM/USUM, SV), Scatterbug / Spewpa / Vivillon 30 (XY, SV, one USUM
   static). Expand 31 to every form present in that game; treat 30 as "any pattern". They never appear in
   `presence.json` or `forms.json`.
2. **Pseudo-locations.** Many non-wild rows point at a placeholder, not a place: in-game trades (Gen 2 126
   `(Can't Tell)`, Gen 3 254 `(In-game Trade)`, Gen 4 2001, Gen 5 30002, Gen 6+ 30001 `a Link Trade (NPC)`),
   Gen 2 events 127 `(Event)`, Gen 3 events 255 `(Fateful Encounter)` and gift eggs 253, Pokéwalker 233,
   Entree Forest 75, Dream Radar 30015, Poké Pelago 30016, raid dens 162 `Pokémon Den`, Tera raids 30024 `a
   crystal cavern`, gift eggs in the 2000 / 60000 ranges (named after the giver: `Riley`, `Jacq`). The real
   town is not in PKHeX.
3. **Gen 1 statics, gifts and trades are grouped and placeless.** They have no `L` and are stored once for
   `RD GN BU YW` or `RD GN BU` with the lowest legal level, not once per game: e.g. a single Game Corner
   Clefairy row at level 8 covers all four games although the level and even the availability differ per
   version. Per-game prize lists and locations must come from another source.
4. **Location names carry disambiguation suffixes** added by PKHeX: a trailing ` (2)` / ` (03)` ordinal
   (BDSP, Z-A, some SV: `Grand Underground (Grassland Cave) (2)`, `Oni Mountain (1)`), ` (-)` on ids PKHeX
   considers duplicates (`the Pokémon Research Lab (-)`), and ` [NNN]` plus `(C)` / `(XD)` tags in the `CXD`
   set (`Phenac City (C) [003]`). Strip them for display; keep the ids for identity. SwSh and Gen 6/7 names
   may contain a real sub-area in parentheses (`Route 3 (Ouvert Way)`), which is not a suffix.
5. **`BU` (Japanese Blue) only holds the slots that differ** from Red/Green (82 wild rows against ~260), so
   it is not a complete game on its own.
6. **Scarlet / Violet wild data is not split by version.** Every `EncounterSlot9`, `EncounterFixed9` and
   `EncounterOutbreak9` row lists both `SL` and `VL`; version exclusives (Larvitar, Bagon, Dreepy …) are not
   encoded. Only `Encounters9.StaticSL` / `StaticVL` and the Tera raid host games differ.
7. **Paired games are separate rows.** Each version has its own holder field (`SlotsD` / `SlotsP`), and `src`
   and `label` are part of a row's identity, so identical encounters in Diamond and Pearl are two rows. Merge
   them downstream after dropping `src`, `label`, `t`, `n`.
8. **Evolved species have few or no rows.** PKHeX lists what can be *encountered*. Evolutions and bred
   Pokémon have to be derived from `evolutions.json` and `eggs.json`.
9. **Colosseum bonus gifts.** `EncounterGift3Colo` rows from `Encounters3RSE.ColoGiftsR` / `ColoGiftsS`
   (Japanese bonus-disc Pikachu and Celebi, Mt. Battle Ho-Oh) are listed under `COLO`, the game that hands
   them out, although PKHeX's `Version` for them is Ruby / Sapphire (kept in `c.originGame`). Their `x` is
   `Gen3` (location 255), not `CXD`.
10. **Gen 1 / Gen 2 always report ball 4** (those games do not record a ball); do not read a "fixed Poké
    Ball" into `b` there. Gen 1 never has `h` (shininess is DV-derived); Gen 2 has it on the red Gyarados,
    the Odd Eggs and a few events.
11. **Level maxima of 100** on `EncounterTrade1/2/3`, a few `EncounterTrade4PID`, and some Magikarp-style
    slots are PKHeX legality bounds (the Pokémon may have been levelled since), not encounter levels.
    `EncounterTrade1` minimum levels are the Red/Blue/Yellow values, independent of PKHeX settings.
12. **Raids.** A stock den template is one species at one star range for one den table; the same species
    appears in many rows. `L` on `raid` rows is the den's real locations (24 rows of two unplaced den tables
    only have 162); `raid-event` rows only have the pseudo-location.
13. **Arceus in Gen 4** has a `???` type at form index 9 that does not exist (not in `presence.json`), and
    its later types sit one index higher than in every other generation: Gen 4 form 10 is Fire, which is
    form 9 everywhere else. `forms.json` shows this (`names` of form 9 is `Fire` with a `???` entry for
    `Gen4`). The indices are left raw.
14. **Form names are per context, not per game.** XY returns cosplay Pikachu names although only ORAS has the
    forms. Always gate on `presence.json`.
15. **Presence is not obtainability,** and species-indexed evolution trees were filtered with it; do not
    re-derive edges from PKHeX without the same filter.
16. **Not encoded anywhere in PKHeX** (and therefore absent): requested species of in-game trades, SM/USUM
    Island Scan tagging, Gen 2 and Gen 6 roamer flags, fossil / prize tagging, GO → HOME ball restrictions per
    slot, and gender differences.
