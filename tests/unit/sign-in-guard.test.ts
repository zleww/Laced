import { beforeEach, describe, expect, it } from 'vitest'
import { clearFailures, minutesText, recordFailure, triesLeft, waitLeft } from '../../src/lib/signInGuard'

// A stand-in for the browser's localStorage, which Node does not have.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

describe('wrong-password wait', () => {
  beforeEach(() => store.clear())

  it('starts a wait on the fifth wrong password', () => {
    const start = 1_000_000
    for (let i = 1; i <= 4; i++) expect(recordFailure(5, 10, start)).toBe(false)
    expect(triesLeft(5)).toBe(1)
    expect(recordFailure(5, 10, start)).toBe(true)
    expect(waitLeft(start)).toBe(10 * 60_000)
    expect(minutesText(waitLeft(start + 30_000))).toBe('10 minutes')
  })

  it('ends the wait after the time is up and counts afresh', () => {
    const start = 2_000_000
    for (let i = 0; i < 5; i++) recordFailure(5, 10, start)
    const later = start + 10 * 60_000 + 1
    expect(waitLeft(later)).toBe(0)
    expect(recordFailure(5, 10, later)).toBe(false)
    expect(triesLeft(5)).toBe(4)
  })

  it('forgets the count after a successful sign-in', () => {
    recordFailure(5, 10)
    recordFailure(5, 10)
    clearFailures()
    expect(triesLeft(5)).toBe(5)
    expect(minutesText(30_000)).toBe('1 minute')
  })
})
