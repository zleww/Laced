import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PlusIcon, SearchIcon } from '../components/icons'
import { MemberRow } from '../components/MemberRow'
import { Card, Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useDebounced, useLoad } from '../lib/useLoad'
import { RegisterSheet } from '../sheets/RegisterSheet'

export function MembersPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [registering, setRegistering] = useState(false)
  const term = useDebounced(query.trim())
  const members = useLoad(() => api.searchMembers(term), [term])

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-semibold tracking-tight">Members</h1>
        <button
          type="button"
          onClick={() => setRegistering(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[14px] font-medium"
        >
          <PlusIcon />
          Register
        </button>
      </div>

      <label className="relative block">
        <span className="sr-only">Search by name or mobile number</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          autoComplete="off"
          placeholder="Name or mobile number"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="block min-h-12 w-full rounded-control border border-line bg-card pr-3.5 pl-11 text-base text-ink placeholder:text-ink-3"
        />
      </label>

      {members.error && <Notice tone="bad">{members.error}</Notice>}
      {!members.data && !members.error && <Loading />}

      {!members.error && members.data && members.data.length === 0 && (
        <Card className="p-4">
          <p className="text-[14px] text-ink-2">
            {term ? `No member matches “${term}”.` : 'No members yet. Register the first one.'}
          </p>
        </Card>
      )}

      {members.data && members.data.length > 0 && (
        <Card className={`divide-y divide-line transition-opacity ${members.loading ? 'opacity-60' : ''}`}>
          {members.data.map((member) => (
            <MemberRow key={member.id} member={member} onSelect={() => navigate(`/members/${member.id}`)} />
          ))}
        </Card>
      )}

      <RegisterSheet
        open={registering}
        onClose={() => setRegistering(false)}
        onRegistered={(id) => navigate(`/members/${id}`)}
      />
    </div>
  )
}
