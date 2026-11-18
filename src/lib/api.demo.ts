import { addDays, daysBetween, manilaToday, membershipEnd } from './dates'
import { searchTerm } from './format'
import type { Api, Member, MembershipRecord, PaymentMethod, Plan, Role, Session } from './types'

// Demo data layer, used when no database is connected. Everything lives in
// memory and resets on reload. It follows the same rules as the database
// functions so the screens behave the same way, but it is NOT the source of
// truth: the real rules are enforced in supabase/migrations.

type DemoMember = { id: string; memberNo: number; fullName: string; phone: string }
type DemoMembership = MembershipRecord & { memberId: string; planId: string }
type DemoCheckin = { id: string; memberId: string | null; day: string; checkedInAt: string; status: string }
type DemoPayment = { amountCentavos: number; gcashRef: string | null; receivedBy: string; day: string }

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
let session: Session | null = null

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

function takePayment(soldPlan: Plan, method: PaymentMethod, gcashRef: string, studentIdChecked: boolean) {
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
    if (payments.some((item) => item.gcashRef === reference)) {
      throw new Error('That GCash reference number is already recorded')
    }
  }
  payments.push({
    amountCentavos: soldPlan.priceCentavos,
    gcashRef: reference,
    receivedBy: requireSession().userId,
    day: manilaToday(),
  })
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
    }
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

    takePayment(soldPlan, method, gcashRef, studentIdChecked)
    memberships.push({ id: newId(), memberId, planId, planName: soldPlan.name, startDate, endDate, kind })
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
    takePayment(soldPlan, method, gcashRef, studentIdChecked)
    if (memberId) {
      memberships.push({
        id: newId(),
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
    return { status, alreadyCheckedIn: false, checkedInAt }
  },

  async todaySummary() {
    const current = requireSession()
    await pause()
    const today = manilaToday()
    return {
      // Like the database: the owner sees the gym total, staff see their own collections.
      collectedCentavos: payments
        .filter((item) => item.day === today && (current.role === 'owner' || item.receivedBy === current.userId))
        .reduce((sum, item) => sum + item.amountCentavos, 0),
      checkins: checkins.filter((item) => item.day === today).length,
      expiring: members
        .map(toMember)
        .filter((item) => item.status === 'expiring')
        .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
    }
  },
}
