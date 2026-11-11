import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  compareVersionsDesc,
  parseChangelog,
  promoteSectionHeadings,
  summarizeEntry,
} from '../src/lib/changelog.ts'

const sample = `## [0.46.10](https://github.com/x/compare/v0.46.9...v0.46.10) (2026-08-14)


### Bug Fixes

* **ci:** build DMV when using git dependency ([#422](https://github.com/x/issues/422)) ([3589c1a](https://github.com/x/commit/3589c1a))

# [0.46.0](https://github.com/x/compare/v0.45.0...v0.46.0) (2026-07-01)


### Bug Fixes

* first fix ([#1](https://github.com/x/issues/1)) ([aaaaaaa](https://github.com/x/commit/aaaaaaa))
* second fix


### Features

* add a feature ([#2](https://github.com/x/issues/2)) ([bbbbbbb](https://github.com/x/commit/bbbbbbb))

# [0.46.0](https://github.com/x/compare/v0.45.0...v0.46.0) (2026-07-01)

### Features

* duplicate entry
`

test('splits entries newest first and keeps headings out of the body', () => {
  const entries = parseChangelog(sample)
  assert.deepEqual(
    entries.map((entry) => entry.version),
    ['0.46.10', '0.46.0'],
  )
  assert.equal(entries[0].date, '2026-08-14')
  assert.equal(
    entries[0].compareUrl,
    'https://github.com/x/compare/v0.46.9...v0.46.10',
  )
  assert.ok(!entries[0].body.includes('## ['))
})

test('drops repeated versions, keeping the first occurrence', () => {
  const entries = parseChangelog(sample)
  const minor = entries.find((entry) => entry.version === '0.46.0')
  assert.ok(minor)
  assert.ok(!minor.body.includes('duplicate entry'))
})

test('counts features and fixes per section and flags minor releases', () => {
  const [patch, minor] = parseChangelog(sample)
  assert.equal(patch.isMinor, false)
  assert.equal(patch.fixCount, 1)
  assert.equal(patch.featureCount, 0)
  assert.equal(minor.isMinor, true)
  assert.equal(minor.fixCount, 2)
  assert.equal(minor.featureCount, 1)
})

test('summarizes the first bullet without links or commit hashes', () => {
  const [patch] = parseChangelog(sample)
  assert.equal(summarizeEntry(patch), 'ci: build DMV when using git dependency')
})

test('moves section headings up one level and leaves h2 and prose alone', () => {
  const body = '### Bug Fixes\n\n* a ### b\n\n#### Detail\n\n## Kept'
  assert.equal(
    promoteSectionHeadings(body),
    '## Bug Fixes\n\n* a ### b\n\n### Detail\n\n## Kept',
  )
})

test('orders versions numerically, newest first', () => {
  const versions = ['0.46.8', '0.46.10', '0.9.0', '0.46.9', '1.0.0']
  assert.deepEqual(versions.sort(compareVersionsDesc), [
    '1.0.0',
    '0.46.10',
    '0.46.9',
    '0.46.8',
    '0.9.0',
  ])
  assert.equal(compareVersionsDesc('0.46.0', '0.46.0'), 0)
})

test('parses the real changelog without duplicates', () => {
  const markdown = readFileSync(
    new URL('../../docs/CHANGELOG.md', import.meta.url),
    'utf8',
  )
  const entries = parseChangelog(markdown)
  const versions = entries.map((entry) => entry.version)
  assert.ok(entries.length > 30)
  assert.equal(new Set(versions).size, versions.length)
  for (const entry of entries) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/)
  }
})
