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

export function TripReportIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 4H19L23 8V24H5V4Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M19 4V8H23" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M9 12H19M9 16H16M9 20H13" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="21" cy="6" r="2.5" fill={c}/>
    </svg>
  )
}

export function LoyaltyIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 5C14 5 7 9 7 15C7 18.3 10.1 21 14 21C17.9 21 21 18.3 21 15C21 9 14 5 14 5Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M14 21V25" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M10 25H18" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M11 14L13 16L17 12" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="21" cy="6" r="2.5" fill={c}/>
    </svg>
  )
}

export function FavoritesIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 22C14 22 4 16 4 10C4 7.2 6.2 5 9 5C11 5 12.8 6.1 14 7.8C15.2 6.1 17 5 19 5C21.8 5 24 7.2 24 10C24 16 14 22 14 22Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" fill={active ? c : "none"} fillOpacity={active ? "0.15" : "0"}/>
      <circle cx="21" cy="6" r="2.5" fill={c}/>
    </svg>
  )
}

export function ReferEarnIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="8" cy="9" r="3.5" stroke={c} strokeWidth="1.75"/>
      <circle cx="20" cy="6" r="3.5" stroke={c} strokeWidth="1.75"/>
      <circle cx="20" cy="21" r="3.5" stroke={c} strokeWidth="1.75"/>
      <path d="M11.5 10.5L16.5 8M11.5 11.5L16.5 19.5" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M6 18C6 15.8 6.9 14 8 14C9.1 14 10 15.8 10 18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function VehicleReportIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 16H4C3.4 16 3 15.6 3 15V12.5L6 8H17" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M3 12.5H17" stroke={c} strokeWidth="1.75"/>
      <circle cx="8" cy="17.5" r="2.5" stroke={c} strokeWidth="1.75"/>
      <path d="M10.5 17.5H14" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M17 6H23V20H17" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M19 10H21M19 13H21M19 16H21" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="22" cy="5" r="2.5" fill={c}/>
    </svg>
  )
}

export function ServiceGuaranteeIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 3L5 7V14C5 18.4 9 22.5 14 24C19 22.5 23 18.4 23 14V7L14 3Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" fill={active ? c : "none"} fillOpacity={active ? "0.1" : "0"}/>
      <path d="M9.5 14L12.5 17L18.5 11" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 7V10" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="21" cy="5" r="2.5" fill={c}/>
    </svg>
  )
}

export function MyListingsIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="4" y="4" width="9" height="9" rx="2" stroke={c} strokeWidth="1.75"/>
      <rect x="15" y="4" width="9" height="9" rx="2" stroke={c} strokeWidth="1.75"/>
      <rect x="4" y="15" width="9" height="9" rx="2" stroke={c} strokeWidth="1.75"/>
      <rect x="15" y="15" width="9" height="9" rx="2" stroke={c} strokeWidth="1.75"/>
      <circle cx="22" cy="5" r="2.5" fill={c}/>
    </svg>
  )
}

export function MyTransactionsIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 8H24M4 8L7 5M4 8L7 11" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 20H4M24 20L21 17M24 20L21 23" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="22" cy="6" r="2.5" fill={c}/>
    </svg>
  )
}

export function TruckDriverIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M3 17H2C1.4 17 1 16.6 1 16V10L4 5H16V17H3Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M16 8H21L25 13V17H16V8Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M1 12H16" stroke={c} strokeWidth="1.75"/>
      <circle cx="6" cy="19" r="2.5" stroke={c} strokeWidth="1.75"/>
      <circle cx="19" cy="19" r="2.5" stroke={c} strokeWidth="1.75"/>
      <path d="M8.5 19H16.5" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="23" cy="6" r="2.5" fill={c}/>
    </svg>
  )
}

export function DiscoverIcon({ size=24, color="#64748B", active=false }) {
  const c = active ? "#e6821e" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={c} strokeWidth="1.75"/>
      <path d="M14 4C14 4 10 8 10 14C10 20 14 24 14 24" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 4C14 4 18 8 18 14C18 20 14 24 14 24" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 14H24" stroke={c} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="21" cy="6" r="2.5" fill={c}/>
    </svg>
  )
}

