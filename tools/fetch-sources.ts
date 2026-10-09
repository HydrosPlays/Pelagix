/**
 * Downloads the PokeAPI CSVs the data build needs, pinned to POKEAPI_COMMIT, into
 * data/sources/pokeapi-upstream. Files already present are kept unless --force is given.
 *
 *   node tools/fetch-sources.ts [--force]
 *
 * Only raw.githubusercontent.com/PokeAPI/pokeapi at the pinned commit is contacted.
 */
import fs from 'node:fs'
import path from 'node:path'
import { POKEAPI_COMMIT } from '../src/shared/sprites.ts'
import { UPSTREAM_CSVS, UPSTREAM_DIR } from './build-data/paths.ts'
import { parseCsv } from './build-data/csv.ts'

const BASE = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv/`

async function download(name: string): Promise<string> {
  const url = `${BASE}${name}.csv`
  const response = await fetch(url, { redirect: 'error' })
  if (!response.ok) throw new Error(`${url} answered ${response.status} ${response.statusText}`)
  const text = await response.text()
  const rows = parseCsv(text, `${name}.csv`)
  if (rows.length < 2) throw new Error(`${url} has no data rows`)
  return text
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  if (!/^[0-9a-f]{40}$/.test(POKEAPI_COMMIT)) throw new Error(`POKEAPI_COMMIT is not a full commit hash: ${POKEAPI_COMMIT}`)
  fs.mkdirSync(UPSTREAM_DIR, { recursive: true })

  let fetched = 0
  let kept = 0
  for (const name of UPSTREAM_CSVS) {
    const target = path.join(UPSTREAM_DIR, `${name}.csv`)
    if (!force && fs.existsSync(target)) {
      kept++
      console.log(`kept     ${name}.csv`)
      continue
    }
    const text = await download(name)
    // Write through a temporary file so an interrupted run never leaves a truncated CSV behind.
    const tmp = `${target}.part`
    fs.writeFileSync(tmp, text)
    fs.renameSync(tmp, target)
    fetched++
    console.log(`fetched  ${name}.csv  (${text.length} chars)`)
  }
  console.log(`\n${fetched} downloaded, ${kept} already present, commit ${POKEAPI_COMMIT}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
