import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** localStorage key. Keep in sync with the inline script in index.html. */
export const THEME_STORAGE_KEY = 'theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (private mode, blocked cookies): the choice just
    // won't persist across reloads.
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

const listeners = new Set<() => void>()

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  // Follow OS changes live, but only while the user hasn't chosen explicitly.
  const media = window.matchMedia(DARK_QUERY)
  const onSystemChange = () => {
    if (readStoredTheme() === null) applyTheme(systemTheme())
  }
  // Keep tabs in sync when the choice changes in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(readStoredTheme() ?? systemTheme())
    }
  }

  media.addEventListener('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Current resolved theme plus a setter that applies and remembers an explicit
 * choice. The initial value comes from <html data-theme>, which the inline
 * script in index.html sets before first paint (stored choice, else OS).
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as Theme)

  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next)
    applyTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
