import { describe, expect, it } from 'vitest'
import { initialRatingValidationMessage, parseInitialRating } from './initialRating'

describe('parseInitialRating', () => {
  it('accepts the inclusive 0–100 boundaries', () => {
    expect(parseInitialRating('0')).toBe(0)
    expect(parseInitialRating('100')).toBe(100)
  })

  it('parses a trimmed initial rating without changing its value', () => {
    expect(parseInitialRating(' 75 ')).toBe(75)
  })

  it('rejects empty, non-numeric, and out-of-range values', () => {
    for (const value of ['', '  ', 'nivel', '-0.01', '100.01']) {
      expect(parseInitialRating(value)).toBeNull()
    }
    expect(initialRatingValidationMessage).toBe('La media inicial debe estar entre 0 y 100.')
  })
})
