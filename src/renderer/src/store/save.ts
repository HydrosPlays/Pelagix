/**
 * The user's save: every logged catch, the Living Dex rules, settings and unlocked achievements.
 *
 * One zustand store holds the whole `SaveFile`. Updates are immutable (a changed part gets a new
 * object, an unchanged part keeps its identity, so selectors and memos stay cheap). Every mutation
 * bumps `updatedAt` and schedules a debounced write; the write is flushed when the window closes.
 * A failed write is reported in `lastError`, retried, and never costs in-memory state.
 */

import { useMemo } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { createEmptySave, type AppSettings, type CatchEntry, type DexRules, type SaveFile } from '@shared/save-types'
import { errorMessage } from '@renderer/lib/format'
import { newId } from '@renderer/lib/id'
import { checkEntry, parseSaveReport, sanitizeRules, sanitizeSettings, saveBackend, type SaveBackend, type SaveParseReport } from '@renderer/lib/storage'

export type SaveStatus = 'idle' | 'loading' | 'ready' | 'error'

/** A new catch as the editor hands it over; id and timestamps are assigned by the store. */
export type EntryInput = Omit<CatchEntry, 'id' | 'createdAt' | 'updatedAt'>
/** Fields to change on an entry. A key set to `undefined` clears that optional field. */
export type EntryPatch = Partial<EntryInput>

/** Values to add to one existing entry. */
export interface EntryCompletion {
  id: string
  patch: EntryPatch
}

export interface MergeResult {
  added: number
  /** Entries left out because their id already exists or they were invalid. */
  skipped: number
}

export interface SaveState {
  /** "ready" once `hydrate()` has loaded (or created) the save. Mutations are only allowed then. */
  status: SaveStatus
  /** Never null: an empty save until hydrated. */
  save: SaveFile
  /** Last load or write failure, as a sentence for the user; null once a later write succeeds. */
  lastError: string | null
  /** What `hydrate()` had to drop, repair or migrate; null when nothing was stored yet. */
  loadReport: Omit<SaveParseReport, 'save'> | null
  /** There are changes that are not on disk yet. */
  dirty: boolean

  /** Loads the save through the backend. Idempotent; never rejects (failures set `status: "error"` and `lastError`). */
  hydrate(): Promise<void>
  /** Logs a catch. Throws when a required field (species, form, game) is invalid. */
  addEntry(input: EntryInput): CatchEntry
  /** Changes an entry; null when the id is unknown. Throws when the result would be invalid. */
  updateEntry(id: string, patch: EntryPatch): CatchEntry | null
  /** Removes an entry and returns it (hand it to `mergeEntries` to undo); null when the id is unknown. */
  deleteEntry(id: string): CatchEntry | null
  /** Logs a copy of an entry under a new id; null when the id is unknown. */
  duplicateEntry(id: string): CatchEntry | null
  setRules(patch: Partial<DexRules>): void
  /** Changes settings. `rules` in the patch is merged like `setRules`. */
  setSettings(patch: Partial<Omit<AppSettings, 'rules'>> & { rules?: Partial<DexRules> }): void
  /** Records achievements as unlocked at `now` (ISO timestamp, default: the current time). Returns the ids that were new. */
  unlockAchievements(ids: readonly string[], now?: string): string[]
  /** Replaces everything (import). The save is validated again on the way in. */
  replaceSave(save: SaveFile): void
  /** Adds entries whose id is not present yet (import "merge", undo of a delete). */
  mergeEntries(entries: readonly CatchEntry[]): MergeResult
  /** Changes several entries in one step; unknown ids and changes that would make an entry invalid are skipped. Returns how many changed. */
  patchEntries(changes: readonly EntryCompletion[]): number
  /** Deletes all entries and achievements; settings too unless `keepSettings`. */
  resetAll(options?: { keepSettings?: boolean }): void
  /** Writes pending changes now. Resolves true when everything is on disk, false when the write failed. */
  flush(): Promise<boolean>
}

export interface SaveStoreOptions {
  /** Defaults to `saveBackend` (Electron IPC or localStorage). */
  backend?: SaveBackend
  /** Clock, as an ISO timestamp. */
  now?: () => string
  /** Quiet period before a mutation is written. Default 400 ms. */
  debounceMs?: number
  /** Flush on `beforeunload` / `pagehide`. Default true when there is a window. */
  flushOnUnload?: boolean
}

const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

function sameRules(a: DexRules, b: DexRules): boolean {
  return (Object.keys(a) as Array<keyof DexRules>).every((k) => a[k] === b[k])
}

