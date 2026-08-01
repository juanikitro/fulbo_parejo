export function authErrorMessage(search?: string, hash?: string) {
  const location = typeof window === 'undefined' ? { search: '', hash: '' } : window.location
  const from = (value: string) => new URLSearchParams(value.replace(/^[?#]/, '')).get('error_description')
  return from(search ?? location.search) ?? from(hash ?? location.hash)
}
