// Member sign-up with a code from the front desk.
//
// A member types the one-time code the desk gave them, plus a username (or
// email) and a password. This function checks the code, creates their login,
// and links it to their member record. Creating a login needs Supabase's secret
// key, which must never reach the browser, so it runs here on the server.
//
// Nobody is signed in yet, so the code is the only proof. Every wrong code gets
// the same plain answer, and a device that guesses too often is asked to wait.
//
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function > Via Editor,
// name it "member-claim", and add both files (index.ts and rules.ts).
// Turn OFF "Verify JWT": the caller has no login yet.
// Secrets to set: MEMBER_ALLOWED_ORIGINS (the member app's address) and
// optionally MEMBER_EMAIL_DOMAIN (the same value the member app uses).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { checkPassword, createLimiter, loginToEmail, Refusal } from './rules.ts'

const allowedOrigins = (Deno.env.get('MEMBER_ALLOWED_ORIGINS') ?? 'http://localhost:5175')
  .split(',')
  .map((origin) => origin.trim())

// Usernames become "name@this-domain". The ".invalid" ending can never receive mail.
const emailDomain = Deno.env.get('MEMBER_EMAIL_DOMAIN') ?? 'members.laced.invalid'

// 8 wrong codes from one address in 15 minutes, then a wait.
const limiter = createLimiter(8, 15 * 60 * 1000)

const wrongCode = 'That code is wrong or has run out. Ask the front desk for a new one.'

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

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  const headers = {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Content-Type': 'application/json',
  }
  if (request.method === 'OPTIONS') return new Response('ok', { headers })

  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers })

  try {
    if (request.method !== 'POST') throw new Refusal('Use POST.', 405)
    if (origin && !allowedOrigins.includes(origin)) throw new Refusal('Not allowed.', 403)

    const who = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    if (limiter.blocked(who)) throw new Refusal('Too many tries. Wait 15 minutes and try again.', 429)

    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.slice(0, 30) : ''
    const email = loginToEmail(body.login, emailDomain)
    const password = checkPassword(body.password)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Check the code before making anything, so a bad code creates no login.
    const { data: memberId, error: statusError } = await admin.rpc('member_claim_status', { p_code: code })
    if (statusError) throw new Error('status failed')
    if (!memberId) {
      limiter.fail(who)
      throw new Refusal(wrongCode)
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      const taken = /already|registered|exists/i.test(createError?.message ?? '')
      throw new Refusal(taken ? 'That username is taken. Pick another.' : "Couldn't create the login. Try again.")
    }

    const { error: claimError } = await admin.rpc('complete_member_claim', {
      p_code: code,
      p_user_id: created.user.id,
    })
    if (claimError) {
      // Do not leave a login with no member behind.
      await admin.auth.admin.deleteUser(created.user.id)
      throw new Refusal(wrongCode)
    }

    return reply(200, { email })
  } catch (error) {
    if (error instanceof Refusal) return reply(error.status, { error: error.message })
    console.error('member-claim failed')
    return reply(500, { error: 'Something went wrong. Try again.' })
  }
})
