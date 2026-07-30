// CCC Custom Icon System
// 100% original SVG icons — CCC signature style
// Orange dot accent · 1.75px rounded strokes · Automotive personality
// Usage: import { HomeIcon, ServicesIcon } from "../lib/cccIcons"

const defaultProps = {
  size: 24,
  color: "#64748B",
  activeColor: "#e6821e",
  active: false,
}

export function HomeIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 13L14 4L24 13V23C24 23.6 23.5 24 23 24H18V18H10V24H5C4.5 24 4 23.6 4 23V13Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      {active && <circle cx="21" cy="7" r="2.5" fill={c}/>}
    </svg>
  )
}

export function ServicesIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M18 6C16 4 13 4 11 6C9 8 9.5 11 11 12.5L5 19C4.4 19.6 4.4 20.6 5 21.2L6.8 23C7.4 23.6 8.4 23.6 9 23L16 17C17.5 18.5 20.5 19 22.5 17C24.5 15 24 12 22 10L19.5 12.5L17 10L18 6Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      {active && <circle cx="22" cy="6" r="2.5" fill={c}/>}
    </svg>
  )
}

export function BookingsIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="4" y="6" width="20" height="18" rx="3" stroke={c} strokeWidth="1.75"/>
      <path d="M4 11H24" stroke={c} strokeWidth="1.75"/>
      <path d="M9 4V8M19 4V8" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="9" cy="16" r="1.5" fill={c}/>
      <circle cx="14" cy="16" r="1.5" fill={c}/>
      <circle cx="19" cy="16" r="1.5" stroke={c} strokeWidth="1.2"/>
    </svg>
  )
}

export function PaymentsIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="7" width="22" height="14" rx="3" stroke={c} strokeWidth="1.75"/>
      <path d="M3 11H25" stroke={c} strokeWidth="1.75"/>
      <rect x="6" y="15" width="5" height="2.5" rx="1" fill={c}/>
      <circle cx="21" cy="16" r="2.5" fill={c} opacity="0.3"/>
      <circle cx="19" cy="16" r="2.5" fill={c}/>
    </svg>
  )
}

export function ProfileIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="10" r="4.5" stroke={c} strokeWidth="1.75"/>
      <path d="M5 23C5 19.1 9 16 14 16C19 16 23 19.1 23 23" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      {active && <circle cx="21" cy="8" r="2.5" fill={c}/>}
    </svg>
  )
}

export function MarketplaceIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 5H6L8.5 16H21L23 9H10" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="20" r="2" stroke={c} strokeWidth="1.75"/>
      <circle cx="19" cy="20" r="2" stroke={c} strokeWidth="1.75"/>
      {active && <circle cx="23" cy="5" r="2.5" fill={c}/>}
    </svg>
  )
}

export function ChatIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 6C4 5.4 4.4 5 5 5H23C23.6 5 24 5.4 24 6V17C24 17.6 23.6 18 23 18H9L4 23V6Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <circle cx="9" cy="11.5" r="1.2" fill={c}/>
      <circle cx="14" cy="11.5" r="1.2" fill={c}/>
      <circle cx="19" cy="11.5" r="1.2" fill={c}/>
    </svg>
  )
}

export function NotificationsIcon({ size=24, color="#64748B", active=false, hasAlert=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 4C10.7 4 8 6.7 8 10V17L5 20H23L20 17V10C20 6.7 17.3 4 14 4Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M11.5 20C11.5 21.4 12.6 22.5 14 22.5C15.4 22.5 16.5 21.4 16.5 20" stroke={c} strokeWidth="1.75"/>
      {hasAlert && <circle cx="20" cy="6" r="3" fill="#e24b4a"/>}
    </svg>
  )
}

