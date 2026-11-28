import { addDays, daysBetween, manilaToday, membershipEnd } from './dates'
import { searchTerm } from './format'
import { computeDeductions, employerShare, netPay } from './payroll'
import type {
  Api,
  ActivityItem,
  DayClose,
  Employee,
  ExpenseRecord,
  Member,
  MembershipRecord,
  PaymentMethod,
  PayrollEntry,
  Plan,
  Role,
  Session,
  StaffAccount,
} from './types'

// Demo data layer, used when no database is connected. Everything lives in
// memory and resets on reload. It follows the same rules as the database
// functions so the screens behave the same way, but it is NOT the source of
// truth: the real rules are enforced in supabase/migrations.

type DemoMember = { id: string; memberNo: number; fullName: string; phone: string }
type DemoMembership = MembershipRecord & { memberId: string; planId: string }
type DemoCheckin = { id: string; memberId: string | null; day: string; checkedInAt: string; status: string }
type DemoPayment = {
  id: string
  amountCentavos: number
  method: PaymentMethod
  gcashRef: string | null
  receivedBy: string
  day: string
  paidAt: string
  payer: string
  planName: string
  membershipId: string | null
  voidedAt: string | null
  voidReason: string | null
}

const SESSION_KEY = 'laced-demo-role'
const users: Record<Role, Session> = {
  owner: { userId: 'demo-owner', fullName: 'Demo Owner', role: 'owner' },
  staff: { userId: 'demo-staff', fullName: 'Demo Staff', role: 'staff' },
}

const plan = (
  code: string,
  name: string,
  category: Plan['category'],
  days: number | null,
  months: number | null,
  bonusMonths: number,
  priceCentavos: number,
): Plan => ({ id: `plan-${code}`, code, name, category, durationDays: days, durationMonths: months, bonusMonths, priceCentavos })

const plans: Plan[] = [
  plan('regular_day', 'Day pass', 'regular', 1, null, 0, 8500),
  plan('student_day', 'Student day pass', 'student', 1, null, 0, 7500),
  plan('trainer_day', 'Day pass with trainer', 'trainer', 1, null, 0, 38500),
  plan('regular_month', 'Monthly', 'regular', null, 1, 0, 95000),
  plan('student_month', 'Student monthly', 'student', null, 1, 0, 85000),
  plan('trainer_month', 'Monthly with trainer', 'trainer', null, 1, 0, 495000),
  plan('promo_2m', '2 months', 'promo', null, 2, 0, 170000),
  plan('promo_3m', '3 months', 'promo', null, 3, 0, 255000),
  plan('promo_4m', '4 months', 'promo', null, 4, 0, 350000),
  plan('promo_6m', '6 months', 'promo', null, 6, 0, 510000),
  plan('promo_1y', '1 year + 1 month free', 'promo', null, 12, 1, 900000),
]

const members: DemoMember[] = []
const memberships: DemoMembership[] = []
const checkins: DemoCheckin[] = []
const payments: DemoPayment[] = []
const expenses: ExpenseRecord[] = []
const closes: DayClose[] = []
const employees: Employee[] = [
  { id: 'emp-1', fullName: 'Rhea Torres', jobTitle: 'Front desk', monthlyRateCentavos: 1800000, withContributions: true, active: true },
  { id: 'emp-2', fullName: 'Jun Navarro', jobTitle: 'Coach', monthlyRateCentavos: 2500000, withContributions: true, active: true },
  { id: 'emp-3', fullName: 'Lito Ramos', jobTitle: 'Cleaner', monthlyRateCentavos: 1200000, withContributions: false, active: true },
]
const staffAccounts: StaffAccount[] = Object.values(users).map((user) => ({
  id: user.userId,
  fullName: user.fullName,
  role: user.role,
  active: true,
}))
const payroll: Array<PayrollEntry & { voidedAt: string | null }> = []
const activityLog: ActivityItem[] = []
let session: Session | null = null
let signInLimits = { maxTries: 5, waitMinutes: 10 }

const newId = () => crypto.randomUUID()
const pause = () => new Promise((resolve) => setTimeout(resolve, 200))

