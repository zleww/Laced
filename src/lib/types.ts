// Shapes the screens work with. The data layer converts database rows into these.

export type Role = 'owner' | 'staff'

export type Session = {
  userId: string
  fullName: string
  role: Role
  /** Signed in with the password, but the authenticator code is still needed. */
  needsCode?: boolean
}

/** After this many wrong passwords on a device, the sign-in screen asks the person to wait. */
export type SignInLimits = {
  maxTries: number
  waitMinutes: number
}

/** A new authenticator app being set up: show the QR code, then confirm with a code. */
export type TwoStepSetup = {
  factorId: string
  /** An image source for the QR code. */
  qrCode: string
  /** The same key as text, for typing into the app by hand. */
  secret: string
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
  /** True once the member has made their own app login. */
  hasAppAccount: boolean
}

/** A one-time code the member types into the member app. Shown once. */
export type AppAccessCode = {
  code: string
  expiresAt: string
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

export type Employee = {
  id: string
  fullName: string
  jobTitle: string
  monthlyRateCentavos: number
  /** Off for workers the gym does not register with SSS, PhilHealth, and Pag-IBIG. */
  withContributions: boolean
  active: boolean
}

/** A login for the app: the owner or a front-desk account. */
export type StaffAccount = {
  id: string
  fullName: string
  role: Role
  active: boolean
}

export type StaffAccountInput = {
  fullName: string
  email: string
  password: string
  role: Role
}

export type EmployeeInput = Omit<Employee, 'id'>

/** One month's government deductions, in centavos. "Ee" is the employee's share, "Er" the gym's. */
export type Deductions = {
  sssEe: number
  sssEr: number
  sssEc: number
  philhealthEe: number
  philhealthEr: number
  pagibigEe: number
  pagibigEr: number
  tax: number
}

export type PayrollEntry = {
  id: string
  employeeId: string
  employeeName: string
  jobTitle: string
  periodMonth: string // YYYY-MM-01
  grossCentavos: number
  deductions: Deductions
  otherCentavos: number
  otherNote: string | null
  netCentavos: number
  status: 'draft' | 'paid'
  paidAt: string | null
}

export type PayrollInput = {
  employeeId: string
  periodMonth: string
  grossCentavos: number
  otherCentavos: number
  otherNote: string
}

export type ActivityKind = 'sale' | 'void' | 'expense' | 'close' | 'member' | 'checkin' | 'payroll' | 'settings'

export type ActivityItem = {
  at: string
  actor: string
  kind: ActivityKind
  summary: string
  amountCentavos: number | null
}

/** One Manila month on the Reports screen. */
export type MonthStat = {
  month: string // YYYY-MM-01
  revenueCentavos: number
  expensesCentavos: number
  /** Gross pay plus the gym's share of contributions, for paid entries. */
  payrollCentavos: number
  checkins: number
  newMembers: number
}

/** Tables the owner can download for a backup or a spreadsheet. */
export type ExportTable =
  | 'members'
  | 'plans'
  | 'memberships'
  | 'payments'
  | 'checkins'
  | 'expenses'
  | 'daily_closes'
  | 'staff'
  | 'employees'
  | 'payroll_entries'

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
  /** Readable before sign-in. Falls back to 5 tries and 10 minutes. */
  signInLimits(): Promise<SignInLimits>
  saveSignInLimits(limits: SignInLimits): Promise<void>
  /** Second step of sign-in: the 6-digit code from the authenticator app. */
  verifySignInCode(code: string): Promise<Session>
  /** Whether this account has an authenticator app turned on. */
  twoStepStatus(): Promise<{ on: boolean }>
  startTwoStep(): Promise<TwoStepSetup>
  confirmTwoStep(factorId: string, code: string): Promise<void>
  turnOffTwoStep(): Promise<void>
  searchMembers(query: string): Promise<Member[]>
  getMember(id: string): Promise<MemberDetail>
  registerMember(input: RegisterMemberInput): Promise<string>
  /** Owner only: wipes the name and phone, keeps the money records. */
  deleteMemberData(memberId: string, reason: string): Promise<void>
  /** Makes a one-time code so a member can create their app login. */
  giveAppAccess(memberId: string): Promise<AppAccessCode>
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

  listStaffAccounts(): Promise<StaffAccount[]>
  /** Creates a login and its staff row. Runs on the server, where the secret key lives. */
  addStaffAccount(input: StaffAccountInput): Promise<void>
  setStaffPassword(staffId: string, password: string): Promise<void>
  /** Turning an account off locks it out of the app and of Supabase. */
  setStaffActive(staffId: string, active: boolean): Promise<void>

  listEmployees(): Promise<Employee[]>
  /** Adds an employee, or updates one when an id is given. */
  saveEmployee(input: EmployeeInput, id?: string): Promise<void>
  /** Entries for one month (YYYY-MM-01), voided ones left out. */
  listPayroll(periodMonth: string): Promise<PayrollEntry[]>
  /** Creates or recalculates a draft. The database works out the deductions. */
  savePayroll(input: PayrollInput): Promise<void>
  markPayrollPaid(entryId: string): Promise<void>
  voidPayroll(entryId: string, reason: string): Promise<void>

  activity(options: { limit: number; before?: string; kind?: ActivityKind }): Promise<ActivityItem[]>
  monthlyReport(months: number): Promise<MonthStat[]>
  /** Every row of a table, as stored, for CSV export and backups. */
  exportTable(table: ExportTable): Promise<Record<string, unknown>[]>
}