export function GOServiceIcon({ size=24, color="#e24b4a", active=false }) {
  const c = color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 18H4C3.4 18 3 17.6 3 17V14L6 8H22L25 14V17C25 17.6 24.6 18 24 18H23" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M3 14H25" stroke={c} strokeWidth="1.75"/>
      <circle cx="8.5" cy="19.5" r="2.5" stroke={c} strokeWidth="1.75"/>
      <circle cx="19.5" cy="19.5" r="2.5" stroke={c} strokeWidth="1.75"/>
      <path d="M11 19.5H17" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M14 4V8M11 5.5L13.5 7.5M17 5.5L14.5 7.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function SearchIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="12" cy="12" r="7" stroke={c} strokeWidth="1.75"/>
      <path d="M17.5 17.5L23 23" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      {active && <circle cx="22" cy="6" r="2.5" fill={c}/>}
    </svg>
  )
}

export function SettingsIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="3.5" stroke={c} strokeWidth="1.75"/>
      <path d="M14 4V6.5M14 21.5V24M4 14H6.5M21.5 14H24M6.8 6.8L8.5 8.5M19.5 19.5L21.2 21.2M6.8 21.2L8.5 19.5M19.5 8.5L21.2 6.8" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function WalletIcon({ size=24, color="#1d9e75", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="7" width="22" height="16" rx="3" stroke={c} strokeWidth="1.75"/>
      <path d="M3 12H25" stroke={c} strokeWidth="1.75"/>
      <rect x="17" y="15" width="6" height="5" rx="2" stroke={c} strokeWidth="1.5"/>
      <circle cx="20" cy="17.5" r="1" fill={c}/>
    </svg>
  )
}

export function LocationIcon({ size=24, color="#e24b4a", active=false }) {
  const c = color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 3C10.1 3 7 6.1 7 10C7 15.3 14 25 14 25C14 25 21 15.3 21 10C21 6.1 17.9 3 14 3Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <circle cx="14" cy="10" r="3" stroke={c} strokeWidth="1.75"/>
    </svg>
  )
}

export function StarIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 4L16.5 10H23L17.5 14L19.5 20.5L14 17L8.5 20.5L10.5 14L5 10H11.5L14 4Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" fill={active ? c : "none"} fillOpacity={active ? "0.15" : "0"}/>
    </svg>
  )
}

export function VehicleIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 17H4C3.4 17 3 16.6 3 16V13.5L6 8H22L25 13.5V16C25 16.6 24.6 17 24 17H23" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M3 13.5H25" stroke={c} strokeWidth="1.75"/>
      <circle cx="8.5" cy="18.5" r="2.5" stroke={c} strokeWidth="1.75"/>
      <circle cx="19.5" cy="18.5" r="2.5" stroke={c} strokeWidth="1.75"/>
      <path d="M11 18.5H17" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M8 8L10 4H18L20 8" stroke={c} strokeWidth="1.5"/>
    </svg>
  )
}

