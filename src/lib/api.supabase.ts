import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, manilaDayStart, manilaToday } from './dates'
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

    async dailyStats(days) {
      const { data, error } = await supabase.rpc('analytics_daily', { p_days: days })
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        day: row.day,
        revenueCentavos: Number(row.revenue_centavos),
        checkins: Number(row.checkins),
      }))
    },

    async isDayClosed() {
      const { data, error } = await supabase.rpc('is_day_closed')
      if (error) fail(error)
      return data === true
    },

    async closeDay({ countedCashCentavos, countedGcashCentavos, note }) {
      await call('close_day', {
        p_counted_cash_centavos: countedCashCentavos,
        p_counted_gcash_centavos: countedGcashCentavos,
        p_note: note,
      })
    },

    async moneySummary(days) {
      const { data, error } = await supabase.rpc('analytics_money', { p_days: days })
      if (error) fail(error)
      const row = ((data ?? []) as Row[])[0]
      return {
        revenueCentavos: Number(row?.revenue_centavos ?? 0),
        cashCentavos: Number(row?.cash_centavos ?? 0),
        gcashCentavos: Number(row?.gcash_centavos ?? 0),
        expensesCentavos: Number(row?.expenses_centavos ?? 0),
        voidCount: Number(row?.void_count ?? 0),
      }
    },

    async planRevenue(days) {
      const { data, error } = await supabase.rpc('analytics_plans', { p_days: days })
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        planName: row.plan_name,
        revenueCentavos: Number(row.revenue_centavos),
        sales: Number(row.sales),
      }))
    },

    async listPayments(days) {
      const firstDay = addDays(manilaToday(), -(days - 1))
      // payments points at staff three times (received, voided, discount approved),
      // so the join has to name which link it means.
      const { data, error } = await supabase
        .from('payments')
        .select(
          'id, paid_at, guest_name, amount_centavos, discount_centavos, method, gcash_ref, voided_at, void_reason, members(full_name), plans(name), staff!payments_received_by_fkey(full_name)',
        )
        .gte('paid_at', manilaDayStart(firstDay))
        .order('paid_at', { ascending: false })
        .limit(200)
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        paidAt: row.paid_at,
        payer: row.members?.full_name ?? row.guest_name ?? 'Guest',
        planName: row.plans?.name ?? 'Plan',
        amountCentavos: row.amount_centavos - row.discount_centavos,
        method: row.method,
        gcashRef: row.gcash_ref,
        receivedBy: row.staff?.full_name ?? 'Staff',
        voidedAt: row.voided_at,
        voidReason: row.void_reason,
      }))
    },

    async voidPayment(paymentId, reason) {
      await call('void_payment', { p_payment_id: paymentId, p_reason: reason })
    },

    async listExpenses(days) {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, amount_centavos, spent_on, note, voided_at')
        .gte('spent_on', addDays(manilaToday(), -(days - 1)))
        .order('spent_on', { ascending: false })
        .limit(200)
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        category: row.category,
        amountCentavos: row.amount_centavos,
        spentOn: row.spent_on,
        note: row.note,
        voidedAt: row.voided_at,
      }))
    },

    async addExpense({ category, amountCentavos, spentOn, note }) {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('expenses').insert({
        category: category.trim(),
        amount_centavos: amountCentavos,
        spent_on: spentOn,
        note: note.trim() || null,
        recorded_by: auth.user?.id,
      })
      if (error) fail(error)
    },

    async voidExpense(expenseId, reason) {
      const { error } = await supabase.rpc('void_expense', { p_expense_id: expenseId, p_reason: reason })
      if (error) fail(error)
    },

    async listCloses() {
      const { data, error } = await supabase
        .from('daily_closes')
        .select(
          'id, close_date, expected_cash_centavos, counted_cash_centavos, expected_gcash_centavos, counted_gcash_centavos, note, staff(full_name)',
        )
        .order('close_date', { ascending: false })
        .limit(30)
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        closeDate: row.close_date,
        expectedCashCentavos: row.expected_cash_centavos,
        countedCashCentavos: row.counted_cash_centavos,
        expectedGcashCentavos: row.expected_gcash_centavos,
        countedGcashCentavos: row.counted_gcash_centavos,
        closedBy: row.staff?.full_name ?? 'Staff',
        note: row.note,
      }))
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
