/**
 * A message with plural forms, chosen by `params.count` through `Intl.PluralRules`. English uses
 * `one` and `other`; Japanese, Korean and Chinese only `other`; French, Italian and Spanish may add `many`.
 */
export type PluralForms = { readonly other: string } & { readonly [K in 'zero' | 'one' | 'two' | 'few' | 'many']?: string }

export type Message = string | PluralForms

/** One namespace file: a flat object of key -> text. */
export type Messages = { readonly [key: string]: Message }

/** Values for the `{name}` placeholders. Numbers are written the way the language groups digits; pass a string to print one as it is. */
export type MessageParams = { readonly [name: string]: string | number }
