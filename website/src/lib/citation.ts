/**
 * Formats the preferred citation of CITATION.cff as BibTeX and APA. Takes the
 * parsed YAML so it stays pure and testable.
 */

export interface CffAuthor {
  'family-names': string
  'given-names'?: string
  orcid?: string
}

export interface CffReference {
  type?: string
  title: string
  authors: CffAuthor[]
  journal?: string
  year?: number | string
  volume?: number | string
  pages?: number | string
  doi?: string
}

export interface Cff {
  'preferred-citation'?: CffReference
  title?: string
  authors?: CffAuthor[]
}

export interface Citation {
  title: string
  authors: string
  journal: string
  year: string
  doi: string
  url: string
  bibtex: string
  apa: string
}

function initials(givenNames: string | undefined): string {
  if (!givenNames) return ''
  return givenNames
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((piece) => `${piece[0]}.`)
    .join(' ')
}

function apaAuthors(authors: CffAuthor[]): string {
  const names = authors.map((author) =>
    [author['family-names'], initials(author['given-names'])]
      .filter(Boolean)
      .join(', '),
  )
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
}

export function formatCitation(cff: Cff): Citation {
  const reference = cff['preferred-citation']
  if (!reference) throw new Error('CITATION.cff has no preferred-citation')

  const year = String(reference.year ?? '')
  const doi = reference.doi ?? ''
  const journal = reference.journal ?? ''
  const firstAuthor = reference.authors[0]?.['family-names'] ?? 'slim'
  const key = `${firstAuthor.toLowerCase()}${year}`

  const bibtex = [
    `@article{${key},`,
    `  title   = {${reference.title}},`,
    `  author  = {${reference.authors
      .map((author) =>
        `${author['family-names']}, ${author['given-names'] ?? ''}`.trim(),
      )
      .join(' and ')}},`,
    `  journal = {${journal}},`,
    reference.volume !== undefined
      ? `  volume  = {${reference.volume}},`
      : null,
    reference.pages !== undefined ? `  pages   = {${reference.pages}},` : null,
    `  year    = {${year}},`,
    `  doi     = {${doi}}`,
    '}',
  ]
    .filter((line) => line !== null)
    .join('\n')

  const volume = reference.volume !== undefined ? `, ${reference.volume}` : ''
  const pages = reference.pages !== undefined ? `, ${reference.pages}` : ''
  const apa = `${apaAuthors(reference.authors)} (${year}). ${reference.title}. ${journal}${volume}${pages}. https://doi.org/${doi}`

  return {
    title: reference.title,
    authors: reference.authors
      .map((author) =>
        `${initials(author['given-names'])} ${author['family-names']}`.trim(),
      )
      .join(', '),
    journal,
    year,
    doi,
    url: `https://doi.org/${doi}`,
    bibtex,
    apa,
  }
}
