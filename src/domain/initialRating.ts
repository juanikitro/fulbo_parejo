export const initialRatingValidationMessage = 'La media inicial debe estar entre 0 y 100.'

export const parseInitialRating = (value: string): number | null => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  const rating = Number(trimmedValue)
  return Number.isFinite(rating) && rating >= 0 && rating <= 100 ? rating : null
}
