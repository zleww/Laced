import type { FormEvent } from 'react'
import { useState } from 'react'
import { Navigate } from 'react-router'
import { Button, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/format'
import type { Role } from '../lib/types'

export function LoginPage() {
  const { session, signIn, signInDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'form' | Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const demo = api.mode === 'demo'

  if (session) return <Navigate to="/" replace />

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
    void run('form', () => signIn(email.trim(), password))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <p className="text-[15px] font-medium tracking-tight text-ink-2">Laced</p>
      <h1 className="mt-1 text-[26px] font-medium tracking-tight">Sign in</h1>

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
        {error && <Notice tone="bad">{error}</Notice>}
        {!demo && (
          <Button type="submit" busy={busy === 'form'}>
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
    </main>
  )
}
