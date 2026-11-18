import type { FormEvent } from 'react'
import { useState } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/format'
import type { SignInLimits } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { Panel } from './panels'
import { Button, Field, Loading, Notice } from './ui'

// Owner only: how many wrong passwords the sign-in screen allows on a device
// before it asks the person to wait.
export function SignInLimitsPanel() {
  const limits = useLoad(() => api.signInLimits(), [])
  return (
    <Panel title="Wrong passwords">
      {limits.error && <Notice tone="bad">{limits.error}</Notice>}
      {limits.data ? <LimitsForm key={JSON.stringify(limits.data)} saved={limits.data} /> : !limits.error && <Loading />}
    </Panel>
  )
}

function LimitsForm({ saved }: { saved: SignInLimits }) {
  const [tries, setTries] = useState(String(saved.maxTries))
  const [minutes, setMinutes] = useState(String(saved.waitMinutes))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const maxTries = Number(tries)
    const waitMinutes = Number(minutes)
    if (!Number.isInteger(maxTries) || maxTries < 3 || maxTries > 20) {
      setMessage({ tone: 'bad', text: 'Allow between 3 and 20 tries.' })
      return
    }
    if (!Number.isInteger(waitMinutes) || waitMinutes < 1 || waitMinutes > 120) {
      setMessage({ tone: 'bad', text: 'Set a wait between 1 and 120 minutes.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await api.saveSignInLimits({ maxTries, waitMinutes })
      setMessage({ tone: 'good', text: `Saved: ${maxTries} tries, then a ${waitMinutes}-minute wait.` })
    } catch (cause) {
      setMessage({ tone: 'bad', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-[14px] text-ink-2">
        After this many wrong passwords on a phone or computer, the sign-in screen asks the person to wait. The account
        itself is never locked. Two-step sign-in is what stops someone who guesses a password.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Wrong tries allowed"
          type="number"
          inputMode="numeric"
          min={3}
          max={20}
          required
          value={tries}
          onChange={(event) => setTries(event.target.value)}
        />
        <Field
          label="Wait (minutes)"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          required
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" className="md:w-auto md:px-5" busy={busy}>
        Save
      </Button>
    </form>
  )
}
