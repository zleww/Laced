import { useState } from 'react'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { formatTime } from '../lib/dates'
import { errorMessage } from '../lib/format'
import type { Member } from '../lib/types'
import { DayPassSheet } from '../sheets/DayPassSheet'
import { SellSheet } from '../sheets/SellSheet'
import { StatusBlock } from './status'
import { Button, Field, Notice } from './ui'

type MemberActionsProps = {
  member: Member
  /** Called after anything changes, so the screen can load fresh data. */
  onChanged: () => void
}

// The heart of the desk: one member, one large status, one main button.
//   Active or expiring -> Check in
//   Expired or none    -> Renew / Sell plan (staff cannot let them in)
export function MemberActions({ member, onChanged }: MemberActionsProps) {
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [selling, setSelling] = useState(false)
  const [dayPass, setDayPass] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [reason, setReason] = useState('')

  const canEnter = member.status === 'active' || member.status === 'expiring'

  async function checkIn(overrideReason?: string) {
    setBusy(true)
    setNotice(null)
    try {
      const result = await api.checkIn(member.id, overrideReason)
      setNotice({
        tone: 'good',
        text: result.alreadyCheckedIn
          ? `Already checked in today at ${formatTime(result.checkedInAt)}.`
          : `${member.fullName} is checked in.`,
      })
      setOverriding(false)
      setReason('')
      onChanged()
    } catch (reason) {
      setNotice({ tone: 'bad', text: errorMessage(reason) })
    } finally {
      setBusy(false)
    }
  }

  function sold(text: string) {
    setSelling(false)
    setDayPass(false)
    setNotice({ tone: 'good', text })
    onChanged()
  }

  return (
    <div className="grid gap-3">
      <StatusBlock member={member} />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {canEnter ? (
        <>
          <Button busy={busy} onClick={() => checkIn()}>
            Check in
          </Button>
          <Button variant="secondary" onClick={() => setSelling(true)}>
            Renew early
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => setSelling(true)}>{member.status === 'none' ? 'Sell plan' : 'Renew'}</Button>
          <Button variant="secondary" onClick={() => setDayPass(true)}>
            Day pass
          </Button>
          {session.role === 'owner' && !overriding && (
            <Button variant="quiet" onClick={() => setOverriding(true)}>
              Check in anyway
            </Button>
          )}
          {overriding && (
            <form
              className="grid gap-3 rounded-card border border-line bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault()
                void checkIn(reason)
              }}
            >
              <Field
                label="Reason for letting them in"
                hint="This is saved with the check-in."
                placeholder="Paying tomorrow"
                required
                minLength={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button type="submit" variant="secondary" busy={busy}>
                Check in without a valid plan
              </Button>
            </form>
          )}
        </>
      )}

      <SellSheet member={selling ? member : null} onClose={() => setSelling(false)} onSold={sold} />
      <DayPassSheet open={dayPass} member={member} onClose={() => setDayPass(false)} onSold={sold} />
    </div>
  )
}
