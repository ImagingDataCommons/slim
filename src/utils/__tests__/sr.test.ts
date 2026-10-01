/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'

import { findContentItemsByName, hasValueType } from '../sr'

type ContentItem = dcmjs.sr.valueTypes.ContentItem

function item(
  CodeValue: string,
  CodingSchemeDesignator: string,
  ValueType = 'TEXT',
): ContentItem {
  return {
    ValueType,
    ConceptNameCodeSequence: [
      { CodeValue, CodingSchemeDesignator, CodeMeaning: CodeValue },
    ],
  } as ContentItem
}

describe('findContentItemsByName', () => {
  const finding = item('121071', 'DCM', 'CODE')
  const otherScheme = item('121071', 'SCT')
  const nested = {
    ...item('125007', 'DCM', 'CONTAINER'),
    ContentSequence: [item('121071', 'DCM')],
  } as ContentItem
  const content = [finding, otherScheme, nested, item('121071', 'DCM')]

  it('matches scheme and value, ignoring the meaning', () => {
    expect(
      findContentItemsByName({
        content,
        name: {
          CodeValue: '121071',
          CodingSchemeDesignator: 'DCM',
          CodeMeaning: 'Other meaning',
        },
      }),
    ).toEqual([finding, content[3]])
  })

  it('does not search nested content', () => {
    expect(
      findContentItemsByName({
        content: [nested],
        name: { CodeValue: '121071', CodingSchemeDesignator: 'DCM' },
      }),
    ).toEqual([])
  })

  it('returns an empty list when nothing matches', () => {
    expect(
      findContentItemsByName({
        content: [],
        name: { CodeValue: '1', CodingSchemeDesignator: 'DCM' },
      }),
    ).toEqual([])
  })
})

describe('hasValueType', () => {
  it('compares the value type', () => {
    expect(hasValueType(item('1', 'DCM', 'NUM'), 'NUM')).toBe(true)
    expect(hasValueType(item('1', 'DCM', 'NUM'), 'CODE')).toBe(false)
  })
})