/** Creates an independent save store. The app uses the shared `useSaveStore`; tests make their own. */
export function createSaveStore(options: SaveStoreOptions = {}) {
  const backend = options.backend ?? saveBackend
  const now = options.now ?? (() => new Date().toISOString())
  const debounceMs = options.debounceMs ?? 400

  // Revision counters: `rev` counts mutations, `sentRev` is the newest one handed to the backend,
  // `persistedRev` the newest one the backend confirmed.
  let rev = 0
  let sentRev = 0
  let persistedRev = 0
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let hydrating: Promise<void> | null = null
  const inflight = new Set<Promise<void>>()

  const store = create<SaveState>()(
    subscribeWithSelector((set, get) => {
      function schedule(delayMs: number): void {
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          send()
        }, delayMs)
      }

      /** Hands the current save to the backend unless that exact revision is already written or on its way. */
      function send(): void {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
        if (rev === persistedRev || rev === sentRev) return
        const mine = rev
        sentRev = mine

        let write: Promise<void>
        try {
          // Called synchronously on purpose: this may be running inside `pagehide`.
          write = backend.write(get().save)
        } catch (err) {
          write = Promise.reject(err)
        }
        const tracked: Promise<void> = write
          .then(
            () => {
              persistedRev = Math.max(persistedRev, mine)
              failures = 0
              if (persistedRev === rev) set({ dirty: false, lastError: null })
            },
            (err: unknown) => {
              if (mine <= persistedRev) return // a newer write has landed since
              if (sentRev === mine) sentRev = persistedRev
              set({ lastError: `Your changes could not be saved: ${errorMessage(err, 'unknown error')}` })
              const delay = RETRY_DELAYS_MS[failures++]
              if (delay !== undefined && timer === null) schedule(delay)
            }
          )
          .finally(() => {
            inflight.delete(tracked)
          })
        inflight.add(tracked)
      }

      function requireReady(action: string): void {
        if (get().status !== 'ready') throw new Error(`Save store: ${action}() was called before the save was loaded (status "${get().status}").`)
      }

      /** Installs the next save, stamps `updatedAt` and queues the write. */
      function commit(next: SaveFile, stamp: string): void {
        rev++
        set({ save: { ...next, updatedAt: stamp }, dirty: true })
        schedule(debounceMs)
      }

      return {
        status: 'idle',
        save: createEmptySave(now()),
        lastError: null,
        loadReport: null,
        dirty: false,

        hydrate() {
          if (get().status === 'ready') return Promise.resolve()
          if (hydrating) return hydrating
          set({ status: 'loading', lastError: null })
          const attempt = (async () => {
            try {
              const raw = await backend.load()
              const { save, ...report } = parseSaveReport(raw, now())
              set({ status: 'ready', save, loadReport: raw === null || raw === undefined ? null : report, lastError: null, dirty: false })
            } catch (err) {
              set({ status: 'error', lastError: `Your save could not be loaded: ${errorMessage(err, 'unknown error')}` })
            } finally {
              hydrating = null
            }
          })()
          hydrating = attempt
          return attempt
        },

        addEntry(input) {
          requireReady('addEntry')
          const stamp = now()
          const { entry, reason } = checkEntry({ ...input, id: newId(), createdAt: stamp, updatedAt: stamp }, stamp)
          if (!entry) throw new Error(`This entry cannot be saved: ${reason ?? 'invalid data'}.`)
          const save = get().save
          commit({ ...save, entries: [...save.entries, entry] }, stamp)
          return entry
        },

        updateEntry(id, patch) {
          requireReady('updateEntry')
          const save = get().save
          const index = save.entries.findIndex((e) => e.id === id)
          const old = save.entries[index]
          if (!old) return null
          const stamp = now()
          const { entry, reason } = checkEntry({ ...old, ...patch, id: old.id, createdAt: old.createdAt, updatedAt: stamp }, stamp)
          if (!entry) throw new Error(`This entry cannot be saved: ${reason ?? 'invalid data'}.`)
          const entries = save.entries.slice()
          entries[index] = entry
          commit({ ...save, entries }, stamp)
          return entry
        },

        deleteEntry(id) {
          requireReady('deleteEntry')
          const save = get().save
          const old = save.entries.find((e) => e.id === id)
          if (!old) return null
          commit({ ...save, entries: save.entries.filter((e) => e.id !== id) }, now())
          return old
        },

        duplicateEntry(id) {
          requireReady('duplicateEntry')
          const save = get().save
          const old = save.entries.find((e) => e.id === id)
          if (!old) return null
          const stamp = now()
          // The copy is another Pokémon: it does not stand for the one that was read from a game save, nor for the one sent to HOME.
          const { fingerprint: _fingerprint, inHome: _inHome, pid: _pid, ivs: _ivs, evs: _evs, ...rest } = old
          const copy: CatchEntry = { ...rest, id: newId(), createdAt: stamp, updatedAt: stamp }
          commit({ ...save, entries: [...save.entries, copy] }, stamp)
          return copy
        },

        setRules(patch) {
          get().setSettings({ rules: patch })
        },

        setSettings(patch) {
          requireReady('setSettings')
          const save = get().save
          const old = save.settings
          const merged = sanitizeRules({ ...old.rules, ...patch.rules })
          const rules = sameRules(merged, old.rules) ? old.rules : merged
          // An invalid value in the patch leaves the old setting alone rather than resetting it to the default.
          const next: AppSettings = {
            rules,
            theme: patch.theme === 'dark' || patch.theme === 'light' ? patch.theme : old.theme,
            reduceMotion: typeof patch.reduceMotion === 'boolean' ? patch.reduceMotion : old.reduceMotion,
            trainerName: typeof patch.trainerName === 'string' ? sanitizeSettings({ trainerName: patch.trainerName }).trainerName : old.trainerName
          }
          const unchanged = rules === old.rules && next.theme === old.theme && next.reduceMotion === old.reduceMotion && next.trainerName === old.trainerName
          if (unchanged) return
          commit({ ...save, settings: next }, now())
        },

        unlockAchievements(ids, at) {
          requireReady('unlockAchievements')
          const save = get().save
          const fresh = [...new Set(ids)].filter((id) => id !== '' && !Object.hasOwn(save.achievements, id))
          if (fresh.length === 0) return []
          const stamp = now()
          const when = at !== undefined && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : stamp
          const achievements = { ...save.achievements }
          for (const id of fresh) achievements[id] = when
          commit({ ...save, achievements }, stamp)
          return fresh
        },

        replaceSave(save) {
          requireReady('replaceSave')
          const stamp = now()
          commit(parseSaveReport(save, stamp).save, stamp)
        },

        mergeEntries(incoming) {
          requireReady('mergeEntries')
          const save = get().save
          const stamp = now()
          const ids = new Set(save.entries.map((e) => e.id))
          const added: CatchEntry[] = []
          for (const raw of incoming) {
            const { entry } = checkEntry(raw, stamp)
            if (!entry || ids.has(entry.id)) continue
            ids.add(entry.id)
            added.push(entry)
          }
          if (added.length > 0) commit({ ...save, entries: [...save.entries, ...added] }, stamp)
          return { added: added.length, skipped: incoming.length - added.length }
        },

        patchEntries(changes) {
          requireReady('patchEntries')
          const save = get().save
          const stamp = now()
          const entries = save.entries.slice()
          let changed = 0
          for (const { id, patch } of changes) {
            const index = entries.findIndex((e) => e.id === id)
            const old = entries[index]
            if (!old) continue
            const { entry } = checkEntry({ ...old, ...patch, id: old.id, createdAt: old.createdAt, updatedAt: stamp }, stamp)
            if (!entry) continue
            entries[index] = entry
            changed++
          }
          if (changed > 0) commit({ ...save, entries }, stamp)
          return changed
        },

        resetAll(resetOptions) {
          requireReady('resetAll')
          const stamp = now()
          const fresh = createEmptySave(stamp)
          commit(resetOptions?.keepSettings ? { ...fresh, settings: get().save.settings } : fresh, stamp)
        },

        async flush() {
          send()
          while (inflight.size > 0) await Promise.all([...inflight])
          return rev === persistedRev
        }
      }
    })
  )

  const flushOnUnload = options.flushOnUnload ?? true
  if (flushOnUnload && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onLeave = (): void => {
      void store.getState().flush()
    }
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
  }

  return store
}

