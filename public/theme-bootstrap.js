(() => {
  try {
    const preference = localStorage.getItem('fulbo-parejo-theme-preference')
    const theme = preference === 'dark' || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c1510' : '#0d4c36')
  } catch { /* Use the light default when browser storage is unavailable. */ }
})()
