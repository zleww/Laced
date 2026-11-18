// Shapes the screens work with. The data layer converts database rows into these.

export type Role = 'owner' | 'staff'

export type Session = {
  userId: string
  fullName: string
  role: Role
}

export type MemberStatus = 'active' | 'expiring' | 'expired' | 'none'

export type Member = {
  id: string
  memberNo: number
  fullName: string
  phone: string
  status: MemberStatus
  validUntil: string | null // YYYY-MM-DD
  daysLeft: number | null
  planId: string | null
  planName: string | null
}

export type Plan = {
  id: string
  code: string
  name: string
  category: 'regular' | 'student' | 'trainer' | 'promo'
  durationDays: number | null
  durationMonths: number | null
  bonusMonths: number
  priceCentavos: number
}

export type PaymentMethod = 'cash' | 'gcash'

export type MembershipRecord = {
  id: string
  planName: string
  startDate: string
  endDate: string
  kind: 'new' | 'renewal' | 'returning' | 'day_pass'
}

export type Visit = {
  id: string
  checkedInAt: string
}

export type MemberDetail = {
  member: Member
  memberships: MembershipRecord[]
  visits: Visit[]
}

export type TodaySummary = {
  collectedCentavos: number
  checkins: number
  expiring: Member[]
}

export type CheckInResult = {
  status: 'active' | 'expiring' | 'expired' | 'day_pass'
  alreadyCheckedIn: boolean
  checkedInAt: string
}

export type SaleResult = {
  amountCentavos: number
  endDate: string | null
}

export type SellMembershipInput = {
  memberId: string
  planId: string
  method: PaymentMethod
  gcashRef: string
  studentIdChecked: boolean
}

export type SellDayPassInput = {
  planId: string
  method: PaymentMethod
  gcashRef: string
  studentIdChecked: boolean
  guestName?: string
  memberId?: string
}

export type RegisterMemberInput = {
  fullName: string
  phone: string
  consent: boolean
}

// Everything the screens can ask for. There are two implementations:
// the real one (Supabase) and a demo one that keeps sample data in memory.
export interface Api {
  mode: 'live' | 'demo'
  getSession(): Promise<Session | null>
  signIn(email: string, password: string): Promise<Session>
  signInDemo(role: Role): Promise<Session>
  signOut(): Promise<void>
  searchMembers(query: string): Promise<Member[]>
  getMember(id: string): Promise<MemberDetail>
  registerMember(input: RegisterMemberInput): Promise<string>
  listPlans(): Promise<Plan[]>
  sellMembership(input: SellMembershipInput): Promise<SaleResult>
  sellDayPass(input: SellDayPassInput): Promise<SaleResult>
  checkIn(memberId: string, overrideReason?: string): Promise<CheckInResult>
  todaySummary(): Promise<TodaySummary>
}