export function ShieldIcon({ size=24, color="#1d9e75", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 3L5 7V14C5 18.4 9 22.5 14 24C19 22.5 23 18.4 23 14V7L14 3Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M9.5 14L12.5 17L18.5 11" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function DriversIcon({ size=24, color="#378add", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="9" stroke={c} strokeWidth="1.75"/>
      <circle cx="14" cy="14" r="3" stroke={c} strokeWidth="1.75"/>
      <path d="M14 5V11M14 17V23M5 14H11M17 14H23" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function OrdersIcon({ size=24, color="#378add", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 8L14 4L24 8V20L14 24L4 20V8Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M14 4V24M4 8L14 12L24 8" stroke={c} strokeWidth="1.75"/>
      <path d="M9 10L14 12" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function AnalyticsIcon({ size=24, color="#8b5cf6", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 22H24" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <rect x="5" y="14" width="4" height="8" rx="1.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.15"/>
      <rect x="12" y="9" width="4" height="13" rx="1.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.15"/>
      <rect x="19" y="5" width="4" height="17" rx="1.5" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.3"/>
      <path d="M7 13L12 9L16 12L22 5" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function FilterIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 7H24M7 14H21M10 21H18" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="10" cy="7" r="2.5" fill="white" stroke={c} strokeWidth="1.5"/>
      <circle cx="18" cy="14" r="2.5" fill="white" stroke={c} strokeWidth="1.5"/>
      <circle cx="14" cy="21" r="2.5" fill="white" stroke={c} strokeWidth="1.5"/>
    </svg>
  )
}

export function LogoutIcon({ size=24, color="#e24b4a", active=false }) {
  const c = color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M11 24H6C5.4 24 5 23.6 5 23V5C5 4.4 5.4 4 6 4H11" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M18 19L23 14L18 9" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M23 14H11" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function HelpIcon({ size=24, color="#378add", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={c} strokeWidth="1.75"/>
      <path d="M10.5 10.5C10.5 8.6 12.1 7 14 7C15.9 7 17.5 8.6 17.5 10.5C17.5 12 16.5 13.3 15 13.8V15.5" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="19" r="1.5" fill={c}/>
    </svg>
  )
}

export function ReceiptIcon({ size=24, color="#1d9e75", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M6 4H22V24L19 22L16 24L14 22L12 24L9 22L6 24V4Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M10 10H18M10 14H18M10 18H15" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function CameraIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="8" width="22" height="17" rx="3" stroke={c} strokeWidth="1.75"/>
      <circle cx="14" cy="16.5" r="4" stroke={c} strokeWidth="1.75"/>
      <path d="M10 8L11.5 5H16.5L18 8" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <circle cx="21" cy="12" r="1.5" fill={c}/>
    </svg>
  )
}

export function PartsIcon({ size=24, color="#8b5cf6", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="4" stroke={c} strokeWidth="1.75"/>
      <path d="M14 4V7M14 21V24M4 14H7M21 14H24M6.8 6.8L9 9M19 19L21.2 21.2M21.2 6.8L19 9M9 19L6.8 21.2" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function MechanicIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="8" r="4" stroke={c} strokeWidth="1.75"/>
      <path d="M6 23V21C6 18.2 9.6 16 14 16C18.4 16 22 18.2 22 21V23" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M18 13L20 15L24 11" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Back/Arrow icons
export function BackIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M18 6L10 14L18 22" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function ArrowRightIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M10 6L18 14L10 22" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function CloseIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M7 7L21 21M21 7L7 21" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function CheckIcon({ size=24, color="#1d9e75" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 14L11 20L23 8" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function PhoneIcon({ size=24, color="#1d9e75" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M8 4H12L14 9L11.5 10.5C13 13.5 15 15.5 18 17L19.5 14.5L24 16.5V20.5C24 21.3 23.3 22 22.5 22C12.5 22 6 15.5 6 5.5C6 4.7 6.7 4 7.5 4H8Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
    </svg>
  )
}

export function ShareIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="21" cy="6" r="3" stroke={color} strokeWidth="1.75"/>
      <circle cx="21" cy="22" r="3" stroke={color} strokeWidth="1.75"/>
      <circle cx="7" cy="14" r="3" stroke={color} strokeWidth="1.75"/>
      <path d="M10 12.5L18 7.5M10 15.5L18 20.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function EditIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M19 4L24 9L10 23H5V18L19 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M16 7L21 12" stroke={color} strokeWidth="1.75"/>
    </svg>
  )
}

export function DeleteIcon({ size=24, color="#e24b4a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 8H23M10 8V6H18V8M9 8L10 23H18L19 8" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 12V19M16 12V19" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function UploadIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 4L9 9H12V18H16V9H19L14 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M5 21H23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function ReportsIcon({ size=24, color="#8b5cf6", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 22H24" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M4 18L9 12L13 15L18 8L24 12" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 8H24V12" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function SecurityIcon({ size=24, color="#e24b4a", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="5" y="12" width="18" height="13" rx="3" stroke={c} strokeWidth="1.75"/>
      <path d="M9 12V9C9 6.2 11.2 4 14 4C16.8 4 19 6.2 19 9V12" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="18.5" r="2.5" fill={c} opacity="0.3" stroke={c} strokeWidth="1.5"/>
    </svg>
  )
}
