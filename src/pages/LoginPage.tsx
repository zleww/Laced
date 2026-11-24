import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { clearFailures, minutesText, recordFailure, triesLeft, waitLeft } from '../lib/signInGuard'
import { useLoad } from '../lib/useLoad'
import { Button, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/format'
import type { Role } from '../lib/types'

// The public marketing site, if one is set for this deploy.
const marketingUrl = import.meta.env.VITE_MARKETING_URL?.trim() || null

export function LoginPage() {
  const { session, signIn, signInDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'form' | Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const demo = api.mode === 'demo'
  const limits = useLoad(() => api.signInLimits(), [])
  // Re-check the wait every few seconds so the button comes back on its own.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [])
  const waiting = waitLeft(now)

  if (session && !session.needsCode) return <Navigate to="/" replace />
  if (session?.needsCode) return <CodeStep name={session.fullName} />

  async function run(which: 'form' | Role, action: () => Promise<void>) {
    setBusy(which)
    setError(null)
    try {
      await action()
    } catch (reason) {
      setError(errorMessage(reason))
      setBusy(null)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (waitLeft() > 0) {
      setError(`Too many wrong passwords. Try again in ${minutesText(waitLeft())}.`)
      return
    }
    void run('form', async () => {
      try {
        await signIn(email.trim(), password)
        clearFailures()
      } catch (reason) {
        if (errorMessage(reason) !== 'Wrong email or password.') throw reason
        const { maxTries, waitMinutes } = limits.data ?? { maxTries: 5, waitMinutes: 10 }
        if (recordFailure(maxTries, waitMinutes)) {
          setNow(Date.now())
          throw new Error(`Too many wrong passwords. Try again in ${waitMinutes} minutes.`)
        }
        const left = triesLeft(maxTries)
        throw new Error(
          `Wrong email or password. ${left} ${left === 1 ? 'try' : 'tries'} left before a ${waitMinutes}-minute wait.`,
        )
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link to="/" className="w-fit text-[20px] font-semibold tracking-tight">
        Laced
      </Link>
      <h1 className="mt-5 text-[30px] font-semibold tracking-tight">Sign in</h1>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <fieldset disabled={demo} className="grid gap-4">
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </fieldset>
        {waiting > 0 ? (
          <Notice tone="bad">Too many wrong passwords. Try again in {minutesText(waiting)}.</Notice>
        ) : (
          error && <Notice tone="bad">{error}</Notice>
        )}
        {!demo && (
          <Button type="submit" busy={busy === 'form'} disabled={waiting > 0}>
            Sign in
          </Button>
        )}
      </form>

      {demo ? (
        <section className="mt-6 border-t border-line pt-6">
          <h2 className="text-[15px] font-medium">Demo mode</h2>
          <p className="mt-1 text-[14px] text-ink-2">
            No database is connected, so sign-in is off. Explore with sample data instead. Changes reset when
            the page reloads.
          </p>
          <div className="mt-4 grid gap-2">
            <Button busy={busy === 'owner'} disabled={busy !== null} onClick={() => run('owner', () => signInDemo('owner'))}>
              Enter as owner
            </Button>
            <Button
              variant="secondary"
              busy={busy === 'staff'}
              disabled={busy !== null}
              onClick={() => run('staff', () => signInDemo('staff'))}
            >
              Enter as staff
            </Button>
          </div>
        </section>
      ) : (
        <p className="mt-6 text-[13px] text-ink-2">Accounts are created by the owner. Ask them if you need access.</p>
      )}
      {marketingUrl && (
        <a href={marketingUrl} className="mt-8 w-fit text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          New to Laced? See what it does
        </a>
      )}
    </main>
  )
}

/** The second step for accounts with an authenticator app: the 6-digit code. */
function CodeStep({ name }: { name: string }) {
  const { verifyCode, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyCode(code)
    } catch (reason) {
      setError(errorMessage(reason))
      setCode('')
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <p className="text-[20px] font-semibold tracking-tight">Laced</p>
      <h1 className="mt-5 text-[30px] font-semibold tracking-tight">Enter your code</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        Hi {name}. Open your authenticator app and type the 6-digit code for Laced.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          required
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" busy={busy} disabled={code.length !== 6}>
          Continue
        </Button>
      </form>
      <button type="button" onClick={signOut} className="mt-4 min-h-11 w-fit text-[14px] text-ink-2 hover:text-ink">
        Use a different account
      </button>
    </main>
  )
}
