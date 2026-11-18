import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'laced-theme'

function savedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Puts the theme on <html>, where the CSS variables in index.css read it. */
export function applyTheme(theme: Theme = savedTheme()) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#ececee' : '#09090b')
}

/** The current theme and a function to flip it. The choice is remembered on this device. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(savedTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Private browsing can block storage; the theme still applies for this visit.
    }
  }, [theme])

  return [theme, () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))]
}
