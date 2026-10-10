# Text and languages

Pelagix is shown in the ten languages of the Pokémon games (`src/shared/languages.ts`). One setting, `settings.language`, drives the interface text (this folder) and the Pokémon terms (`terms.ts`). English is the source: every other language may be partial and falls back to English key by key.

## Adding a message

1. Put it in the English file of your namespace, `en/<namespace>.ts`: `'toolbar.clear': 'Clear filters'`.
2. Use it: `t('pokedex.toolbar.clear')`. The full key is `<namespace>.<key>`; a key that does not exist is a compile error.

```tsx
import { t, useT, rich } from '@renderer/i18n'

const t = useT()                                   // in a component: renders again when the language changes
t('home.greeting', { name })                       // 'Welcome, {name}'
t('journal.entries', { count: n })                 // plural, see below
```

**Keys** are `area.thing` in lowerCamel, named for what the text is for, not for its English words (`topbar.search`, not `searchPokemon`). One namespace per feature folder; `common` is for words many features share (Cancel, Save, Close). Never build a sentence from pieces (`t(a) + ' ' + t(b)`): word order differs between languages. Use one message with placeholders.

**Placeholders** are `{name}`. A number is written with the language's digit grouping (1,234); pass a string for a year, a level or an id.

**Plurals**: the message is an object, chosen by `params.count` through `Intl.PluralRules`:
`'entries': { one: '{count} entry', other: '{count} entries' }`. English has `one` and `other`; Japanese, Korean and Chinese only `other`.

**Markup inside a sentence** (bold, a link, a `<kbd>`): keep the sentence whole and mark the words with tags; `<name/>` stands for an element with no text of its own.

```tsx
// 'boot.hint': 'Run <code>npm run data</code>, then press <key/>.'
rich('shell.boot.hint', { code: (c) => <code>{c}</code>, key: () => <Kbd keys={['F5']} /> })
```

## Rules

- **Nothing at module top level.** `const LABELS = { a: t('…') }` at the top of a file is resolved once, in English, and stays English. Keep *keys* in top-level tables and call `t()` when the text is shown; or make the table a function, or a getter (see `shell/routes.tsx`).
- **Pure functions and model files** import `t` from `@renderer/i18n` and call it inside the function. Their return values are text in the active language, so do not cache them across a language switch.
- **Tests see English**: the active language is English unless something sets it, and nothing does in tests. Existing assertions on English text stay as they are. A test that switches (`setActiveLanguage`, `installLanguage`) must switch back in `afterEach`.
- **Pokémon terms go through `@renderer/i18n/terms`**, not through `t()` and not straight off the datasets: `speciesName`, `speciesGenus`, `formLabel`, `formFullName`, `variantName`, `typeName`, `abilityName`, `ballName`, `gameName`, `gameShortName`, `gameGroupName`, `flavorText`. The official names live there, in all ten languages.
- **The save stores English.** An entry's `method` and `location` are the English labels of the datasets, and stay so: translate them only when showing them, with `methodLabel(text)`, `locationName(text)`, `conditionLabel(text)`, `evolutionText(text)`. Text without a translation comes back unchanged, which is what must happen to nicknames, trainer names, notes and anything else the user typed. Never write translated text into the save, and never compare stored text with translated text.
- **Numbers and dates** for display go through `lib/format.ts` (`formatCount`, `percent`, `formatDate`, `formatMonth`, `listText`), which follow the active language.
- A language switch remounts the whole screen (`App` keys it on the language), so local state and memos start afresh. Open dialogs close.

## Translating

A language is the folder `<language id>/` with the same files as `en/`, each a `Translation<'namespace'>`. Fill in what you have; leave the rest out. The files are loaded on demand, no runtime code changes. The native file dialogs of the main process have their own small table: `src/shared/main-text.ts`.

`parity.test.ts` checks every translated message against English: same key, same placeholders and tags, the plural forms the language needs, nothing empty. `PELAGIX_I18N_REPORT=1 npx vitest run src/renderer/src/i18n/parity.test.ts` lists what a language still lacks; add the language to `COMPLETE` there once nothing is missing, and a missing key becomes a failure.