// Sample members. [name, plan code, days until the membership ends (negative = ended)]
const samples: Array<[string, string | null, number]> = [
  ['Marco Reyes', 'regular_month', 21],
  ['Liza Santos', 'promo_3m', 64],
  ['Paolo Cruz', 'regular_month', 5],
  ['Jenny Dela Cruz', 'student_month', 2],
  ['Rico Mendoza', 'regular_month', 0],
  ['Carla Bautista', 'promo_2m', -3],
  ['Noel Garcia', 'regular_month', -45],
  ['Ana Villanueva', null, 0],
]

samples.forEach(([fullName, code, endsIn], index) => {
  const id = newId()
  members.push({ id, memberNo: index + 1, fullName, phone: `0917000${String(index + 1).padStart(4, '0')}` })
  const sold = plans.find((item) => item.code === code)
  if (sold) {
    const endDate = addDays(manilaToday(), endsIn)
    memberships.push({
      id: newId(),
      memberId: id,
      planId: sold.id,
      planName: sold.name,
      startDate: addDays(endDate, -29),
      endDate,
      kind: 'new',
    })
  }
})

function latestMembership(memberId: string): DemoMembership | undefined {
  return memberships
    .filter((item) => item.memberId === memberId)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
}

function toMember(member: DemoMember): Member {
  const latest = latestMembership(member.id)
  const daysLeft = latest ? daysBetween(manilaToday(), latest.endDate) : null
  return {
    ...member,
    validUntil: latest?.endDate ?? null,
    daysLeft,
    planId: latest?.planId ?? null,
    planName: latest?.planName ?? null,
    status: daysLeft === null ? 'none' : daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'expiring' : 'active',
  }
}

function savedSession(): Session | null {
  const saved = sessionStorage.getItem(SESSION_KEY)
  return saved === 'owner' || saved === 'staff' ? users[saved] : null
}

function requireSession(): Session {
  session ??= savedSession()
  if (!session) throw new Error('Sign in first.')
  return session
}

// Members who already made an app login. None to start with.
const appAccess = new Set<string>()

function findMember(id: string): DemoMember {
  const member = members.find((item) => item.id === id)
  if (!member) throw new Error('Member not found.')
  return member
}

function findPlan(id: string): Plan {
  const found = plans.find((item) => item.id === id)
  if (!found) throw new Error('Plan not found or no longer offered')
  return found
}

function requireOwner(): Session {
  const current = requireSession()
  if (current.role !== 'owner') throw new Error("This account isn't allowed to do that.")
  return current
}

function log(kind: ActivityItem['kind'], summary: string, amountCentavos: number | null = null) {
  activityLog.unshift({ at: new Date().toISOString(), actor: requireSession().fullName, kind, summary, amountCentavos })
}

const live = (item: DemoPayment) => item.voidedAt === null
const withinDays = (day: string, days: number) => day >= addDays(manilaToday(), -(days - 1))

function takePayment(
  soldPlan: Plan,
  method: PaymentMethod,
  gcashRef: string,
  studentIdChecked: boolean,
  payer: string,
  membershipId: string | null,
) {
  if (soldPlan.category === 'student' && !studentIdChecked) {
    throw new Error('Check the school ID before selling a student plan')
  }
  let reference: string | null = null
  if (method === 'gcash') {
    reference = gcashRef.replace(/\s/g, '')
    if (!reference) throw new Error('Enter the GCash reference number')
    if (!/^[A-Za-z0-9]{6,30}$/.test(reference)) {
      throw new Error('The GCash reference number should be 6 to 30 letters or digits')
    }
    if (payments.some((item) => live(item) && item.gcashRef === reference)) {
      throw new Error('That GCash reference number is already recorded')
    }
  }
  payments.push({
    id: newId(),
    amountCentavos: soldPlan.priceCentavos,
    method,
    gcashRef: reference,
    receivedBy: requireSession().userId,
    day: manilaToday(),
    paidAt: new Date().toISOString(),
    payer,
    planName: soldPlan.name,
    membershipId,
    voidedAt: null,
    voidReason: null,
  })
  log('sale', `${soldPlan.name} for ${payer} (${method === 'gcash' ? 'GCash' : 'cash'})`, soldPlan.priceCentavos)
}

