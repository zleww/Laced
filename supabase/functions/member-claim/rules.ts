// Plain rules for the member-claim function. No server code lives here, so
// the tests can run it.

export class Refusal extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[a-z0-9][a-z0-9._]{2,29}$/

/**
 * Turns what the member typed into the email Supabase signs in with.
 * A real email stays as it is. A username gets a placeholder address on a
 * domain that never receives mail.
 */
export function loginToEmail(login: unknown, domain: string): string {
  const value = typeof login === 'string' ? login.trim().toLowerCase() : ''
  if (value.includes('@')) {
    if (!emailPattern.test(value) || value.length > 120 || value.endsWith(`@${domain}`)) {
      throw new Refusal('Enter a valid email address.')
    }
    return value
  }
  if (!usernamePattern.test(value)) {
    throw new Refusal('Use 3 to 30 letters, numbers, dots or underscores for the username.')
  }
  return `${value}@${domain}`
}

export function checkPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 10) {
    throw new Refusal('Use a password of at least 10 characters.')
  }
  if (password.length > 72) throw new Refusal('Use a password of at most 72 characters.')
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Refusal('Use letters and numbers in the password.')
  }
  return password
}

/** Counts wrong tries per key in memory. A speed bump, not a lock. */
export function createLimiter(max: number, windowMs: number) {
  const tries = new Map<string, number[]>()

  const recent = (key: string, now: number) => {
    const list = (tries.get(key) ?? []).filter((time) => now - time < windowMs)
    if (list.length > 0) tries.set(key, list)
    else tries.delete(key)
    return list
  }

  return {
    blocked: (key: string, now = Date.now()) => recent(key, now).length >= max,
    fail: (key: string, now = Date.now()) => {
      tries.set(key, [...recent(key, now), now])
    },
  }
}
