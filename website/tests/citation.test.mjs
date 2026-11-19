import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from 'yaml'

import { formatCitation } from '../src/lib/citation.ts'

const cff = parse(
  readFileSync(new URL('../../CITATION.cff', import.meta.url), 'utf8'),
)

test('builds a BibTeX entry from the preferred citation', () => {
  const { bibtex } = formatCitation(cff)
  assert.match(bibtex, /^@article\{gorman2023,/)
  assert.match(bibtex, /doi\s+= \{10\.1038\/s41467-023-37224-2\}/)
  assert.match(bibtex, /author\s+= \{Gorman, Chris and Punzo, Davide/)
  assert.match(bibtex, /volume\s+= \{14\}/)
})

test('builds an APA reference with initials and an ampersand before the last author', () => {
  const { apa } = formatCitation(cff)
  assert.ok(apa.startsWith('Gorman, C., Punzo, D., Octaviano, I.'))
  assert.match(apa, /, & Herrmann, M\. D\. \(2023\)\./)
  assert.match(apa, /Longabaugh, W\. J\. R\.,/)
  assert.ok(
    apa.endsWith(
      'Nat Commun, 14, 1572. https://doi.org/10.1038/s41467-023-37224-2',
    ),
  )
})

test('fails loudly when there is no preferred citation', () => {
  assert.throws(() => formatCitation({ title: 'x' }), /preferred-citation/)
})
