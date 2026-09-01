import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRAVITY_STACK_RULES_VERSION } from '../src/games/gravity-stack/core/engine.ts'
import { BOT_ENGINE_VERSION } from '../server/gravityBot.mjs'

const root = new URL('../dist/', import.meta.url)

async function files(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else if (entry.name !== 'build-info.json') result.push(path)
  }
  return result
}

const rootPath = fileURLToPath(root)
const rows = []
for (const path of await files(rootPath)) {
  const bytes = await readFile(path)
  rows.push(`${relative(rootPath, path).replaceAll('\\', '/')}\t${(await stat(path)).size}\t${createHash('sha256').update(bytes).digest('hex')}`)
}
const artifactManifestSha256 = createHash('sha256').update(rows.sort().join('\n')).digest('hex')
const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const buildInfo = {
  gitSha,
  builtAt: new Date().toISOString(),
  rulesVersion: GRAVITY_STACK_RULES_VERSION,
  botEngineVersion: BOT_ENGINE_VERSION,
  artifactManifestSha256,
}
await writeFile(new URL('build-info.json', root), `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8')
console.log(`Arcade build provenance ${gitSha.slice(0, 12)} ${artifactManifestSha256}`)