export const demoApi: Api = {
  mode: 'demo',

  async getSession() {
    session = savedSession()
    return session
  },

  async signIn() {
    throw new Error('No database is connected yet. Use a demo account below.')
  },

  async signInDemo(role) {
    await pause()
    session = users[role]
    sessionStorage.setItem(SESSION_KEY, role)
    return session
  },

  async signOut() {
    session = null
    sessionStorage.removeItem(SESSION_KEY)
  },

  async signInLimits() {
    return { ...signInLimits }
  },

  async saveSignInLimits(limits) {
    requireOwner()
    await pause()
    if (limits.maxTries < 3 || limits.maxTries > 20) throw new Error('Allow between 3 and 20 tries.')
    if (limits.waitMinutes < 1 || limits.waitMinutes > 120) throw new Error('Set a wait between 1 and 120 minutes.')
    signInLimits = { ...limits }
    log('settings', `Changed sign-in limits to ${limits.maxTries} tries and ${limits.waitMinutes} minutes`)
  },

  async verifySignInCode() {
    throw new Error('Two-step sign-in works only with the live database.')
  },

  async twoStepStatus() {
    requireSession()
    return { on: false }
  },

  async startTwoStep() {
    throw new Error('Two-step sign-in works only with the live database.')
  },

  async confirmTwoStep() {
    throw new Error('Two-step sign-in works only with the live database.')
  },

  async turnOffTwoStep() {
    throw new Error('Two-step sign-in works only with the live database.')
  },

  async searchMembers(query) {
    requireSession()
    await pause()
    const term = searchTerm(query).toLowerCase()
    return members
      .filter((item) => !term || item.fullName.toLowerCase().includes(term) || item.phone.includes(term))
      .map(toMember)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  },

  async getMember(id) {
    const current = requireSession()
    await pause()
    const today = manilaToday()
    return {
      member: toMember(findMember(id)),
      memberships: memberships
        .filter((item) => item.memberId === id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
      // Like the database: staff see today's visits only, the owner sees history.
      visits: checkins
        .filter((item) => item.memberId === id && (current.role === 'owner' || item.day === today))
        .map((item) => ({ id: item.id, checkedInAt: item.checkedInAt })),
      hasAppAccount: appAccess.has(id),
    }
  },

  async giveAppAccess(memberId) {
    requireSession()
    await pause()
    findMember(memberId)
    if (appAccess.has(memberId)) throw new Error('This member already has an app account')
    const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const pick = () => letters[Math.floor(Math.random() * letters.length)]
    const code = Array.from({ length: 10 }, pick).join('')
    const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString()
    return { code: `${code.slice(0, 5)}-${code.slice(5)}`, expiresAt }
  },

  async registerMember({ fullName, phone, consent }) {
    requireSession()
    await pause()
    if (!consent) throw new Error('The member must agree to the consent line first')
    let digits = phone.replace(/\D/g, '')
    if (/^639\d{9}$/.test(digits)) digits = '0' + digits.slice(2)
    if (!/^09\d{9}$/.test(digits)) throw new Error('Enter an 11-digit mobile number that starts with 09')
    if (members.some((item) => item.phone === digits)) {
      throw new Error('That phone number is already registered. Search for the member instead.')
    }
    const name = fullName.trim()
    if (name.length < 2) throw new Error("Enter the member's full name")
    const id = newId()
    members.push({ id, memberNo: members.length + 1, fullName: name, phone: digits })
    return id
  },

  async deleteMemberData(memberId, reason) {
    requireOwner()
    await pause()
    if (reason.trim().length < 3) throw new Error('Give a reason, such as "Member asked"')
    const index = members.findIndex((item) => item.id === memberId)
    if (index < 0) throw new Error('Member not found or already deleted')
    const [removed] = members.splice(index, 1)
    log('member', `Deleted the data of member no. ${removed.memberNo}: ${reason.trim()}`)
  },

  async listPlans() {
    requireSession()
    return plans
  },

  async sellMembership({ memberId, planId, method, gcashRef, studentIdChecked }) {
    requireSession()
    await pause()
    findMember(memberId)
    const soldPlan = findPlan(planId)
    if (soldPlan.durationMonths === null) throw new Error('This is a day plan. Use the day pass action instead.')

    const today = manilaToday()
    const previousEnd = latestMembership(memberId)?.endDate
    let kind: MembershipRecord['kind'] = 'new'
    let startDate = today
    if (previousEnd && previousEnd >= today) {
      kind = 'renewal'
      startDate = addDays(previousEnd, 1)
    } else if (previousEnd) {
      kind = daysBetween(previousEnd, today) <= 7 ? 'renewal' : 'returning'
    }
    const endDate = membershipEnd(startDate, soldPlan.durationMonths + soldPlan.bonusMonths)

    const membershipId = newId()
    takePayment(soldPlan, method, gcashRef, studentIdChecked, findMember(memberId).fullName, membershipId)
    memberships.push({ id: membershipId, memberId, planId, planName: soldPlan.name, startDate, endDate, kind })
    return { amountCentavos: soldPlan.priceCentavos, endDate }
  },

  async sellDayPass({ planId, method, gcashRef, studentIdChecked, guestName, memberId }) {
    requireSession()
    await pause()
    const soldPlan = findPlan(planId)
    if (soldPlan.durationDays === null) throw new Error('This is not a day plan')
    const name = guestName?.trim()
    if (!memberId && (!name || name.length < 2)) throw new Error("Enter the guest's name (2 to 80 characters)")

    const today = manilaToday()
    if (memberId) {
      findMember(memberId)
      if (checkins.some((item) => item.memberId === memberId && item.day === today)) {
        throw new Error('This member is already checked in today')
      }
    }
    const membershipId = memberId ? newId() : null
    takePayment(
      soldPlan,
      method,
      gcashRef,
      studentIdChecked,
      memberId ? findMember(memberId).fullName : name!,
      membershipId,
    )
    if (memberId && membershipId) {
      memberships.push({
        id: membershipId,
        memberId,
        planId,
        planName: soldPlan.name,
        startDate: today,
        endDate: today,
        kind: 'day_pass',
      })
    }
    checkins.push({
      id: newId(),
      memberId: memberId ?? null,
      day: today,
      checkedInAt: new Date().toISOString(),
      status: 'day_pass',
    })
    return { amountCentavos: soldPlan.priceCentavos, endDate: null }
  },

  async checkIn(memberId, overrideReason) {
    const current = requireSession()
    await pause()
    const member = toMember(findMember(memberId))
    const today = manilaToday()

    const existing = checkins.find((item) => item.memberId === memberId && item.day === today)
    if (existing) {
      return {
        status: existing.status as 'active',
        alreadyCheckedIn: true,
        checkedInAt: existing.checkedInAt,
      }
    }

    const status = member.status === 'none' ? 'expired' : member.status
    if (status === 'expired') {
      if (current.role !== 'owner') throw new Error('Membership expired. Renew before checking in.')
      if (!overrideReason || overrideReason.trim().length < 3) {
        throw new Error('Give a reason for letting an expired member in')
      }
    }
    const checkedInAt = new Date().toISOString()
    checkins.push({ id: newId(), memberId, day: today, checkedInAt, status })
    log('checkin', `Checked in ${member.fullName}${overrideReason ? ` (override: ${overrideReason.trim()})` : ''}`)
    return { status, alreadyCheckedIn: false, checkedInAt }
  },

  async dailyStats(days) {
    const current = requireSession()
    await pause()
    if (current.role !== 'owner') return []
    const today = manilaToday()
    return Array.from({ length: days }, (_, index) => {
      const day = addDays(today, index - (days - 1))
      if (day === today) {
        return {
          day,
          revenueCentavos: payments
            .filter((item) => live(item) && item.day === today)
            .reduce((sum, item) => sum + item.amountCentavos, 0),
          checkins: checkins.filter((item) => item.day === today).length,
        }
      }
      // Made-up history for earlier days, steady from one reload to the next.
      const seed = Number(day.slice(8)) + Number(day.slice(5, 7)) * 3
      const sunday = new Date(day + 'T00:00:00Z').getUTCDay() === 0
      return {
        day,
        revenueCentavos: (sunday ? 180000 : 420000) + ((seed * 7919) % 26) * 8500,
        checkins: (sunday ? 14 : 31) + ((seed * 31) % 17),
      }
    })
  },

  async isDayClosed() {
    requireSession()
    return closes.some((item) => item.closeDate === manilaToday())
  },

  async closeDay({ countedCashCentavos, countedGcashCentavos, note }) {
    const current = requireSession()
    await pause()
    const today = manilaToday()
    if (closes.some((item) => item.closeDate === today)) throw new Error('Today is already closed')
    const expected = (method: PaymentMethod) =>
      payments
        .filter((item) => live(item) && item.day === today && item.method === method)
        .reduce((sum, item) => sum + item.amountCentavos, 0)
    closes.unshift({
      id: newId(),
      closeDate: today,
      expectedCashCentavos: expected('cash'),
      countedCashCentavos,
      expectedGcashCentavos: expected('gcash'),
      countedGcashCentavos,
      closedBy: current.fullName,
      note: note.trim() || null,
    })
    log('close', 'Closed the day', countedCashCentavos + countedGcashCentavos)
  },

  async moneySummary(days) {
    requireOwner()
    await pause()
    const inRange = payments.filter((item) => withinDays(item.day, days))
    const sum = (list: DemoPayment[]) => list.reduce((total, item) => total + item.amountCentavos, 0)
    const kept = inRange.filter(live)
    return {
      revenueCentavos: sum(kept),
      cashCentavos: sum(kept.filter((item) => item.method === 'cash')),
      gcashCentavos: sum(kept.filter((item) => item.method === 'gcash')),
      expensesCentavos: expenses
        .filter((item) => item.voidedAt === null && withinDays(item.spentOn, days))
        .reduce((total, item) => total + item.amountCentavos, 0),
      voidCount: inRange.length - kept.length,
    }
  },

  async planRevenue(days) {
    requireOwner()
    await pause()
    const byPlan = new Map<string, { revenueCentavos: number; sales: number }>()
    for (const item of payments.filter((entry) => live(entry) && withinDays(entry.day, days))) {
      const row = byPlan.get(item.planName) ?? { revenueCentavos: 0, sales: 0 }
      row.revenueCentavos += item.amountCentavos
      row.sales += 1
      byPlan.set(item.planName, row)
    }
    return [...byPlan.entries()]
      .map(([planName, row]) => ({ planName, ...row }))
      .sort((a, b) => b.revenueCentavos - a.revenueCentavos)
  },

  async listPayments(days) {
    requireOwner()
    await pause()
    return payments
      .filter((item) => withinDays(item.day, days))
      .map((item) => ({
        id: item.id,
        paidAt: item.paidAt,
        payer: item.payer,
        planName: item.planName,
        amountCentavos: item.amountCentavos,
        method: item.method,
        gcashRef: item.gcashRef,
        receivedBy: item.receivedBy === users.owner.userId ? users.owner.fullName : users.staff.fullName,
        voidedAt: item.voidedAt,
        voidReason: item.voidReason,
      }))
      .reverse()
  },

  async voidPayment(paymentId, reason) {
    requireOwner()
    await pause()
    if (reason.trim().length < 3) throw new Error('Give a reason for voiding this payment')
    const payment = payments.find((item) => item.id === paymentId)
    if (!payment) throw new Error('Payment not found')
    if (!live(payment)) throw new Error('This payment is already voided')
    payment.voidedAt = new Date().toISOString()
    payment.voidReason = reason.trim()
    log('void', `Voided ${payment.planName} for ${payment.payer}: ${reason.trim()}`, payment.amountCentavos)
    // Cancel the membership this payment paid for.
    const index = memberships.findIndex((item) => item.id === payment.membershipId)
    if (index >= 0) memberships.splice(index, 1)
  },

  async listExpenses(days) {
    requireOwner()
    await pause()
    return expenses.filter((item) => withinDays(item.spentOn, days))
  },

  async addExpense({ category, amountCentavos, spentOn, note }) {
    requireOwner()
    await pause()
    if (category.trim().length < 2) throw new Error('Enter what the expense was for')
    if (!(amountCentavos > 0)) throw new Error('Enter an amount above zero')
    expenses.unshift({
      id: newId(),
      category: category.trim(),
      amountCentavos,
      spentOn,
      note: note.trim() || null,
      voidedAt: null,
    })
    log('expense', category.trim() + (note.trim() ? `: ${note.trim()}` : ''), amountCentavos)
  },

  async voidExpense(expenseId, reason) {
    requireOwner()
    await pause()
    if (reason.trim().length < 3) throw new Error('Give a reason for voiding this expense')
    const expense = expenses.find((item) => item.id === expenseId && item.voidedAt === null)
    if (!expense) throw new Error('Expense not found or already voided')
    expense.voidedAt = new Date().toISOString()
    log('void', `Voided expense ${expense.category}: ${reason.trim()}`, expense.amountCentavos)
  },

  async listCloses() {
    requireOwner()
    await pause()
    return closes
  },

  async listStaffAccounts() {
    requireOwner()
    await pause()
    return staffAccounts.map((account) => ({ ...account }))
  },

  async addStaffAccount({ fullName, email, password, role }) {
    requireOwner()
    await pause()
    if (fullName.trim().length < 2) throw new Error('Enter their full name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.')
    if (password.length < 10) throw new Error('Use a password of at least 10 characters.')
    staffAccounts.push({ id: newId(), fullName: fullName.trim(), role, active: true })
    log('settings', `Added account ${fullName.trim()}`)
  },

  async setStaffPassword(_staffId, password) {
    requireOwner()
    await pause()
    if (password.length < 10) throw new Error('Use a password of at least 10 characters.')
  },

  async setStaffActive(staffId, active) {
    const current = requireOwner()
    await pause()
    if (staffId === current.userId && !active) throw new Error("You can't turn off your own account.")
    const account = staffAccounts.find((item) => item.id === staffId)
    if (account) account.active = active
  },

  async listEmployees() {
    requireOwner()
    await pause()
    return [...employees].sort((a, b) => Number(b.active) - Number(a.active) || a.fullName.localeCompare(b.fullName))
  },

  async saveEmployee(input, id) {
    requireOwner()
    await pause()
    if (input.fullName.trim().length < 2) throw new Error('Enter the employee name')
    if (input.jobTitle.trim().length < 2) throw new Error('Enter the position')
    if (!(input.monthlyRateCentavos > 0)) throw new Error('Enter a monthly rate above zero')
    const row = { ...input, fullName: input.fullName.trim(), jobTitle: input.jobTitle.trim() }
    const existing = id ? employees.find((item) => item.id === id) : undefined
    if (existing) {
      Object.assign(existing, row)
      log('settings', `Changed employee ${row.fullName}`)
    } else {
      employees.push({ id: newId(), ...row })
      log('settings', `Added employee ${row.fullName}`)
    }
  },

  async listPayroll(periodMonth) {
    requireOwner()
    await pause()
    return payroll
      .filter((item) => item.periodMonth === periodMonth && item.voidedAt === null)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  },

  async savePayroll({ employeeId, periodMonth, grossCentavos, otherCentavos, otherNote }) {
    requireOwner()
    await pause()
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee) throw new Error('Employee not found')
    if (!(grossCentavos > 0)) throw new Error('Enter the gross pay')
    const deductions = computeDeductions(grossCentavos, employee.withContributions)
    const net = netPay(grossCentavos, deductions, otherCentavos)
    if (net < 0) throw new Error('Deductions are more than the gross pay')
    const existing = payroll.find(
      (item) => item.employeeId === employeeId && item.periodMonth === periodMonth && item.voidedAt === null,
    )
    if (existing?.status === 'paid') throw new Error('This month is already paid. Void it first to change it.')
    const values = {
      grossCentavos,
      deductions,
      otherCentavos,
      otherNote: otherNote.trim() || null,
      netCentavos: net,
    }
    if (existing) {
      Object.assign(existing, values)
      log('payroll', `Recalculated pay for ${employee.fullName}`, net)
    } else {
      payroll.push({
        id: newId(),
        employeeId,
        employeeName: employee.fullName,
        jobTitle: employee.jobTitle,
        periodMonth,
        status: 'draft',
        paidAt: null,
        voidedAt: null,
        ...values,
      })
      log('payroll', `Drafted pay for ${employee.fullName}`, net)
    }
  },

  async markPayrollPaid(entryId) {
    requireOwner()
    await pause()
    const entry = payroll.find((item) => item.id === entryId && item.status === 'draft' && item.voidedAt === null)
    if (!entry) throw new Error('Entry not found, already paid, or voided')
    entry.status = 'paid'
    entry.paidAt = new Date().toISOString()
    log('payroll', `Paid ${entry.employeeName}`, entry.netCentavos)
  },

  async voidPayroll(entryId, reason) {
    requireOwner()
    await pause()
    if (reason.trim().length < 3) throw new Error('Give a reason for voiding this entry')
    const entry = payroll.find((item) => item.id === entryId && item.voidedAt === null)
    if (!entry) throw new Error('Entry not found or already voided')
    entry.voidedAt = new Date().toISOString()
    log('payroll', `Voided pay for ${entry.employeeName}: ${reason.trim()}`, entry.netCentavos)
  },

  async activity({ limit, before, kind }) {
    requireOwner()
    await pause()
    return activityLog
      .filter((item) => (!before || item.at < before) && (!kind || item.kind === kind))
      .slice(0, limit)
  },

  async monthlyReport(months) {
    requireOwner()
    await pause()
    const thisMonth = manilaToday().slice(0, 8) + '01'
    return Array.from({ length: months }, (_, index) => {
      const date = new Date(thisMonth + 'T00:00:00Z')
      date.setUTCMonth(date.getUTCMonth() - (months - 1 - index))
      const month = date.toISOString().slice(0, 10)
      if (month === thisMonth) {
        const prefix = month.slice(0, 7)
        return {
          month,
          revenueCentavos: payments
            .filter((item) => live(item) && item.day.startsWith(prefix))
            .reduce((sum, item) => sum + item.amountCentavos, 0),
          expensesCentavos: expenses
            .filter((item) => item.voidedAt === null && item.spentOn.startsWith(prefix))
            .reduce((sum, item) => sum + item.amountCentavos, 0),
          payrollCentavos: payroll
            .filter((item) => item.voidedAt === null && item.status === 'paid' && item.periodMonth === month)
            .reduce((sum, item) => sum + item.grossCentavos + employerShare(item.deductions), 0),
          checkins: checkins.filter((item) => item.day.startsWith(prefix)).length,
          newMembers: 0,
        }
      }
      // Made-up history for earlier months, steady from one reload to the next.
      const seed = date.getUTCMonth() + 1
      return {
        month,
        revenueCentavos: 9000000 + ((seed * 7919) % 13) * 450000,
        expensesCentavos: 4200000 + ((seed * 31) % 7) * 150000,
        payrollCentavos: 5600000,
        checkins: 700 + ((seed * 17) % 11) * 25,
        newMembers: 8 + ((seed * 13) % 9),
      }
    })
  },

  async exportTable(table) {
    requireOwner()
    await pause()
    const tables: Record<string, unknown[]> = {
      members,
      plans,
      memberships,
      payments,
      checkins,
      expenses,
      daily_closes: closes,
      staff: Object.values(users),
      employees,
      payroll_entries: payroll,
    }
    return (tables[table] ?? []) as Record<string, unknown>[]
  },

  async todaySummary() {
    const current = requireSession()
    await pause()
    const today = manilaToday()
    return {
      // Like the database: the owner sees the gym total, staff see their own collections.
      collectedCentavos: payments
        .filter(
          (item) => live(item) && item.day === today && (current.role === 'owner' || item.receivedBy === current.userId),
        )
        .reduce((sum, item) => sum + item.amountCentavos, 0),
      checkins: checkins.filter((item) => item.day === today).length,
      expiring: members
        .map(toMember)
        .filter((item) => item.status === 'expiring')
        .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
    }
  },
}
