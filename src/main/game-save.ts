/**
 * Reading a save file of a Pokémon game: runs the bundled reader (tools/save-reader, a small
 * program built on PKHeX.Core) on the file and turns its JSON into typed data. The reader only
 * ever reads the file. No Electron imports, so it runs under vitest.
 *
 * Nothing the reader prints is passed on as it is: every field is checked, counts and string
 * lengths are capped, and a failure reaches the page as one of a closed set of reasons, never
 * as a message or a path.
 */

import { execFile } from 'node:child_process'
import { basename, join } from 'node:path'
import { ABILITY_BY_ID } from '@shared/abilities'
import type {
  GameSaveContents, GameSaveEncounter, GameSaveEncounterKind, GameSaveFailure, GameSaveInfo, GameSaveLocation,
  GameSavePokemon, GameSaveResult, PkhexVersion
} from '@shared/game-save-types'
import { MAX_EV, MAX_IV, PID_PATTERN, type EntryGender, type StatSpread } from '@shared/save-types'
import { isPlainObject } from './save'

export const READER_EXE = 'pelagix-save-reader.exe'
export const READER_TIMEOUT_MS = 30_000
/** A full save is a few megabytes of JSON at most. */
export const READER_MAX_OUTPUT_BYTES = 32 * 1024 * 1024
export const MAX_POKEMON = 10_000

const MAX_NAME = 64
const MAX_LOCATION_NAME = 120
const MAX_FINGERPRINT = 160
const MAX_FILE_NAME = 255

/** Where the reader is: next to the asar in an installed app, in the build's artifacts folder otherwise. */
export function readerPath(where: { packaged: boolean; resourcesPath: string; appPath: string }): string {
  return where.packaged
    ? join(where.resourcesPath, 'save-reader', READER_EXE)
    : join(where.appPath, 'tools', 'save-reader', '.artifacts', 'publish', READER_EXE)
}

// ---- strict reading of the reader's output ----

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null
}

const CONTROL = /[\u0000-\u001f\u007f]/g

/** A string without control characters, cut to `max`; null when it is no string. */
function text(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.replace(CONTROL, '').slice(0, max) : null
}

function version(value: unknown): PkhexVersion | null {
  if (!isPlainObject(value)) return null
  const id = int(value['id'], 0, 255)
  const name = value['name']
  if (id === null || typeof name !== 'string' || !/^[A-Za-z0-9]{1,16}$/.test(name)) return null
  return { id, name }
}

/** Null for JSON null and for anything that is not a complete location. */
function location(value: unknown): GameSaveLocation | null {
  if (!isPlainObject(value)) return null
  const id = int(value['id'], 0, 65535)
  const name = text(value['name'], MAX_LOCATION_NAME)
  return id === null || name === null || name.length === 0 ? null : { id, name }
}

const ENCOUNTER_KINDS: ReadonlySet<string> = new Set<GameSaveEncounterKind>([
  'wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'outbreak', 'shadow', 'walker', 'dream', 'event', 'bred', 'transfer'
])

/** An encounter of a kind this version does not know is dropped, which the page reads as "not known". */
function encounter(value: unknown): GameSaveEncounter | null {
  if (!isPlainObject(value)) return null
  const kind = value['kind']
  const type = value['type']
  const species = int(value['species'], 1, 9999)
  const form = int(value['form'], 0, 255)
  const game = version(value['version'])
  const levelMin = int(value['levelMin'], 0, 100)
  const levelMax = int(value['levelMax'], 0, 100)
  if (typeof kind !== 'string' || !ENCOUNTER_KINDS.has(kind)) return null
  if (typeof type !== 'string' || !/^[a-z0-9-]{1,32}$/.test(type)) return null
  if (species === null || form === null || game === null || levelMin === null || levelMax === null) return null
  return {
    kind: kind as GameSaveEncounterKind, type, species, form, version: game,
    location: location(value['location']), levelMin, levelMax
  }
}

/** Six whole numbers from 0 to `max`, or null: a spread is taken whole or not at all. */
function spread(value: unknown, max: number): StatSpread | null {
  if (!Array.isArray(value) || value.length !== 6) return null
  const stats = value.map((v) => int(v, 0, max))
  return stats.includes(null) ? null : (stats as StatSpread)
}

