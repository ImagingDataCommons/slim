import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const website = new URL('..', import.meta.url)
const publicDir = new URL('public/', website)
const exists = (path) => existsSync(new URL(path.replace(/^\//, ''), publicDir))

function frontMatterValues(dir, key) {
  const folder = new URL(dir, website)
  return readdirSync(folder)
    .filter((name) => /\.mdx?$/.test(name))
    .flatMap((name) => {
      const match = readFileSync(new URL(name, folder), 'utf8').match(
        new RegExp(`^${key}:\\s*(\\S+)\\s*$`, 'm'),
      )
      return match
        ? [{ name, value: match[1].replace(/^['"]|['"]$/g, '') }]
        : []
    })
}

test('every feature screenshot exists in both themes', () => {
  const missing = frontMatterValues(
    'src/content/features/',
    'screenshot',
  ).flatMap(({ name, value }) =>
    ['dark', 'light']
      .map((theme) => `/screenshots/${value}-${theme}.webp`)
      .filter((path) => !exists(path))
      .map((path) => `${name}: ${path}`),
  )
  assert.deepEqual(
    missing,
    [],
    'Run pnpm capture-screenshots against a local Slim app',
  )
})

test('release highlight images exist', () => {
  const missing = frontMatterValues('src/content/releases/', 'image')
    .filter(({ value }) => !exists(value))
    .map(({ name, value }) => `${name}: ${value}`)
  assert.deepEqual(missing, [])
})

test('every available IDC example has a thumbnail', () => {
  const { examples } = JSON.parse(
    readFileSync(new URL('src/data/idc-examples.json', website), 'utf8'),
  )
  const missing = examples
    .filter(
      (example) => example.available && !exists(`/examples/${example.id}.webp`),
    )
    .map((example) => example.id)
  assert.deepEqual(
    missing,
    [],
    'Run pnpm capture-screenshots against a local Slim app',
  )
})

test('the social card exists', () => {
  assert.ok(exists('/og.png'))
})
