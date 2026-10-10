# Pelagix shared components ("Abyss")

Live reference: `npm run dev:web`, then `#/_kit` (source: `features/kit/KitPage.tsx`; copy usage from it).
Import from the barrels: `@renderer/components/ui`, `@renderer/components/pokemon`, `@renderer/lib/anim`.
Do not edit shared files from a feature; report what is missing instead.

## Rules
- Colours, spacing, radii, shadows and durations come from `styles/tokens.css`. No hard-coded colours.
- Plain CSS next to the component (`Name.tsx` imports `./Name.css`). Prefixes in use: `ui-` kit, `pk-` Pokémon,
  `shell-` app frame, `u-` utilities, `kit-` gallery. Give each feature its own prefix (`dex-`, `living-` ...).
- Animate only `transform` / `opacity`, and only through `lib/anim.ts` (it honours reduce-motion).
  No `backdrop-filter` on anything that scrolls. Long lists go through `VirtualGrid`.
- Every icon-only control needs a label (`IconButton label`), every image an `alt` ("" when decorative).

## Page layout (`styles/base.css`)
`<div className="page">` = centred, max `--page-max`, padding `--sp-6 --page-pad --sp-12`. It scrolls inside the
shell's main region (a `ScrollArea`, so `useScrollParent()` returns it). `page page--fill` = exactly the height of the
main region for pages with their own scroller. Header: `.page-header` > `.page-title` (+ `.page-subtitle`), actions on
the right. Sections: `.section` > `.section-header` > `.section-title`. Small caps label: `.u-eyebrow`. Also
`.u-muted`, `.u-truncate`, `.u-sr-only`, `.u-selectable` (text is unselectable by default), `.u-accent-text`.

## Tokens worth knowing
Surfaces `--bg-0..3`, `--surface-1..3` (glass), `--surface-solid(-2)` (anything floating), `--surface-inset` (wells),
`--surface-hover/press`. Lines `--line`, `--line-strong`, `--line-accent`. Text `--text-1/2/3`, `--text-disabled`.
Accent `--accent` (text/icons), `--accent-grad` + `--text-on-accent`, `--accent-soft`. Catch red `--catch`,
`--catch-text`, `--catch-grad`. Gold (shiny, achievements) `--gold`, `--gold-text`, `--gold-grad`, `--gold-soft`.
`--success|warning|danger(-text|-soft)`, `--male`, `--female`. Types `--type-<id>` (19) via `typeColor(id)`.
Scale `--sp-1..16` (4 px), `--fs-2xs..display`, `--fw-*`, `--r-xs..xl|full`, `--ctl-sm|md|lg` (28/36/44),
`--shadow-1..3`, `--z-*`, `--dur-1..4`, `--ease-out|in-out|spring`. Layout `--rail-w`, `--topbar-h`, `--page-pad`.

