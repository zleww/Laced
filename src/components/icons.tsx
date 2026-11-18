import type { ReactNode } from 'react'

// One outline icon style for the whole app: 24px grid, 1.75 stroke, round caps.
// Icons size themselves to the text around them unless a className says otherwise.
type IconProps = { className?: string }

function Icon({ children, className = 'size-[1.15em]' }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 6.5 9.5 17 4 11.5" />
  </Icon>
)

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
)

export const MinusCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7" />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
)

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </Icon>
)

export const CheckCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
  </Icon>
)

export const UsersIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 19c.6-3 3-4.75 6-4.75S14.400 16 15 19" />
    <path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8M17.500 14.600c1.900.600 3.100 2.100 3.500 4.400" />
  </Icon>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m14.500 6-6 6 6 6" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const GridIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
)

export const WalletIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1 1 0 0 1 1 1v2" />
    <path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19H19a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.500Z" />
    <path d="M16 13.500h.01" />
  </Icon>
)

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.75" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </Icon>
)

export const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.500a7.800 7.800 0 1 0 9.700 9.700Z" />
  </Icon>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 18.500V5.500M6.500 11 12 5.500 17.500 11" />
  </Icon>
)

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5.500v13M6.500 13l5.500 5.500 5.500-5.500" />
  </Icon>
)

export const LogOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 4.500H6.500a1.500 1.500 0 0 0-1.500 1.500v12a1.500 1.500 0 0 0 1.500 1.500H10M15 8l4 4-4 4M19 12H9.500" />
  </Icon>
)
