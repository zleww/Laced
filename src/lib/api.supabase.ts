import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, manilaDayStart, manilaToday } from './dates'
import { searchTerm } from './format'
import type { Api, Member, MemberDetail, PayrollEntry, Plan, Session } from './types'

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
  // P0001 is a message our own database functions raise on purpose, written for people.
  if (error.code === 'P0001') throw new Error(error.message)
  // Anything else is a raw database message. Users get plain words instead.
  if (error.code === '23505') throw new Error("That's already recorded. Search for it instead.")
  if (error.code?.startsWith('22') || error.code?.startsWith('23')) {
    throw new Error("Some details aren't valid. Check them and try again.")
  }
  // The app asked for a database function that does not exist: a migration was not applied.
  if (error.code === 'PGRST202') {
    throw new Error("This part of the database isn't set up yet. The owner needs to apply the latest database update.")
  }
  if (error.code === 'PGRST301' || /jwt/i.test(error.message)) {
    throw new Error('Your session ended. Sign in again.')
  }
  throw new Error('Something went wrong. Try again, and tell the owner if it keeps happening.')
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

function toPayroll(row: Row): PayrollEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? 'Employee',
    jobTitle: row.employees?.job_title ?? '',
    periodMonth: row.period_month,
    grossCentavos: row.gross_centavos,
    deductions: {
      sssEe: row.sss_ee_centavos,
      sssEr: row.sss_er_centavos,
      sssEc: row.sss_ec_centavos,
      philhealthEe: row.philhealth_ee_centavos,
      philhealthEr: row.philhealth_er_centavos,
      pagibigEe: row.pagibig_ee_centavos,
      pagibigEr: row.pagibig_er_centavos,
      tax: row.tax_centavos,
    },
    otherCentavos: row.other_deductions_centavos,
    otherNote: row.other_note,
    netCentavos: row.net_centavos,
    status: row.status,
    paidAt: row.paid_at,
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

  // After the password, an account with an authenticator app still needs the code.
  async function needsCode(): Promise<boolean> {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
  }

  async function withCodeCheck(session: Session | null): Promise<Session | null> {
    return session ? { ...session, needsCode: await needsCode() } : null
  }

  const wrongCode = "That code didn't work. Codes change every 30 seconds: check the time on your phone and try the newest one."

  async function call(fn: string, args: Row): Promise<Row> {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) fail(error)
    return data as Row
  }

  // Staff logins are managed by the staff-admin function on Supabase's servers.
  async function staffAdmin(body: Row): Promise<void> {
    const { data, error } = await supabase.functions.invoke('staff-admin', { body })
    if (!error) return
    // The function answers with { error: "plain message" }; show that when there is one.
    // When the server answered, `context` is its Response. When the request never
    // got through (function not deployed, no connection), it is something else.
    const context = (error as { context?: unknown }).context
    let message: string | null = null
    if (context instanceof Response) {
      if (context.status === 404) {
        throw new Error('The staff-admin function is not deployed in Supabase yet. Deploy it, then try again.')
      }
      message = await context.json().then(
        (json: Row) => (typeof json?.error === 'string' ? json.error : null),
        () => null,
      )
    }
    if (message) throw new Error(message)
    if (/failed to send|fetch/i.test(error.message)) {
      throw new Error("Can't reach the staff-admin function. Check that it is deployed in Supabase.")
    }
    throw new Error(data?.error ?? 'Something went wrong. Try again.')
  }

  return {
    mode: 'live',

    async getSession() {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user.id
      if (!userId) return null
      const session = await loadSession(userId)
      if (!session) await supabase.auth.signOut()
      return withCodeCheck(session)
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
      return (await withCodeCheck(session))!
    },

    async verifySignInCode(code) {
      const { data: factors, error } = await supabase.auth.mfa.listFactors()
      if (error) fail(error)
      const factor = factors?.totp.find((item) => item.status === 'verified')
      if (!factor) throw new Error('No authenticator app is set up for this account.')
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
      if (result.error) throw new Error(wrongCode)
      const { data } = await supabase.auth.getUser()
      const session = data.user ? await loadSession(data.user.id) : null
      if (!session) throw new Error('Sign in again.')
      return { ...session, needsCode: false }
    },

    async twoStepStatus() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) fail(error)
      return { on: Boolean(data?.totp.some((item) => item.status === 'verified')) }
    },

    async startTwoStep() {
      // Clear out any half-finished setup first, so a new QR code can be made.
      const { data: factors } = await supabase.auth.mfa.listFactors()
      for (const factor of factors?.all ?? []) {
        if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Laced' })
      if (error || !data) throw new Error("Couldn't start the setup. Try again.")
      const svg = data.totp.qr_code
      return {
        factorId: data.id,
        qrCode: svg.startsWith('data:') ? svg : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
        secret: data.totp.secret,
      }
    },

    async confirmTwoStep(factorId, code) {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
      if (error) throw new Error(wrongCode)
    },

    async turnOffTwoStep() {
      const { data: factors, error } = await supabase.auth.mfa.listFactors()
      if (error) fail(error)
      for (const factor of factors?.all ?? []) {
        const result = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (result.error) throw new Error("Couldn't turn it off. Sign out, sign in again with your code, and try again.")
      }
      // Get a fresh token that no longer carries the old sign-in level.
      await supabase.auth.refreshSession()
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

    async deleteMemberData(memberId, reason) {
      await call('delete_member_data', { p_member_id: memberId, p_reason: reason })
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

    async listStaffAccounts() {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, role, active')
        .order('active', { ascending: false })
        .order('full_name')
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        role: row.role,
        active: row.active,
      }))
    },

    async addStaffAccount(input) {
      await staffAdmin({ action: 'create', ...input })
    },

    async setStaffPassword(staffId, password) {
      await staffAdmin({ action: 'set_password', staffId, password })
    },

    async setStaffActive(staffId, active) {
      await staffAdmin({ action: 'set_active', staffId, active })
    },

    async listEmployees() {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, job_title, monthly_rate_centavos, with_contributions, active')
        .order('active', { ascending: false })
        .order('full_name')
      if (error) fail(error)
      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        jobTitle: row.job_title,
        monthlyRateCentavos: row.monthly_rate_centavos,
        withContributions: row.with_contributions,
        active: row.active,
      }))
    },

    async saveEmployee(input, id) {
      const row = {
        full_name: input.fullName.trim(),
        job_title: input.jobTitle.trim(),
        monthly_rate_centavos: input.monthlyRateCentavos,
        with_contributions: input.withContributions,
        active: input.active,
      }
      const { error } = id
        ? await supabase.from('employees').update(row).eq('id', id)
        : await supabase.from('employees').insert(row)
      if (error) fail(error)
    },

    async listPayroll(periodMonth) {
      const { data, error } = await supabase
        .from('payroll_entries')
        .select('*, employees(full_name, job_title)')
        .eq('period_month', periodMonth)
        .is('voided_at', null)
      if (error) fail(error)
      return ((data ?? []) as Row[]).map(toPayroll).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    },

    async savePayroll({ employeeId, periodMonth, grossCentavos, otherCentavos, otherNote }) {
      await call('save_payroll_entry', {
        p_employee_id: employeeId,
        p_period_month: periodMonth,
        p_gross_centavos: grossCentavos,
        p_other_centavos: otherCentavos,
        p_other_note: otherNote,
      })
    },

    async markPayrollPaid(entryId) {
      await call('mark_payroll_paid', { p_entry_id: entryId })
    },

    async voidPayroll(entryId, reason) {
      await call('void_payroll_entry', { p_entry_id: entryId, p_reason: reason })
    },

    async activity({ limit, before, kind }) {
      const data = (await call('activity_feed', {
        p_limit: limit,
        p_before: before ?? null,
        p_kind: kind ?? null,
      })) as unknown as Row[]
      return (data ?? []).map((row) => ({
        at: row.at,
        actor: row.actor,
        kind: row.kind,
        summary: row.summary,
        amountCentavos: row.amount_centavos === null ? null : Number(row.amount_centavos),
      }))
    },

    async monthlyReport(months) {
      const data = (await call('analytics_monthly', { p_months: months })) as unknown as Row[]
      return (data ?? []).map((row) => ({
        month: row.month,
        revenueCentavos: Number(row.revenue_centavos),
        expensesCentavos: Number(row.expenses_centavos),
        payrollCentavos: Number(row.payroll_centavos),
        checkins: Number(row.checkins),
        newMembers: Number(row.new_members),
      }))
    },

    async exportTable(table) {
      // The server sends at most 1,000 rows per request, so read in pages.
      const all: Row[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + 999)
        if (error) fail(error)
        all.push(...((data ?? []) as Row[]))
        if (!data || data.length < 1000) return all
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
