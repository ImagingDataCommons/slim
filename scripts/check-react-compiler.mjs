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

const bailouts = []
const optOuts = []
let compiled = 0

for (const file of files) {
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
        compiled += 1
        return
      }
      if (
        event.kind !== 'CompileError' &&
        event.kind !== 'CompileDiagnostic' &&
        event.kind !== 'PipelineError'
      ) {
        return
      }
      const { loc, reason } = describe(event)
      const entry = { file, line: loc?.start.line, reason }
      if (event.fnLoc != null && optedOut.has(locKey(event.fnLoc))) {
        optOuts.push(entry)
      } else {
        bailouts.push(entry)
      }
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
}

const print = ({ file, line, reason }) => `  ${file}:${line ?? '?'}  ${reason}`

if (optOuts.length > 0) {
  console.log(`Opted out with 'use no memo' (${optOuts.length}):`)
  console.log(optOuts.map(print).join('\n'))
}

if (bailouts.length > 0) {
  console.error(`React Compiler bailed out (${bailouts.length}):`)
  console.error(bailouts.map(print).join('\n'))
  process.exit(1)
}

console.log(
  `React Compiler: ${compiled} components/hooks compiled in ${files.length} files, no bailouts.`,
)
