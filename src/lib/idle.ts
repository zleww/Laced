import { useEffect } from 'react'

// The desk phone is shared and often left on the counter. After this long with
// no taps or typing, the app signs out so the next person has to sign in.
const IDLE_LIMIT_MS = 15 * 60 * 1000
const CHECK_EVERY_MS = 30 * 1000

export function useIdleSignOut(signedIn: boolean, signOut: () => Promise<void>) {
  useEffect(() => {
    if (!signedIn) return
    let lastActive = Date.now()
    const touch = () => {
      lastActive = Date.now()
    }
    // Phones pause timers when the screen is off, so also check when the app comes back.
    const check = () => {
      if (Date.now() - lastActive >= IDLE_LIMIT_MS) void signOut()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    return () => {
      events.forEach((name) => window.removeEventListener(name, touch))
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [signedIn, signOut])
}