export function RefreshIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 14C4 8.5 8.5 4 14 4C17.5 4 20.6 5.7 22.5 8.3" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M24 14C24 19.5 19.5 24 14 24C10.5 24 7.4 22.3 5.5 19.7" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M22 4L22.5 8.3L18.5 8" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 24L5.5 19.7L9.5 20" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function UploadShareIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 4L9 9H12V18H16V9H19L14 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M5 21H23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M5 17V21H23V17" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function DownloadIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 4V18M9 13L14 18L19 13" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 21H23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function EmailIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="6" width="22" height="16" rx="3" stroke={color} strokeWidth="1.75"/>
      <path d="M3 9L14 16L25 9" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function LinkIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M11 17L17 11" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M13 7L15 5C17.2 2.8 20.8 2.8 23 5C25.2 7.2 25.2 10.8 23 13L21 15" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M15 21L13 23C10.8 25.2 7.2 25.2 5 23C2.8 20.8 2.8 17.2 5 15L7 13" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function TipIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 3C10.1 3 7 6.1 7 10C7 12.8 8.6 15.2 11 16.5V19H17V16.5C19.4 15.2 21 12.8 21 10C21 6.1 17.9 3 14 3Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M11 19H17M11 22H17" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="10" r="2" fill={color} opacity="0.3"/>
    </svg>
  )
}

export function WarningIcon({ size=24, color="#e6821e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 3L25 23H3L14 3Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M14 11V16" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="20" r="1.2" fill={color}/>
    </svg>
  )
}

export function SuccessIcon({ size=24, color="#1d9e75" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="1.75"/>
      <path d="M8.5 14L12 17.5L19.5 10" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function ErrorIcon({ size=24, color="#e24b4a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="1.75"/>
      <path d="M10 10L18 18M18 10L10 18" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function BankIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M3 11L14 4L25 11H3Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M3 11H25M3 24H25" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M6 11V24M11 11V24M17 11V24M22 11V24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function QRCodeIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="3" width="9" height="9" rx="1.5" stroke={color} strokeWidth="1.75"/>
      <rect x="16" y="3" width="9" height="9" rx="1.5" stroke={color} strokeWidth="1.75"/>
      <rect x="3" y="16" width="9" height="9" rx="1.5" stroke={color} strokeWidth="1.75"/>
      <rect x="5.5" y="5.5" width="4" height="4" rx="0.5" fill={color}/>
      <rect x="18.5" y="5.5" width="4" height="4" rx="0.5" fill={color}/>
      <rect x="5.5" y="18.5" width="4" height="4" rx="0.5" fill={color}/>
      <path d="M16 16H19V19H16ZM19 19H22V22H19ZM16 22H19V25H16ZM22 16H25V19H22Z" fill={color}/>
    </svg>
  )
}

export function DeliveryIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M2 17H1C0.4 17 0 16.6 0 16V10L3 5H15V17H2Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M15 8H20L24 13V17H15V8Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M0 12H15" stroke={color} strokeWidth="1.75"/>
      <circle cx="5" cy="19" r="2.5" stroke={color} strokeWidth="1.75"/>
      <circle cx="18" cy="19" r="2.5" stroke={color} strokeWidth="1.75"/>
      <path d="M7.5 19H15.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function TeamIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="10" cy="9" r="3.5" stroke={color} strokeWidth="1.75"/>
      <circle cx="19" cy="9" r="3" stroke={color} strokeWidth="1.75"/>
      <path d="M2 23C2 19.1 5.6 16 10 16C14.4 16 18 19.1 18 23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M19 15C21.8 15 24 17.2 24 20V23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function NoteIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M6 4H22V24H6V4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M10 10H18M10 14H18M10 18H15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 4V8" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M18 4V8" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function KeyIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="10" cy="11" r="5.5" stroke={color} strokeWidth="1.75"/>
      <path d="M14.5 14.5L24 24" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M19 19L22 16" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="10" cy="11" r="2" fill={color} opacity="0.3"/>
    </svg>
  )
}

export function FuelIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 24V6C5 5.4 5.4 5 6 5H16C16.6 5 17 5.4 17 6V14" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 24H17" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M17 10L21 8V18C21 19.1 20.1 20 19 20H17" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10H14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="21" cy="6" r="2.5" fill={color}/>
    </svg>
  )
}

