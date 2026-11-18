import type { SupabaseClient } from '@supabase/supabase-js'
import { manilaDayStart, manilaToday } from './dates'
import { searchTerm } from './format'
import type { Api, Member, MemberDetail, Plan, Session } from './types'

// The real data layer. Reads go through row-level security; every write goes
// through a database function, so the browser never sends a price.

type Row = Record<string, any>

function fail(error: { message: string; code?: string }): never {
  if (/failed to fetch|network/i.test(error.message)) {
    throw new Error("Can't reach the server. Check the connection and try again.")
  }
  if (error.code === '42501' || /permission denied|row-level security/i.test(error.message)) {
    throw new Error("This account isn't allowed to do that.")
  }
  throw new Error(error.message)
}

function toMember(row: Row): Member {
  return {
    id: row.id,
    memberNo: row.member_no,
    fullName: row.full_name,
    phone: row.phone,
    status: row.status,
    validUntil: row.valid_until,
    daysLeft: row.days_left,
    planId: row.plan_id,
    planName: row.plan_name,
  }
}

function toPlan(row: Row): Plan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    durationDays: row.duration_days,
    durationMonths: row.duration_months,
    bonusMonths: row.bonus_months,
    priceCentavos: row.price_centavos,
  }
}

export function createSupabaseApi(supabase: SupabaseClient): Api {
  // A login only counts if it has an active row in the staff table.
  async function loadSession(userId: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from('staff')
      .select('full_name, role, active')
      .eq('id', userId)
      .maybeSingle()
    if (error) fail(error)
    if (!data || !data.active) return null
    return { userId, fullName: data.full_name, role: data.role }
  }

  async function call(fn: string, args: Row): Promise<Row> {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) fail(error)
    return data as Row
  }

  return {
    mode: 'live',

    async getSession() {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user.id
      if (!userId) return null
      const session = await loadSession(userId)
      if (!session) await supabase.auth.signOut()
      return session
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (/failed to fetch|network/i.test(error.message)) fail(error)
        // One message for a wrong email and a wrong password, so the form never
        // reveals which accounts exist.
        throw new Error('Wrong email or password.')
      }
      const session = await loadSession(data.user.id)
      if (!session) {
        await supabase.auth.signOut()
        throw new Error("This account doesn't have access. Ask the owner to activate it.")
      }
      return session
    },

    async signInDemo() {
      throw new Error('Demo sign-in is off when a database is connected.')
    },

    async signOut() {
      await supabase.auth.signOut()
    },

    async searchMembers(query) {
      // Strip characters that have a meaning in the filter syntax below.
      const term = searchTerm(query.replace(/[%,()*\\"']/g, ' '))
      let request = supabase.from('member_overview').select('*').order('full_name').limit(50)
      if (term) request = request.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
      const { data, error } = await request
      if (error) fail(error)
      return (data ?? []).map(toMember)
    },

    async getMember(id): Promise<MemberDetail> {
      const [member, memberships, visits] = await Promise.all([
        supabase.from('member_overview').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('memberships')
          .select('id, start_date, end_date, kind, plans(name)')
          .eq('member_id', id)
          .is('voided_at', null)
          .order('start_date', { ascending: false }),
        supabase
          .from('checkins')
          .select('id, checked_in_at')
          .eq('member_id', id)
          .order('checked_in_at', { ascending: false })
          .limit(10),
      ])
      if (member.error) fail(member.error)
      if (memberships.error) fail(memberships.error)
      if (visits.error) fail(visits.error)
      if (!member.data) throw new Error('Member not found.')

      return {
        member: toMember(member.data),
        memberships: (memberships.data ?? []).map((row: Row) => ({
          id: row.id,
          planName: row.plans?.name ?? 'Plan',
          startDate: row.start_date,
          endDate: row.end_date,
          kind: row.kind,
        })),
        visits: (visits.data ?? []).map((row: Row) => ({ id: row.id, checkedInAt: row.checked_in_at })),
      }
    },

    async registerMember({ fullName, phone, consent }) {
      const result = await call('register_member', {
        p_full_name: fullName,
        p_phone: phone,
        p_consent: consent,
      })
      return result.member_id
    },

    async listPlans() {
      const { data, error } = await supabase.from('plans').select('*').eq('active', true).order('sort')
      if (error) fail(error)
      return (data ?? []).map(toPlan)
    },

    async sellMembership({ memberId, planId, method, gcashRef, studentIdChecked }) {
      const result = await call('record_membership_payment', {
        p_member_id: memberId,
        p_plan_id: planId,
        p_method: method,
        p_gcash_ref: method === 'gcash' ? gcashRef : null,
        p_student_id_checked: studentIdChecked,
      })
      return { amountCentavos: result.amount_centavos, endDate: result.end_date }
    },

    async sellDayPass({ planId, method, gcashRef, studentIdChecked, guestName, memberId }) {
      const result = await call('sell_day_pass', {
        p_plan_id: planId,
        p_method: method,
        p_gcash_ref: method === 'gcash' ? gcashRef : null,
        p_guest_name: guestName ?? null,
        p_member_id: memberId ?? null,
        p_student_id_checked: studentIdChecked,
      })
      return { amountCentavos: result.amount_centavos, endDate: null }
    },

    async checkIn(memberId, overrideReason) {
      const result = await call('check_in', {
        p_member_id: memberId,
        p_method: 'search',
        p_override_reason: overrideReason ?? null,
      })
      return {
        status: result.status,
        alreadyCheckedIn: result.already_checked_in,
        checkedInAt: result.checked_in_at ?? new Date().toISOString(),
      }
    },

    async todaySummary() {
      const today = manilaToday()
      const [payments, checkins, expiring] = await Promise.all([
        // Row-level security decides what comes back: the owner gets every payment,
        // a staff member gets only the ones they collected.
        supabase
          .from('payments')
          .select('amount_centavos, discount_centavos')
          .is('voided_at', null)
          .gte('paid_at', manilaDayStart(today)),
        supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('visit_date', today),
        supabase.from('member_overview').select('*').eq('status', 'expiring').order('days_left'),
      ])
      if (payments.error) fail(payments.error)
      if (checkins.error) fail(checkins.error)
      if (expiring.error) fail(expiring.error)

      return {
        collectedCentavos: (payments.data ?? []).reduce(
          (sum: number, row: Row) => sum + row.amount_centavos - row.discount_centavos,
          0,
        ),
        checkins: checkins.count ?? 0,
        expiring: (expiring.data ?? []).map(toMember),
      }
    },
  }
}
