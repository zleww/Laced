import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import type { Role, Session } from './types'

type AuthValue = {
  /** undefined while the saved session is being checked, null when signed out. */
  session: Session | null | undefined
  signIn: (email: string, password: string) => Promise<void>
  signInDemo: (role: Role) => Promise<void>
  signOut: () => Promise<void>
  /** The second sign-in step, for accounts with an authenticator app. */
  verifyCode: (code: string) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// Holds "who is signed in" for the whole app, so any screen can ask.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    api
      .getSession()
      .then(setSession)
      .catch(() => setSession(null))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      signIn: async (email, password) => setSession(await api.signIn(email, password)),
      signInDemo: async (role) => setSession(await api.signInDemo(role)),
      verifyCode: async (code) => setSession(await api.verifySignInCode(code)),
      signOut: async () => {
        await api.signOut()
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

/** For screens behind the login: the session is known to exist there. */
export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('No session')
  return session
}