const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** One Pokémon, or null when any of the facts an entry is built from is missing or out of range. */
function pokemon(value: unknown): GameSavePokemon | null {
  if (!isPlainObject(value)) return null
  const place = value['place']
  if (place !== 'party' && place !== 'box') return null
  const box = place === 'box' ? int(value['box'], 0, 9999) : null
  const boxName = place === 'box' ? text(value['boxName'], MAX_NAME) : null
  const slot = int(value['slot'], 0, 9999)
  const species = int(value['species'], 1, 9999)
  const form = int(value['form'], 0, 255)
  const gender = value['gender']
  const ball = int(value['ball'], 0, 255)
  const origin = version(value['version'])
  const metLevel = int(value['metLevel'], 0, 100)
  const level = int(value['level'], 0, 100)
  const ot = text(value['ot'], MAX_NAME)
  const fingerprint = value['fingerprint']
  const { shiny, gmax, alpha, egg, fateful, legal, metDate, pid } = value
  if (place === 'box' && (box === null || boxName === null)) return null
  if (slot === null || species === null || form === null || ball === null || origin === null) return null
  if (gender !== 'm' && gender !== 'f' && gender !== 'n') return null
  if (metLevel === null || level === null || ot === null) return null
  if (typeof shiny !== 'boolean' || typeof gmax !== 'boolean' || typeof alpha !== 'boolean') return null
  if (typeof egg !== 'boolean' || typeof fateful !== 'boolean' || typeof legal !== 'boolean') return null
  // The fingerprint is compared, never shown, so it is taken whole or not at all.
  if (typeof fingerprint !== 'string' || fingerprint.length === 0 || fingerprint.length > MAX_FINGERPRINT) return null
  const nickname = text(value['nickname'], MAX_NAME)
  const ability = int(value['ability'], 1, 0xffff)
  const knownAbility = ability !== null && ABILITY_BY_ID.has(ability) ? ability : null
  return {
    place, box, boxName, slot, species, form,
    formArgument: int(value['formArgument'], 0, 0xffff_ffff),
    gender: gender satisfies EntryGender,
    shiny, gmax, alpha, egg, ball,
    version: origin,
    metLocation: location(value['metLocation']),
    eggLocation: location(value['eggLocation']),
    metLevel,
    metDate: typeof metDate === 'string' && ISO_DAY.test(metDate) ? metDate : null,
    level,
    nickname: nickname === null || nickname.length === 0 ? null : nickname,
    ot, fateful, legal,
    encounter: encounter(value['encounter']),
    // Optional facts: one that is missing or broken is left out, the Pokémon is still read.
    ability: knownAbility,
    abilityHidden: knownAbility !== null && value['abilityHidden'] === true,
    pid: typeof pid === 'string' && PID_PATTERN.test(pid) ? pid : null,
    ivs: spread(value['ivs'], MAX_IV),
    evs: spread(value['evs'], MAX_EV),
    fingerprint
  }
}

function saveInfo(value: unknown): GameSaveInfo | null {
  if (!isPlainObject(value)) return null
  const type = value['type']
  const game = version(value['version'])
  const generation = int(value['generation'], 1, 99)
  const trainer = text(value['trainer'], MAX_NAME)
  const boxes = int(value['boxes'], 0, 9999)
  const boxSlots = int(value['boxSlots'], 0, 9999)
  if (typeof type !== 'string' || !/^[A-Za-z0-9]{1,32}$/.test(type)) return null
  if (game === null || generation === null || trainer === null || boxes === null || boxSlots === null) return null
  return { type, version: game, generation, trainer, boxes, boxSlots }
}

/**
 * The reader's success document as typed data, or null when it is not one. A Pokémon that does
 * not pass is left out and counted in `dropped`; so is everything past `MAX_POKEMON`.
 */
export function parseReaderOutput(stdout: string, fileName: string): GameSaveContents | null {
  let doc: unknown
  try {
    doc = JSON.parse(stdout)
  } catch {
    return null
  }
  if (!isPlainObject(doc) || doc['ok'] !== true || !Array.isArray(doc['pokemon'])) return null
  const save = saveInfo(doc['save'])
  if (save === null) return null
  const records: unknown[] = doc['pokemon']
  const found: GameSavePokemon[] = []
  for (const record of records.slice(0, MAX_POKEMON)) {
    const one = pokemon(record)
    if (one !== null) found.push(one)
  }
  return { fileName: text(fileName, MAX_FILE_NAME) ?? '', save, pokemon: found, dropped: records.length - found.length }
}

/** The reason in the reader's failure document; anything else it may have printed is a failed reader. */
function readerFailure(stdout: string): GameSaveFailure {
  let doc: unknown
  try {
    doc = JSON.parse(stdout)
  } catch {
    return 'reader-failed'
  }
  if (!isPlainObject(doc) || doc['ok'] !== false) return 'reader-failed'
  const code = doc['error']
  return code === 'not-a-save' || code === 'too-large' || code === 'unreadable' ? code : 'reader-failed'
}

// ---- running the reader ----

/** What is looked at of a finished run. `error` is `execFile`'s: null when the reader exited with code 0. */
export interface ReaderRun {
  error: (Error & { code?: unknown; killed?: boolean }) | null
  stdout: string
}

export type RunReader = (exe: string, args: string[]) => Promise<ReaderRun>

/** No shell, no console window, and the reader is stopped when it runs too long or prints too much. */
export const runReader: RunReader = (exe, args) =>
  new Promise((resolve) => {
    execFile(
      exe, args,
      { windowsHide: true, timeout: READER_TIMEOUT_MS, maxBuffer: READER_MAX_OUTPUT_BYTES, encoding: 'utf8' },
      (error, stdout) => resolve({ error, stdout: typeof stdout === 'string' ? stdout : '' })
    )
  })

/** Reads the game save at `savePath` with the reader at `exe`. Never rejects. */
export async function readGameSave(exe: string, savePath: string, run: RunReader = runReader): Promise<GameSaveResult> {
  const fail = (reason: GameSaveFailure): GameSaveResult => ({ ok: false, reason })
  let result: ReaderRun
  try {
    result = await run(exe, [savePath])
  } catch {
    return fail('reader-failed')
  }
  const { error, stdout } = result
  if (error !== null) {
    if (error.code === 'ENOENT') return fail('reader-missing')
    // `killed` with a text code is the output cap; without one it is the timeout.
    if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return fail('reader-failed')
    if (error.killed === true) return fail('timed-out')
    // A numeric code is the reader's own exit code, and its output says why.
    return fail(typeof error.code === 'number' ? readerFailure(stdout) : 'reader-failed')
  }
  const contents = parseReaderOutput(stdout, basename(savePath))
  return contents === null ? fail('reader-failed') : { ok: true, contents }
}
