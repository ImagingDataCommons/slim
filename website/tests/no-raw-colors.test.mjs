import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const websiteRoot = fileURLToPath(new URL('..', import.meta.url))
const srcRoot = join(websiteRoot, 'src')
const tokensPath = join(websiteRoot, '..', 'src', 'styles', 'tokens.css')

/** The only file allowed to hold colour literals (theme-color meta values) */
const THEME_FILE = join(srcRoot, 'data', 'theme.ts')

const SOURCE_EXTENSIONS = /\.(astro|tsx?|jsx?|mjs|css|mdx?)$/

/**
 * Hex colours (#abc, #aabbcc, #aabbccdd) and rgb()/hsl()/oklch() calls with
 * literal numbers. `rgb(var(--token) / 0.2)` is allowed: it reads a token.
 */
const RAW_COLOR =
  /#[0-9a-fA-F]{3,8}\b(?![-\w])|\b(?:rgba?|hsla?|oklch|oklab)\(\s*(?!var\()[\d.]/g

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return listFiles(path)
    return SOURCE_EXTENSIONS.test(name) ? [path] : []
  })
}

/** Strips URL fragments such as href="#cite" so they are not read as colours */
function withoutFragments(line) {
  return line.replace(/(href|to|id)=["'{`]#[\w-]+/g, '$1=')
}

/** Markdown prose refers to issues and PRs as #451, which reads like a hex colour */
function withoutIssueRefs(line) {
  return line.replace(/(^|[\s([])#\d+\b/g, '$1')
}

test('website sources take every colour from the shared tokens', () => {
  const offenders = []
  for (const file of listFiles(srcRoot)) {
    if (file === THEME_FILE) continue
    const isMarkdown = /\.mdx?$/.test(file)
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const cleaned = withoutFragments(
        isMarkdown ? withoutIssueRefs(line) : line,
      )
      const matches = cleaned.match(RAW_COLOR)
      if (matches) {
        offenders.push(
          `${relative(websiteRoot, file)}:${index + 1} ${matches.join(', ')}`,
        )
      }
    })
  }
  assert.deepEqual(
    offenders,
    [],
    `Raw colour literals found:\n${offenders.join('\n')}`,
  )
})

test('theme-color values match the --app token of each theme', () => {
  const tokens = readFileSync(tokensPath, 'utf8')
  const theme = readFileSync(THEME_FILE, 'utf8')

  const appToken = (selector) => {
    const block = tokens.slice(tokens.indexOf(`${selector} {`))
    const match = block.match(/--app:\s*(\d+)\s+(\d+)\s+(\d+)/)
    assert.ok(match, `--app not found under ${selector}`)
    return `#${match
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`
  }
  const themeColor = (key) =>
    theme.match(new RegExp(`${key}:\\s*'(#[0-9a-f]{6})'`))?.[1]

  assert.equal(themeColor('dark'), appToken('.dark'))
  assert.equal(themeColor('light'), appToken(':root'))
})
