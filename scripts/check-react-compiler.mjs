#!/usr/bin/env node
/**
 * Runs babel-plugin-react-compiler over every component and hook in src/ and
 * exits non-zero when the compiler bails out on any of them. A bailout means
 * the function breaks a Rule of React (refs read during render, mutated
 * props or state, conditional hooks, ...) and ships without memoization.
 *
 * Functions that opt out with a 'use no memo' directive are listed but do not
 * fail the check; the directive must carry a comment explaining why.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import babel from '@babel/core'

const OPT_OUT_DIRECTIVES = new Set(['use no memo', 'use no forget'])

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isTestFile = (file) =>
  /(^|\/)(__tests__|__mocks__|testing)\//.test(file) ||
  /\.test\.tsx?$/.test(file)

const files = fs
  .globSync(['src/**/*.tsx', 'src/**/use*.ts'], { cwd: root })
  .filter((file) => !isTestFile(file))
  .sort()

const locKey = (loc) => `${loc.start.line}:${loc.start.column}`

/** `line:column` of every function whose body opts out of the compiler */
function findOptedOutFunctions(ast) {
  const optedOut = new Set()
  babel.traverse(ast, {
    Function(fnPath) {
      const { body, loc } = fnPath.node
      if (
        loc != null &&
        body.type === 'BlockStatement' &&
        body.directives.some((d) => OPT_OUT_DIRECTIVES.has(d.value.value))
      ) {
        optedOut.add(locKey(loc))
      }
    },
  })
  return optedOut
}

function describe(event) {
  if (event.kind === 'PipelineError') {
    return { loc: event.fnLoc, reason: event.data }
  }
  const { detail } = event
  const loc =
    (typeof detail.primaryLocation === 'function'
      ? detail.primaryLocation()
      : detail.loc) ?? event.fnLoc
  const description = detail.description ? ` ${detail.description}` : ''
  return { loc, reason: `${detail.reason}${description}` }
}

const COMPILER_PROBLEMS = new Set([
  'CompileError',
  'CompileDiagnostic',
  'PipelineError',
])

/** Compile one file and sort its compiler events into results */
function checkFile(file) {
  const result = { compiled: 0, bailouts: [], optOuts: [] }
  const filename = path.join(root, file)
  const code = fs.readFileSync(filename, 'utf8')
  const ast = babel.parseSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: {
      plugins: file.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    },
  })
  const optedOut = findOptedOutFunctions(ast)

  const logger = {
    logEvent(_filename, event) {
      if (event.kind === 'CompileSuccess') {
        result.compiled += 1
        return
      }
      if (!COMPILER_PROBLEMS.has(event.kind)) {
        return
      }
      const { loc, reason } = describe(event)
      const entry = { file, line: loc?.start.line, reason }
      const isOptOut = event.fnLoc != null && optedOut.has(locKey(event.fnLoc))
      ;(isOptOut ? result.optOuts : result.bailouts).push(entry)
    },
  }

  babel.transformFromAstSync(ast, code, {
    babelrc: false,
    configFile: false,
    filename,
    code: false,
    plugins: [
      ['babel-plugin-react-compiler', { panicThreshold: 'none', logger }],
    ],
  })
  return result
}

const results = files.map(checkFile)
const compiled = results.reduce((sum, result) => sum + result.compiled, 0)
const bailouts = results.flatMap((result) => result.bailouts)
const optOuts = results.flatMap((result) => result.optOuts)

const print = ({ file, line, reason }) => `  ${file}:${line ?? '?'}  ${reason}`
const writeLines = (stream, lines) => stream.write(`${lines.join('\n')}\n`)

if (optOuts.length > 0) {
  writeLines(process.stdout, [
    `Opted out with 'use no memo' (${optOuts.length}):`,
    ...optOuts.map(print),
  ])
}

if (bailouts.length > 0) {
  writeLines(process.stderr, [
    `React Compiler bailed out (${bailouts.length}):`,
    ...bailouts.map(print),
  ])
  process.exit(1)
}

writeLines(process.stdout, [
  `React Compiler: ${compiled} components/hooks compiled in ${files.length} files, no bailouts.`,
])
