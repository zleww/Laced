import type { FormEvent } from 'react'
import { useState } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/format'
import type { TwoStepSetup } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { CheckIcon } from './icons'
import { Panel, smallButton } from './panels'
import { Button, Field, Loading, Notice } from './ui'

// Two-step sign-in for the signed-in account: after the password, a 6-digit code
// from an authenticator app (Google Authenticator, Microsoft Authenticator, and others).
// With it on, a stolen password alone can't open the gym's records.
export function TwoStepPanel() {
  const [version, setVersion] = useState(0)
  const status = useLoad(() => api.twoStepStatus(), [version])
  const [setup, setSetup] = useState<TwoStepSetup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
    } catch (cause) {
      setMessage({ tone: 'bad', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  function confirm(event: FormEvent) {
    event.preventDefault()
    void act(async () => {
      await api.confirmTwoStep(setup!.factorId, code)
      setSetup(null)
      setCode('')
      setMessage({ tone: 'good', text: 'Two-step sign-in is on. You will be asked for a code each time you sign in.' })
      setVersion((value) => value + 1)
    })
  }

  return (
    <Panel title="Two-step sign-in">
      {message && (
        <div className="mb-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {status.error && <Notice tone="bad">{status.error}</Notice>}
      {!status.data ? (
        !status.error && <Loading />
      ) : status.data.on ? (
        <div className="grid gap-3">
          <p className="inline-flex items-center gap-2 text-[14px] font-medium text-good">
            <CheckIcon /> On for this account
          </p>
          <p className="text-[14px] text-ink-2">
            Signing in needs your password and a code from your authenticator app. If you get a new phone, turn this off on
            the old one first, then turn it on again.
          </p>
          {confirmOff ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${smallButton} text-bad`}
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api.turnOffTwoStep()
                    setConfirmOff(false)
                    setMessage({ tone: 'good', text: 'Two-step sign-in is off. Only the password is needed now.' })
                    setVersion((value) => value + 1)
                  })
                }
              >
                {busy ? 'Turning off…' : 'Yes, turn it off'}
              </button>
              <button type="button" className={smallButton} onClick={() => setConfirmOff(false)}>
                Keep it on
              </button>
            </div>
          ) : (
            <button type="button" className={`${smallButton} w-fit`} onClick={() => setConfirmOff(true)}>
              Turn off
            </button>
          )}
        </div>
      ) : setup ? (
        <form onSubmit={confirm} className="grid gap-4">
          <ol className="grid list-decimal gap-1 pl-5 text-[14px] text-ink-2">
            <li>Open an authenticator app on your phone, such as Google Authenticator.</li>
            <li>Add an account and scan this QR code.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <img
            src={setup.qrCode}
            alt="QR code for adding Laced to an authenticator app"
            className="size-48 rounded-control bg-white p-2"
          />
          <p className="text-[13px] text-ink-3">
            Can't scan? Enter this key in the app instead:{' '}
            <span className="break-all font-mono text-ink">{setup.secret}</span>
          </p>
          <Field
            label="Code from the app"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="md:w-auto md:px-5" busy={busy} disabled={code.length !== 6}>
              Turn on
            </Button>
            <Button variant="secondary" className="md:w-auto md:px-5" onClick={() => setSetup(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-3">
          <p className="text-[14px] text-ink-2">
            Off. With it on, signing in also needs a 6-digit code from an app on your phone, so a stolen password alone
            can't open the gym's money, payroll, or member records.
          </p>
          <Button className="md:w-auto md:px-5" busy={busy} onClick={() => act(async () => setSetup(await api.startTwoStep()))}>
            Set up two-step sign-in
          </Button>
        </div>
      )}
    </Panel>
  )
}