/** The app's save store. Actions are stable: call them as `useSaveStore.getState().addEntry(...)` or select them. */
export const useSaveStore = createSaveStore()

// ---------------------------------------------------------------- selectors / hooks

/** Every logged catch, oldest first. The array is replaced (never mutated) when entries change. */
export const useEntries = (): readonly CatchEntry[] => useSaveStore((s) => s.save.entries)
export const useSettings = (): AppSettings => useSaveStore((s) => s.save.settings)
/** Living Dex rules. Keeps its identity until a rule actually changes. */
export const useRules = (): DexRules => useSaveStore((s) => s.save.settings.rules)
/** Achievement id -> ISO timestamp it was unlocked. */
export const useAchievements = (): Readonly<Record<string, string>> => useSaveStore((s) => s.save.achievements)
/** One entry by id, or undefined. */
export const useEntry = (id: string | null | undefined): CatchEntry | undefined =>
  useSaveStore((s) => (id == null ? undefined : s.save.entries.find((e) => e.id === id)))

const NO_ENTRIES: readonly CatchEntry[] = Object.freeze([])
const speciesIndexes = new WeakMap<readonly CatchEntry[], Map<number, CatchEntry[]>>()

/** Entries grouped by national dex number. Computed once per entries array and shared by all callers. */
export function entriesBySpecies(entries: readonly CatchEntry[]): ReadonlyMap<number, readonly CatchEntry[]> {
  let index = speciesIndexes.get(entries)
  if (!index) {
    index = new Map()
    for (const e of entries) {
      const list = index.get(e.species)
      if (list) list.push(e)
      else index.set(e.species, [e])
    }
    speciesIndexes.set(entries, index)
  }
  return index
}

/** The entries of one species (all forms), oldest first. A stable array until the entries change. */
export function useEntriesForSpecies(id: number): readonly CatchEntry[] {
  const entries = useEntries()
  return useMemo(() => entriesBySpecies(entries).get(id) ?? NO_ENTRIES, [entries, id])
}