export function BatteryIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="2" y="9" width="21" height="10" rx="2.5" stroke={color} strokeWidth="1.75"/>
      <path d="M23 12V16" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="4.5" y="11.5" width="12" height="5" rx="1" fill={color} opacity="0.3" stroke={color} strokeWidth="1.2"/>
      <path d="M25 13V15" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function TrophyIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M9 4H19V14C19 17.3 16.8 20 14 20C11.2 20 9 17.3 9 14V4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M9 7H5C5 7 4 13 9 14" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M19 7H23C23 7 24 13 19 14" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M14 20V23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M10 23H18" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="21" cy="5" r="2.5" fill={color}/>
    </svg>
  )
}

export function TicketIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M3 10C3 10 5 10 5 8C5 6 3 6 3 6V10Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M25 18C25 18 23 18 23 20C23 22 25 22 25 22V18Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M3 6H25V10C25 10 23 10 23 12C23 14 25 14 25 18H3V14C3 14 5 14 5 12C5 10 3 10 3 6Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M10 12H18M10 15H15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function PayoutIcon({ size=24, color="#1d9e75" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="7" width="22" height="14" rx="3" stroke={color} strokeWidth="1.75"/>
      <path d="M3 11H25" stroke={color} strokeWidth="1.75"/>
      <path d="M14 16L11 19M14 16L17 19M14 16V23" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="21" cy="6" r="2.5" fill={color}/>
    </svg>
  )
}

export function SignalIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="2.5" fill={color}/>
      <path d="M9 19C7.7 17.7 7 15.9 7 14C7 12.1 7.7 10.3 9 9" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M19 9C20.3 10.3 21 12.1 21 14C21 15.9 20.3 17.7 19 19" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M5.5 22.5C3.2 20.2 2 17.2 2 14C2 10.8 3.2 7.8 5.5 5.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M22.5 5.5C24.8 7.8 26 10.8 26 14C26 17.2 24.8 20.2 22.5 22.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function ClockIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="1.75"/>
      <path d="M14 8V14L18 17" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="21" cy="6" r="2.5" fill={color}/>
    </svg>
  )
}

export function LockedIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="5" y="12" width="18" height="13" rx="3" stroke={color} strokeWidth="1.75"/>
      <path d="M9 12V9C9 6.2 11.2 4 14 4C16.8 4 19 6.2 19 9V12" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="18.5" r="2" fill={color}/>
      <path d="M14 18.5V21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function UnlockedIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="5" y="12" width="18" height="13" rx="3" stroke={color} strokeWidth="1.75"/>
      <path d="M9 12V9C9 6.2 11.2 4 14 4C16.8 4 19 6.2 19 9" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="18.5" r="2" fill={color} opacity="0.3" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}

export function EyeIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M3 14C3 14 7 7 14 7C21 7 25 14 25 14C25 14 21 21 14 21C7 21 3 14 3 14Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <circle cx="14" cy="14" r="3.5" stroke={color} strokeWidth="1.75"/>
    </svg>
  )
}

export function EyeOffIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 5L23 23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M10.5 7.5C11.6 7.2 12.8 7 14 7C21 7 25 14 25 14C24.3 15.3 23.4 16.5 22.3 17.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M17 17.5C16.1 18.1 15.1 18.5 14 18.5C11 18.5 8.6 16.5 7.3 15.1C6.4 14.1 5.7 13 5 12" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function MotorcycleIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="6" cy="19" r="3.5" stroke={color} strokeWidth="1.75"/>
      <circle cx="22" cy="19" r="3.5" stroke={color} strokeWidth="1.75"/>
      <path d="M9.5 19H18.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M10 12L14 8H18L22 12L18.5 19" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 12L6 19" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M14 8V12H10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="21" cy="6" r="2.5" fill={color}/>
    </svg>
  )
}

export function BroadcastIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M3 8L14 4L25 8V20L14 24L3 20V8Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M3 8L14 12L25 8" stroke={color} strokeWidth="1.75"/>
      <path d="M14 12V24" stroke={color} strokeWidth="1.75"/>
      <circle cx="14" cy="12" r="2.5" fill={color}/>
    </svg>
  )
}

export function TargetIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="1.75"/>
      <circle cx="14" cy="14" r="6" stroke={color} strokeWidth="1.75"/>
      <circle cx="14" cy="14" r="2.5" fill={color}/>
      <path d="M14 4V8M14 20V24M4 14H8M20 14H24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function PowerIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 4V14" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M9 7.5C6.5 9.2 5 12 5 14.5C5 19.2 9 23 14 23C19 23 23 19.2 23 14.5C23 12 21.5 9.2 19 7.5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="21" cy="5" r="2.5" fill={color}/>
    </svg>
  )
}

