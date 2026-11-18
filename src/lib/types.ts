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

/** One Manila day on the owner dashboard. */
export type DayStat = {
  day: string // YYYY-MM-DD
  revenueCentavos: number
  checkins: number
}

/** Totals for the owner's Money screen. */
export type MoneySummary = {
  revenueCentavos: number
  cashCentavos: number
  gcashCentavos: number
  expensesCentavos: number
  voidCount: number
}

export type PlanRevenue = {
  planName: string
  revenueCentavos: number
  sales: number
}

export type PaymentRecord = {
  id: string
  paidAt: string
  payer: string
  planName: string
  amountCentavos: number
  method: PaymentMethod
  gcashRef: string | null
  receivedBy: string
  voidedAt: string | null
  voidReason: string | null
}

export type ExpenseRecord = {
  id: string
  category: string
  amountCentavos: number
  spentOn: string
  note: string | null
  voidedAt: string | null
}

export type ExpenseInput = {
  category: string
  amountCentavos: number
  spentOn: string
  note: string
}

export type DayClose = {
  id: string
  closeDate: string
  expectedCashCentavos: number
  countedCashCentavos: number
  expectedGcashCentavos: number
  countedGcashCentavos: number
  closedBy: string
  note: string | null
}

export type CloseDayInput = {
  countedCashCentavos: number
  countedGcashCentavos: number
  note: string
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
  /** Owner only: the last `days` days, oldest first. Staff get an empty list. */
  dailyStats(days: number): Promise<DayStat[]>

  /** Whether today has been closed already. */
  isDayClosed(): Promise<boolean>
  /** A blind count: the result does not say what the records expected. */
  closeDay(input: CloseDayInput): Promise<void>

  // Owner only from here down.
  moneySummary(days: number): Promise<MoneySummary>
  planRevenue(days: number): Promise<PlanRevenue[]>
  listPayments(days: number): Promise<PaymentRecord[]>
  voidPayment(paymentId: string, reason: string): Promise<void>
  listExpenses(days: number): Promise<ExpenseRecord[]>
  addExpense(input: ExpenseInput): Promise<void>
  voidExpense(expenseId: string, reason: string): Promise<void>
  listCloses(): Promise<DayClose[]>
}