## `components/ui`
| Component | Usage |
|---|---|
| `Button` | `<Button variant="primary\|catch\|ghost\|subtle\|danger" size="sm\|md\|lg" icon="plus" iconEnd loading block>` (icons: name or element) |
| `IconButton` | `<IconButton icon="edit" label="Edit" variant size pressed round tooltip={false}>`; label is the tooltip |
| `Icon` | `<Icon name="search" size={18} label?>`; all names in `ICON_NAMES` (see the kit) |
| `Chip` / `Tag` | `<Chip tone variant="soft\|outline\|solid" icon selected onClick onRemove color>`; `Tag` = small static chip |
| `Badge` | `<Badge count={3} tone />`, `<Badge dot />`, `<Badge>NEW</Badge>` |
| `Panel` (= `Card`) | `<Panel tone="glass\|solid\|inset\|accent\|gold" padding title eyebrow actions chamfer brackets interactive>` |
| `HudBrackets` | corner brackets inside any positioned box |
| `Dialog` | `<Dialog open onClose title description media footer size="sm..xl" chamfer dismissable hideClose flush>`; `data-autofocus` picks first focus, `initialFocus` overrides it (a ref, or `'panel'` for the dialog itself: use that for a dialog nobody asked for, so a key on its way to the page cannot press a button). Closing gives focus back to what had it; if that was removed meanwhile, place focus yourself (`features/living/focus.ts`) |
| `Drawer` | same props, `side="right\|left" width` |
| `Tabs` + `TabPanel` | `<Tabs items value onChange label idBase />` `<TabPanel idBase id value>` |
| `SegmentedControl` | `<SegmentedControl options={[{value,label,icon}]} value onChange label size fill />` |
| `Switch`, `Checkbox` | `<Switch checked onChange label description reverse />`, `<Checkbox checked onChange label indeterminate />` |
| `Select` | `<Select options={[{value,label,icon,description,group}]} value onChange label placeholder />` |
| `Combobox` | searchable `Select`; `value` may be null; `freeText={{text,onTextChange}}` keeps typed text; `maxItems` |
| `TextField`, `TextArea`, `NumberField`, `DateField` | `value` + `onChange(value)`; `label hint error optional icon suffix size`; date is ISO `yyyy-mm-dd` |
| `Field` | label / hint / error wrapper for custom controls |
| `Tooltip` | `<Tooltip content placement="top\|bottom\|left\|right">child</Tooltip>` (wrapper is `display: contents`) |
| `Menu` | `<Menu trigger={<Button/>} label items={[{id,label,icon,hint,danger,checked,onSelect},{separator:true},{heading}]} />` |
| `ProgressBar`, `ProgressRing` | `value` 0..1, `tone`, `label`; ring takes `size` and centre children |
| `NumberTicker` | `<NumberTicker value={n} decimals format />` counts to each new value |
| `EmptyState` | `<EmptyState icon title description action size tone />` |
| `Skeleton`, `Spinner`, `Kbd` | `<Skeleton variant width height />`, `<Kbd keys={['Ctrl','K']} />` |
| `ScrollArea` | themed scroller, `edges` fades; provides `useScrollParent()` |
| `VirtualGrid` | `<VirtualGrid items renderItem minColumnWidth itemHeight gap label onActivate scroll="page\|self" ref />`; the cell is the focus target, so render no buttons inside; handle: `scrollToIndex`, `focusIndex` |
| `ErrorBoundary` | `<ErrorBoundary resetKeys fallback>`; each routed page already sits in one. `extra` adds content under the default fallback |
| `Toaster` | mounted by `App`; push with `toast({kind,title,body,icon,durationMs,action})` from `store/ui`; `setToastMedalRenderer(fn)` supplies achievement art. `action: {label, onSelect}` adds one button ("Undo", "View"): it runs once, then the toast leaves, and the toast stays at least 7 s unless `durationMs` is given. F6 moves focus to the newest toast and back. While a dialog is open the toasts sit at the top centre, while a drawer is open at the bottom left, so they never cover its buttons |
| `Lens`, `Leds` | Pokédex hardware ornaments |
| `layers` hooks | `useFloating`, `useOutsidePress`, `useEscapeLayer`, `useFocusTrap`, `usePresence`, `Portal` for custom popovers. `useLayerOpen()` / `isLayerOpen()` (from `components/ui/layers`) are true while anything Escape would close is up (a dialog, a drawer, the command palette, an open menu, list or filter popover): use them for anything that must wait its turn instead of opening on top |

## `components/pokemon`
| Component | Usage |
|---|---|
| `Sprite` | `<Sprite species={25} form={0} shiny female variant gmax size={96} silhouette alt />` or `<Sprite path="shiny/6.png" />`; `size="fill"` + `resolution`. Never shifts layout; CDN fallback built in |
| `SpriteStage` | hero stage: `<SpriteStage dexNumber glow={typeColor(t)} glow2><Sprite/></SpriteStage>` (size it from outside) |
| `TypeBadge(s)` | `<TypeBadge type="fire" variant="pill\|dot" size />`, `<TypeBadges types={form.types} />`; `TYPE_IDS`, `TYPE_NAMES` |
| `BallIcon` | `<BallIcon ball={entry.ball} size={24} label? />` (PKHeX id or `BallDef`; all 37) |
| `GameIcon` | `<GameIcon game={gameOrId} size={32} tooltip />`; unknown ids get a fallback tile |
| `GameBadge` | origin of an entry: `<GameBadge game size="sm\|md\|lg" compact short system />` |
| `SystemIcon` | `<SystemIcon system="switch" size={18} />` |
| `GenderIcon`, `ShinyMark` | `<GenderIcon gender="f" />`, `<ShinyMark size twinkle />` |
| `DexNumber` | `<DexNumber id={25} variant="badge\|plain\|watermark" />` |
| `FormCategoryTag` | `<FormCategoryTag cat={form.cat} region={form.region} />` |
| `EntryCard` | THE way a logged entry is shown: `<EntryCard entry variant="card\|row\|compact" showSpecies actions menu onOpen openLabel highlight />` (see below) |
| `EntryRowHeader` | column labels aligned with `variant="row"`: `<EntryRowHeader showSpecies actions />` (pass the same two props as the rows) |

## Entries: `EntryCard` and `lib/entry-actions.ts`
Never lay out an entry by hand; every field the user logged is already in `EntryCard`, and missing data is left out
(unknown game ids read "Unknown game", unknown Pokémon "Pokémon #1400").
- `variant="card"` (default): rich card for grids and the Pokémon page. Use `repeat(auto-fill, minmax(300px, 1fr))`;
  it stretches to its grid row, pins its footer (ball, level, date) to the bottom and clamps notes to 3 lines.
