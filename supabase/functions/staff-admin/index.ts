// Staff accounts, managed by the owner from the Settings screen.
//
// Creating a login needs Supabase's secret key, which must never reach the
// browser. This function runs on Supabase's servers, where the key is
// available, and only does anything after checking that the caller is an
// active owner.
//
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function > Via Editor,
// name it "staff-admin", paste this file, and deploy.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Sites allowed to call this function. Add your own domain if it changes.
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://laced-rho.vercel.app,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** The server-only secret key: the new key system first, the legacy one as a fallback. */
function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!legacy) throw new Error('No secret key available')
  return legacy
}

/** The public key, used to act as the signed-in owner so row rules and the audit log apply. */
function publishableKey(): string {
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? ''
}

class Refusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function checkPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 10) {
    throw new Refusal('Use a password of at least 10 characters.')
  }
  if (password.length > 72) throw new Refusal('Use a password of at most 72 characters.')
  return password
}

Deno.serve(async (request) => {
  const headers = { ...corsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
  if (request.method === 'OPTIONS') return new Response('ok', { headers })

  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers })

  try {
    if (request.method !== 'POST') throw new Refusal('Use POST.', 405)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Who is calling? The browser sends the signed-in user's token.
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !caller.user) throw new Refusal('Sign in again.', 401)

    const { data: callerRow } = await admin
      .from('staff')
      .select('role, active')
      .eq('id', caller.user.id)
      .maybeSingle()
    if (!callerRow || !callerRow.active || callerRow.role !== 'owner') {
      throw new Refusal('Only the owner can manage staff accounts.', 403)
    }

    // Turning an account on or off is done as the owner, so it passes the same
    // row rules as the app and the audit log records the owner as the actor.
    const asOwner = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const body = await request.json().catch(() => ({}))

    if (body.action === 'create') {
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const role = body.role === 'owner' ? 'owner' : 'staff'
      if (fullName.length < 2 || fullName.length > 80) throw new Refusal('Enter their full name.')
      if (!emailPattern.test(email)) throw new Refusal('Enter a valid email address.')
      const password = checkPassword(body.password)

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !created.user) {
        throw new Refusal(
          /already|registered|exists/i.test(error?.message ?? '')
            ? 'That email already has a login.'
            : "Couldn't create the login. Try again.",
        )
      }

      // The new row needs the login's id, a column the app itself may not set,
      // so this one insert uses the server key. The owner check above still applies.
      const { error: rowError } = await admin
        .from('staff')
        .insert({ id: created.user.id, full_name: fullName, role })
      if (rowError) {
        // Do not leave a login with no staff row behind.
        await admin.auth.admin.deleteUser(created.user.id)
        throw new Refusal("Couldn't save the staff account. Try again.")
      }
      return reply(200, { id: created.user.id })
    }

    if (body.action === 'set_password') {
      const password = checkPassword(body.password)
      const { error } = await admin.auth.admin.updateUserById(String(body.staffId), { password })
      if (error) throw new Refusal("Couldn't change the password. Try again.")
      return reply(200, { ok: true })
    }

    if (body.action === 'set_active') {
      const staffId = String(body.staffId)
      const active = body.active === true
      if (staffId === caller.user.id && !active) throw new Refusal("You can't turn off your own account.")

      const { error } = await asOwner.from('staff').update({ active }).eq('id', staffId)
      if (error) throw new Refusal("Couldn't update the account. Try again.")
      // A ban also stops an old session from being renewed, so a turned-off
      // account is locked out of Supabase itself, not only the app.
      await admin.auth.admin.updateUserById(staffId, { ban_duration: active ? 'none' : '876000h' })
      return reply(200, { ok: true })
    }

    throw new Refusal('Unknown action.')
  } catch (error) {
    if (error instanceof Refusal) return reply(error.status, { error: error.message })
    console.error('staff-admin failed')
    return reply(500, { error: 'Something went wrong. Try again.' })
  }
})
