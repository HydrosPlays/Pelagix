// Builds the PKHeX extractor and runs it:  node tools/extractor/run.mjs  [output directory]
//
// The PKHeX tree is a read-only reference. Building through --artifacts-path keeps every bin/obj folder
// (PKHeX.Core's included) under tools/extractor/.artifacts; this script fails if that ever stops being true.
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const project = join(here, 'Pelagix.Extractor.csproj')
const artifacts = join(here, '.artifacts')
const pkhexCore = join(root, 'PKHeX', 'PKHeX.Core')
const outDir = resolve(root, process.argv[2] ?? join('data', 'pkhex'))

const OUTPUTS = [
  'meta.json', 'encounters.json', 'locations.json', 'gifts.json', 'go.json', 'forms.json',
  'presence.json', 'evolutions.json', 'eggs.json', 'balls.json', 'strings.json', 'localized.json'
]

function fail(message) {
  console.error(`\n[extract] FAILED: ${message}`)
  process.exit(1)
}

/** Any bin/obj folder inside PKHeX.Core means a build wrote into the reference tree. */
function assertPkhexClean(when) {
  const dirty = ['bin', 'obj'].map((name) => join(pkhexCore, name)).filter((path) => existsSync(path))
  if (dirty.length !== 0) {
    fail(
      `${when}: build output found inside the read-only PKHeX tree:\n  ${dirty.join('\n  ')}\n` +
      'Nothing was deleted. Remove those folders yourself and always build with --artifacts-path (this script does).'
    )
  }
}

function run(command, args) {
  console.log(`[extract] ${command} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`)
  const started = Date.now()
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    // No lingering MSBuild worker nodes once the build is over.
    env: { ...process.env, MSBUILDDISABLENODEREUSE: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' }
  })
  if (result.error) fail(`could not start ${command}: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} exited with code ${result.status ?? `signal ${result.signal}`}`)
  return Date.now() - started
}

if (!existsSync(join(pkhexCore, 'PKHeX.Core.csproj'))) fail(`PKHeX.Core not found at ${pkhexCore}`)
assertPkhexClean('before build')

const started = Date.now()
const buildMs = run('dotnet', [
  'build', project,
  '-c', 'Release',
  '--artifacts-path', artifacts,
  '--nologo',
  '-v', 'quiet',
  '-clp:NoSummary',
  // Compile in-process instead of leaving a compiler server running in the background.
  '-p:UseSharedCompilation=false'
])
assertPkhexClean('after build')

const dll = join(artifacts, 'bin', 'Pelagix.Extractor', 'release', 'Pelagix.Extractor.dll')
if (!existsSync(dll)) fail(`build succeeded but ${relative(root, dll)} is missing`)

const extractMs = run('dotnet', [dll, outDir])
assertPkhexClean('after extraction')

const missing = OUTPUTS.filter((name) => !existsSync(join(outDir, name)) || statSync(join(outDir, name)).size === 0)
if (missing.length !== 0) fail(`extractor reported success but did not write: ${missing.join(', ')}`)
const stale = OUTPUTS.filter((name) => statSync(join(outDir, name)).mtimeMs < started)
if (stale.length !== 0) fail(`extractor reported success but left these files untouched: ${stale.join(', ')}`)

console.log(
  `[extract] ok: ${OUTPUTS.length} files in ${relative(root, outDir) || outDir} ` +
  `(build ${(buildMs / 1000).toFixed(1)} s, extract ${(extractMs / 1000).toFixed(1)} s); PKHeX tree clean`
)
