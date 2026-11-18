import { useState } from 'react'
import { SearchIcon } from '../components/icons'
import { MemberActions } from '../components/MemberActions'
import { Avatar, MemberRow } from '../components/MemberRow'
import { Button, Card, Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import type { Member } from '../lib/types'
import { useDebounced, useLoad } from '../lib/useLoad'
import { DayPassSheet } from '../sheets/DayPassSheet'

export function CheckInPage() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [guestPass, setGuestPass] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const term = useDebounced(query.trim())
  const results = useLoad(() => (term ? api.searchMembers(term) : Promise.resolve<Member[]>([])), [term])
  const selected = useLoad(
    () => (selectedId ? api.getMember(selectedId) : Promise.resolve(null)),
    [selectedId],
  )

  function reset() {
    setSelectedId(null)
    setQuery('')
  }

  // A member is picked: show their status and the one main action.
  if (selectedId) {
    const member = selected.data?.member
    return (
      <div className="grid gap-4">
        {!member ? (
          selected.error ? <Notice tone="bad">{selected.error}</Notice> : <Loading />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={member.fullName} large />
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">{member.fullName}</h1>
                <p className="text-[14px] tabular-nums text-ink-2">{member.phone}</p>
              </div>
            </div>
            <MemberActions member={member} onChanged={selected.reload} />
          </>
        )}
        <Button variant="quiet" onClick={reset}>
          Next member
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-[26px] font-semibold tracking-tight">Check in</h1>

      <label className="relative block">
        <span className="sr-only">Search by name or mobile number</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          autoFocus
          autoComplete="off"
          placeholder="Name or mobile number"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="block min-h-13 w-full rounded-control border border-line bg-card pr-3.5 pl-11 text-base text-ink placeholder:text-ink-3"
        />
      </label>

      {notice && <Notice tone="good">{notice}</Notice>}
      {results.error && <Notice tone="bad">{results.error}</Notice>}

      {term && !results.error && results.data && !results.loading && results.data.length === 0 && (
        <Card className="p-4">
          <p className="text-[14px] text-ink-2">
            No member matches “{term}”. Check the spelling, or register them from the Members tab.
          </p>
        </Card>
      )}

      {term && results.data && results.data.length > 0 && (
        <Card className={`divide-y divide-line transition-opacity ${results.loading ? 'opacity-60' : ''}`}>
          {results.data.slice(0, 8).map((member) => (
            <MemberRow key={member.id} member={member} onSelect={() => setSelectedId(member.id)} />
          ))}
        </Card>
      )}

      {!term && (
        <div className="grid gap-3">
          <p className="text-[14px] text-ink-2">Search for a member, or sell a day pass to a walk-in.</p>
          <Button variant="secondary" onClick={() => setGuestPass(true)}>
            Day pass for a walk-in
          </Button>
        </div>
      )}

      <DayPassSheet
        open={guestPass}
        onClose={() => setGuestPass(false)}
        onSold={(text) => {
          setGuestPass(false)
          setNotice(text)
        }}
      />
    </div>
  )
}