export function BadgeIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="11" r="6" stroke={color} strokeWidth="1.75"/>
      <path d="M9.5 16L7 25L14 21L21 25L18.5 16" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M11.5 11L13 12.5L16.5 9" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function AttachmentIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M22 13L13 22C10.8 24.2 7.2 24.2 5 22C2.8 19.8 2.8 16.2 5 14L14 5C15.6 3.4 18.4 3.4 20 5C21.6 6.6 21.6 9.4 20 11L11 20C10 21 8.6 21 7.6 20C6.6 19 6.6 17.6 7.6 16.6L15.5 8.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function SaveIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 4H19L23 8V24H5V4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M9 4V11H19V4" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <rect x="8" y="16" width="12" height="8" rx="1" stroke={color} strokeWidth="1.5"/>
      <path d="M16 4V8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function PrintIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M7 8V4H21V8" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <rect x="3" y="8" width="22" height="12" rx="2" stroke={color} strokeWidth="1.75"/>
      <path d="M7 20V24H21V20" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M10 15H18M10 20H18M10 23H16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="13" r="1.5" fill={color}/>
    </svg>
  )
}

export function GlobeIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="1.75"/>
      <path d="M14 4C14 4 10 8 10 14C10 20 14 24 14 24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 4C14 4 18 8 18 14C18 20 14 24 14 24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 14H24M5 9H23M5 19H23" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function SpeedIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 20C4 13.4 8.5 8 14 8C19.5 8 24 13.4 24 20" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M14 20L10 14" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="14" cy="20" r="2" fill={color}/>
      <path d="M9 10L7 8M19 10L21 8M6 15L4 14M22 15L24 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function PlugIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M10 4V9M18 4V9" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <rect x="7" y="9" width="14" height="8" rx="3" stroke={color} strokeWidth="1.75"/>
      <path d="M14 17V24" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="21" cy="5" r="2.5" fill={color}/>
    </svg>
  )
}

export function BillIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 4H23V24L20 22L17 24L14 22L11 24L8 22L5 24V4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M9 10H19M9 14H19M9 18H15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 7V10M14 14V17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function MovingCarIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M7 16H6C5.4 16 5 15.6 5 15V12.5L8 8H20L23 12.5V15C23 15.6 22.6 16 22 16H21" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M5 12.5H23" stroke={color} strokeWidth="1.75"/>
      <circle cx="9.5" cy="17.5" r="2.5" stroke={color} strokeWidth="1.75"/>
      <circle cx="18.5" cy="17.5" r="2.5" stroke={color} strokeWidth="1.75"/>
      <path d="M12 17.5H16" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M2 10H5M2 13H4M2 16H4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="21" cy="6" r="2.5" fill={color}/>
    </svg>
  )
}

export function SunIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="5" stroke={color} strokeWidth="1.75"/>
      <path d="M14 4V7M14 21V24M4 14H7M21 14H24M6.8 6.8L9 9M19 19L21.2 21.2M21.2 6.8L19 9M9 19L6.8 21.2" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function UsersIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="10" cy="9" r="4" stroke={color} strokeWidth="1.75"/>
      <path d="M2 23C2 19.1 5.6 16 10 16C14.4 16 18 19.1 18 23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M19 12C21.2 12 23 10.2 23 8C23 5.8 21.2 4 19 4" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M22 22C24 21 26 19 26 16C26 14 24.5 12 22.5 12" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function UserPlusIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="11" cy="9" r="4.5" stroke={color} strokeWidth="1.75"/>
      <path d="M3 23C3 19.1 6.6 16 11 16C15.4 16 19 19.1 19 23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M22 9V17M18 13H26" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function ChevronRightIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M11 7L18 14L11 21" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function ChevronDownIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M7 11L14 18L21 11" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function MenuIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M4 8H24M4 14H24M4 20H24" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function PlusIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 5V23M5 14H23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function MinusIcon({ size=24, color="#64748B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 14H23" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  )
}

export function HeartIcon({ size=24, color="#e24b4a", active=false }) {
  const c = active ? "#e24b4a" : color
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 22C14 22 4 16 4 10C4 7.2 6.2 5 9 5C11 5 12.8 6.1 14 7.8C15.2 6.1 17 5 19 5C21.8 5 24 7.2 24 10C24 16 14 22 14 22Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" fill={active ? c : "none"} fillOpacity={active ? "0.2" : "0"}/>
    </svg>
  )
}
