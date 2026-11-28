import { describe, expect, it } from 'vitest'
import { checkPassword, createLimiter, loginToEmail, Refusal } from '../../supabase/functions/member-claim/rules'

const domain = 'members.laced.invalid'

describe('loginToEmail', () => {
  it('gives a username a placeholder address', () => {
    expect(loginToEmail('  Juan_Cruz ', domain)).toBe(`juan_cruz@${domain}`)
  })

  it('keeps a real email, lowercased', () => {
    expect(loginToEmail('Juan@Example.com', domain)).toBe('juan@example.com')
  })

  it('refuses bad usernames', () => {
    for (const bad of ['', 'ab', '_ab', 'has space', 'x'.repeat(31), 'a-b-c', 12, null]) {
      expect(() => loginToEmail(bad, domain)).toThrow(Refusal)
    }
  })

  it('refuses bad emails and the placeholder domain', () => {
    for (const bad of ['a@b', '@x.com', 'a b@x.com', `someone@${domain}`]) {
      expect(() => loginToEmail(bad, domain)).toThrow(Refusal)
    }
  })
})

describe('checkPassword', () => {
  it('accepts 10 to 72 characters with letters and numbers', () => {
    expect(checkPassword('gymtime2026')).toBe('gymtime2026')
  })

  it('refuses short, long, and single-kind passwords', () => {
    for (const bad of ['short1', 'x'.repeat(73) + '1', 'onlyletterslong', '1234567890', undefined, 12345678901]) {
      expect(() => checkPassword(bad)).toThrow(Refusal)
    }
  })
})

describe('createLimiter', () => {
  it('blocks after the limit and forgives after the window', () => {
    const limiter = createLimiter(3, 1000)
    for (let i = 0; i < 3; i++) {
      expect(limiter.blocked('a', i)).toBe(false)
      limiter.fail('a', i)
    }
    expect(limiter.blocked('a', 500)).toBe(true)
    expect(limiter.blocked('b', 500)).toBe(false)
    expect(limiter.blocked('a', 1500)).toBe(false)
  })
})
