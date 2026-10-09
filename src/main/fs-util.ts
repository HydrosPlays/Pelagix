import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

/** Windows reports these while another process (antivirus, indexer, sync client) holds the file. */
const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800]

export function errorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined
  const code = (err as { code: unknown }).code
  return typeof code === 'string' ? code : undefined
}

export const isMissing = (err: unknown): boolean => errorCode(err) === 'ENOENT'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Runs `op`, retrying with backoff while it fails with a transient Windows sharing error. */
export async function retryTransient<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op()
    } catch (err) {
      const code = errorCode(err)
      if (attempt >= RETRY_DELAYS_MS.length || code === undefined || !TRANSIENT.has(code)) throw err
      await sleep(RETRY_DELAYS_MS[attempt]!)
    }
  }
}

let tmpSeq = 0

/**
 * Writes `data` to a sibling temp file and renames it over `file`, so readers only ever see the
 * old or the new content. `fsync` (default true) flushes the data to disk before the rename;
 * turn it off for caches, where a torn file after a power cut is detected and refetched anyway.
 */
export async function atomicWrite(
  file: string,
  data: string | Uint8Array,
  options: { fsync?: boolean } = {}
): Promise<void> {
  await fs.mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.${tmpSeq++}.tmp`
  try {
    const handle = await fs.open(tmp, 'w')
    try {
      await handle.writeFile(data)
      if (options.fsync !== false) await handle.sync()
    } finally {
      await handle.close()
    }
    await retryTransient(() => fs.rename(tmp, file))
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

/** File content, or null when the file does not exist. */
export async function readIfExists(file: string): Promise<Buffer | null> {
  try {
    return await retryTransient(() => fs.readFile(file))
  } catch (err) {
    if (isMissing(err)) return null
    throw err
  }
}