- `variant="row"`: one 56 px line; columns have content-independent widths, so rows of equal width align. Columns
  drop as the *container* narrows (ball name < 900, level + OT < 700, game name < 580, location < 460 px). Put
  `EntryRowHeader` above for labels. `card` and `row` need a parent that gives them a width (they are size containers).
- `variant="compact"`: 52 px, render + name + date + game icon + ball; for drawers, tooltips, the dashboard. No menu.
- `showSpecies={false}`: hides the name on a page that is about one Pokémon; the game becomes the heading, the
  form that was caught ("Alolan Raichu") still shows, and "Open Pokédex page" leaves the menu.
- `actions` (default true): the kebab menu built by `entryMenuItems`; `menu={{ openSpecies, onDuplicated, onDeleted }}`.
- `onOpen(entry)`: the whole card becomes one target (click, Enter, Space) with its own focus ring; the menu stays
  separate. `highlight`: gold ring, and one `popIn` each time it turns true (a just-logged entry).
- Sizes for virtual lists: `ENTRY_CARD_METRICS.{rowHeight, compactHeight, cardMinWidth}`. Inside a `VirtualGrid`
  cell pass `actions={false}` and no `onOpen` (the cell is the focus target; use `onActivate`).

`lib/entry-actions.ts` holds the verbs, identical everywhere; none of them throws (failures become error toasts):
`editEntry(id)` opens the editor · `duplicateEntryWithToast(id)` → the copy (toast offers "Edit") ·
`deleteEntryWithUndo(id)` → the removed entry, with an "Entry deleted" toast whose Undo restores it unchanged (same
id and timestamps) and closes the editor if it was open on it · `restoreEntry(entry)` · `openEntrySpecies(entry)` ·
`entryMenuItems(entry, opts)` → `Menu` items (Open Pokédex page, Edit, Duplicate, Delete; the first is left out for a
Pokémon the data does not know). Wording helpers:
`entrySummary(dex, entry)` ("Shiny Alolan Raichu · Pokémon Sun"), `entryMethodText(entry)`, `entryOriginText(dex, entry)`
("Evolved from Pichu"). Custom menus: build on `entryMenuItems(entry)` rather than re-creating its items.
A `Menu` trigger must be the real button: `IconButton` needs `tooltip={false}` there (wrap a real box in `Tooltip` instead).

## `lib/anim.ts` (anime.js v4; never write v3 calls)
`motionOK()` / `useMotionOK()`; `enterStagger(els, {step, y, from, limit})` lists and grids; `pageEnter(el)` (the shell
already runs it per route); `popIn(el)`; `pulse(el)`; `flipIn(el)`; `shake(el)`; `countUp(el, to, {from, decimals,
format})`; `burst(container, {colors, count, x, y, distance})` (container must be positioned); `safeAnimate(targets,
params)` for one-offs; `useAnimeScope(rootRef, (scope, {motion}) => {...}, deps)` for anything looping or
selector-based (reverted on unmount). Effects clean up their inline styles when done and never leave content hidden.

## Shell facts
Routes (`shell/routes.tsx`, hash based): `/`, `/dex`, `/dex/:id?form=`, `/living`, `/journal`, `/achievements`,
`/settings`, dev-only `/_kit`. The title bar prints the page name and sets `document.title`, but it is not a
heading: every page renders exactly one `<h1>` of its own (`.page-title`, or the title of its hero). Build paths with `paths.*` and navigate with wouter (`useLocation`, `<Link href>`,
`useParams`, `useSearch`) or `navigate()` from `shell/router.ts`. Ctrl+K toggles `useUiStore().commandPalette`; the
top bar owns the shiny-view toggle (`useUiStore().dexView.shinyView`). Theme: call `setSettings({ theme })`; the app
applies it. `EntryEditorHost`, `CommandPalette` and `AchievementWatcher` are mounted once by `AppShell`. Achievement toasts
wait while the entry editor is open and are announced once it has closed.

Updates (`features/updates`, CSS prefix `upd-`) exist in the desktop app only. There `App` mounts `UpdateWatcher`
(headless: follows the update state of the main process) and `UpdateWindows` (the changelog of a newer version, and
"What's new" after an update) next to the shell, not inside it, so that they still work when the shell cannot start
or has crashed. The foot of the rail shows `UpdateIndicator` while a newer version is on offer; the start-up error
and the crash message, which have no rail, show `UpdateNotice` instead. The state is in `useUpdateStore`
(`features/updates/store.ts`); the main process owns it, so nothing there is decided "once" by the page. An update
window never opens by itself over a dialog, the entry editor, the command palette or an open dropdown, and one that
does open by itself puts the keyboard focus on the window, not on a button (`openByItself`). Release
notes are untrusted Markdown: show them only through `ReleaseNotes` (`markdown.ts` + `render.ts`, no HTML anywhere).
In a browser none of this is mounted and Settings has no Updates section; the kit (`#/_kit`, "Updates") previews every
state from made-up snapshots.
