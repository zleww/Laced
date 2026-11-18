// Counts wrong passwords on this device. After the owner's limit, the sign-in
// screen asks the person to wait before trying again.
//
// This is a speed bump for people at the desk, not a lock: it lives in this
// browser only. Real protection against guessing is two-step sign-in and
// Supabase's own rate limit on its sign-in server.

const KEY = 'laced-sign-in-tries'

type State = { fails: number; waitUntil: number | null }

function read(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '')
    if (typeof saved?.fails === 'number') return saved
  } catch {
    // Storage blocked or empty: start fresh.
  }
  return { fails: 0, waitUntil: null }
}

function write(state: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private mode or blocked storage: the speed bump simply does not apply.
  }
}

/** Milliseconds left to wait, or 0 when trying is allowed. */
export function waitLeft(now = Date.now()): number {
  const { waitUntil } = read()
  return waitUntil && waitUntil > now ? waitUntil - now : 0
}

/** Records a wrong password. Returns true when this one started a wait. */
export function recordFailure(maxTries: number, waitMinutes: number, now = Date.now()): boolean {
  const state = read()
  const fails = (state.waitUntil && state.waitUntil <= now ? 0 : state.fails) + 1
  if (fails >= maxTries) {
    write({ fails: 0, waitUntil: now + waitMinutes * 60_000 })
    return true
  }
  write({ fails, waitUntil: null })
  return false
}

/** Tries left before a wait, for a gentle warning. */
export function triesLeft(maxTries: number): number {
  return Math.max(maxTries - read().fails, 0)
}

export function clearFailures() {
  write({ fails: 0, waitUntil: null })
}

/** "10 minutes", "1 minute" */
export function minutesText(milliseconds: number): string {
  const minutes = Math.max(Math.ceil(milliseconds / 60_000), 1)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}
