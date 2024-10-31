import { formatDicomDate } from '../formatDicomDate'

describe('formatDicomDate', () => {
  describe('valid dates', () => {
    it('should format a basic date correctly', () => {
      expect(formatDicomDate('20240101:120000')).toBe('Mon, Jan 1 2024')
    })

    it('should handle end of months correctly', () => {
      expect(formatDicomDate('20240131:120000')).toBe('Wed, Jan 31 2024')
      expect(formatDicomDate('20240229:120000')).toBe('Thu, Feb 29 2024')
      expect(formatDicomDate('20240331:120000')).toBe('Sun, Mar 31 2024')
      expect(formatDicomDate('20240430:120000')).toBe('Tue, Apr 30 2024')
    })
  })

  describe('invalid dates', () => {
    it('should return original string for malformed input', () => {
      expect(formatDicomDate('invalid')).toBe('invalid')
      expect(formatDicomDate('')).toBe('')
      expect(formatDicomDate('20240101')).toBe('20240101')
    })

    it('should return original string for invalid dates', () => {
      expect(formatDicomDate('20240231:120000')).toBe('20240231:120000') // Feb 31
      expect(formatDicomDate('20240431:120000')).toBe('20240431:120000') // Apr 31
    })

    it('should return original string for out of range values', () => {
      expect(formatDicomDate('20241301:120000')).toBe('20241301:120000') // month 13
      expect(formatDicomDate('20240132:120000')).toBe('20240132:120000') // day 32
    })
  })

  describe('time handling', () => {
    it('should handle different times for the same date', () => {
      expect(formatDicomDate('20240101:000000')).toBe('Mon, Jan 1 2024')
      expect(formatDicomDate('20240101:235959')).toBe('Mon, Jan 1 2024')
      expect(formatDicomDate('20240101:120000')).toBe('Mon, Jan 1 2024')
    })
  })
})
