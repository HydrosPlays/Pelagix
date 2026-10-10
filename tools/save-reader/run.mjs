// Publishes the game-save reader:  node tools/save-reader/run.mjs  [--untrimmed]
//
// The result is one self-contained executable, tools/save-reader/.artifacts/publish/pelagix-save-reader.exe,
// which electron-builder copies into the installed app (electron-builder.yml, extraResources).
// --untrimmed publishes a second copy without framework trimming into .artifacts/publish-untrimmed, to compare
// the two builds' output with.
//
// The PKHeX tree is a read-only reference. Building through --artifacts-path keeps every bin/obj folder
// (PKHeX.Core's included) under tools/save-reader/.artifacts; this script fails if that ever stops being true.
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const project = join(here, 'Pelagix.SaveReader.csproj')
const artifacts = join(here, '.artifacts')
const pkhexCore = join(root, 'PKHeX', 'PKHeX.Core')
const untrimmed = process.argv.includes('--untrimmed')
const outDir = join(artifacts, untrimmed ? 'publish-untrimmed' : 'publish')
const exe = join(outDir, 'pelagix-save-reader.exe')

function fail(message) {
  console.error(`\n[reader] FAILED: ${message}`)
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
  console.log(`[reader] ${command} ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`)
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
  'publish', project,
  '-c', 'Release',
  '--artifacts-path', artifacts,
  '-o', outDir,
  '--nologo',
  '-v', 'quiet',
  '-clp:NoSummary',
  // Compile in-process instead of leaving a compiler server running in the background.
  '-p:UseSharedCompilation=false',
  ...(untrimmed ? ['-p:PublishTrimmed=false'] : [])
])
assertPkhexClean('after build')

if (!existsSync(exe)) fail(`publish succeeded but ${relative(root, exe)} is missing`)
if (statSync(exe).mtimeMs < started) fail(`publish reported success but left ${relative(root, exe)} untouched`)

// A file that is no save must be turned down with the reader's own error document.
const probe = spawnSync(exe, [project], { encoding: 'utf8', windowsHide: true })
if (probe.status !== 2 || probe.stdout !== '{"ok":false,"error":"not-a-save"}') {
  fail(`the published reader does not answer as expected (exit ${probe.status}, output ${JSON.stringify(probe.stdout)})`)
}

console.log(
  `[reader] ok: ${relative(root, exe)}, ${(statSync(exe).size / 1024 / 1024).toFixed(1)} MB ` +
  `(build ${(buildMs / 1000).toFixed(1)} s); PKHeX tree clean`
)
