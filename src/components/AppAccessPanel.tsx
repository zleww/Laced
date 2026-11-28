import { useState } from 'react'
import { api } from '../lib/api'
import { formatDate, formatTime, manilaToday } from '../lib/dates'
import { errorMessage } from '../lib/format'
import type { AppAccessCode, Member } from '../lib/types'
import { Sheet } from './Sheet'
import { Button, Card, Notice, SectionTitle } from './ui'

type Props = { member: Member; hasAccount: boolean }

// The desk gives a member a one-time code. They type it into the member app
// to make their own login. The code is shown once and never stored in plain text.
export function AppAccessPanel({ member, hasAccount }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<AppAccessCode | null>(null)
  const [copied, setCopied] = useState(false)

  async function give() {
    setBusy(true)
    setError(null)
    try {
      setIssued(await api.giveAppAccess(member.id))
      setCopied(false)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.code)
      setCopied(true)
    } catch {
      setCopied(false) // The code is on screen, so they can still read it out.
    }
  }

  const until = issued
    ? `${formatDate(manilaToday(new Date(issued.expiresAt)))}, ${formatTime(issued.expiresAt)}`
    : ''

  return (
    <section>
      <SectionTitle>Member app</SectionTitle>
      <Card className="grid gap-3 p-4">
        {hasAccount ? (
          <p className="text-[14px] text-ink-2">{member.fullName} has an app account.</p>
        ) : (
          <>
            <p className="text-[14px] text-ink-2">
              Give {member.fullName} a code. They type it into the member app to make their login.
            </p>
            {error && <Notice tone="bad">{error}</Notice>}
            <Button variant="secondary" busy={busy} onClick={give}>
              Give app access
            </Button>
          </>
        )}
      </Card>

      <Sheet open={issued !== null} title="App access code" onClose={() => setIssued(null)}>
        <div className="grid gap-4">
          <p className="text-[14px] text-ink-2">
            Tell {member.fullName} this code or show them the screen. It works once.
          </p>
          <p className="rounded-card border border-line bg-raised py-6 text-center text-[32px] font-semibold tracking-[0.15em] tabular-nums">
            {issued?.code}
          </p>
          <p className="text-[13px] text-ink-3">Good until {until}. A new code cancels this one.</p>
          <Button onClick={copy}>{copied ? 'Copied' : 'Copy code'}</Button>
          <Button variant="quiet" onClick={() => setIssued(null)}>
            Done
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
