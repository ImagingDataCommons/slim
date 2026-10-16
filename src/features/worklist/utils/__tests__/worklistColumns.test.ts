import { describe, expect, it } from 'vitest'

import {
  isWorklistColumnId,
  sanitizeHiddenColumnIds,
  WORKLIST_LOCKED_COLUMN_ID,
} from '../worklistColumns'

describe('sanitizeHiddenColumnIds', () => {
  it('keeps known optional ids and drops the rest', () => {
    expect(
      sanitizeHiddenColumnIds([
        'AccessionNumber',
        WORKLIST_LOCKED_COLUMN_ID,
        'nope',
        'AccessionNumber',
        12,
        'StudyID',
      ]),
    ).toEqual(['AccessionNumber', 'StudyID'])
  })
})

describe('isWorklistColumnId', () => {
  it('recognizes known ids', () => {
    expect(isWorklistColumnId('PatientName')).toBe(true)
    expect(isWorklistColumnId('Patient')).toBe(false)
  })
})
