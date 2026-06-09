export default function CCCIcon({ name, size = 24, color = "#e6821e", accent = "#FFA040" }) {
  const s = size
  const icons = {
    home: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 14 L14 28 L14 46 L24 46 L24 36 L36 36 L36 46 L46 46 L46 28 Z" fill={accent} opacity="0.5"/>
        <path d="M30 14 L14 28 L30 28 Z" fill={color} opacity="0.7"/>
        <path d="M30 14 L14 28 L14 46 L24 46 L24 36 L36 36 L36 46 L46 46 L46 28 Z" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
      </svg>
    ),
    bookings: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="14" y="16" width="32" height="28" rx="4" fill={accent} opacity="0.4"/>
        <rect x="14" y="16" width="32" height="10" rx="4" fill={color} opacity="0.6"/>
        <path d="M20 32 L26 38 L36 28" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="20" y="12" width="4" height="8" rx="2" fill={color}/>
        <rect x="36" y="12" width="4" height="8" rx="2" fill={color}/>
      </svg>
    ),
    search: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="26" cy="26" r="11" fill={accent} opacity="0.4"/>
        <circle cx="26" cy="26" r="11" stroke={color} strokeWidth="2.5"/>
        <path d="M34 34 L44 44" stroke={color} strokeWidth="3" strokeLinecap="round"/>
        <circle cx="26" cy="26" r="3" fill={color}/>
      </svg>
    ),
    vehicles: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="8" y="30" width="44" height="18" rx="5" fill={color}/>
        <path d="M14 30 L19 18 L41 18 L46 30Z" fill={accent} opacity="0.8"/>
        <circle cx="16" cy="48" r="6" fill="white" stroke={color} strokeWidth="2.5"/>
        <circle cx="44" cy="48" r="6" fill="white" stroke={color} strokeWidth="2.5"/>
        <circle cx="16" cy="48" r="2" fill={color}/>
        <circle cx="44" cy="48" r="2" fill={color}/>
      </svg>
    ),
    discover: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="16" fill={accent} opacity="0.25"/>
        <circle cx="30" cy="30" r="16" stroke={color} strokeWidth="2"/>
        <path d="M30 14 L30 12 M30 46 L30 48 M14 30 L12 30 M46 30 L48 30" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M22 22 L28 32 L38 24 L32 34 L22 38 L28 28 Z" fill={color} opacity="0.7"/>
        <circle cx="30" cy="30" r="3" fill={color}/>
      </svg>
    ),
    tracking: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 12 C22 12 16 18 16 26 C16 34 30 50 30 50 C30 50 44 34 44 26 C44 18 38 12 30 12Z" fill={accent} opacity="0.5"/>
        <path d="M30 12 C22 12 16 18 16 26 C16 34 30 50 30 50 C30 50 44 34 44 26 C44 18 38 12 30 12Z" stroke={color} strokeWidth="2.5"/>
        <circle cx="30" cy="26" r="6" fill={color}/>
        <circle cx="30" cy="26" r="2.5" fill="white"/>
      </svg>
    ),
    loyalty: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 12 L36 26 L52 28 L41 39 L44 55 L30 47 L16 55 L19 39 L8 28 L24 26Z" fill={accent} opacity="0.4"/>
        <path d="M30 12 L36 26 L52 28 L41 39 L44 55 L30 47 L16 55 L19 39 L8 28 L24 26Z" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="30" cy="12" r="3" fill={color}/>
      </svg>
    ),
    payments: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="10" y="18" width="40" height="28" rx="5" fill={color}/>
        <rect x="10" y="18" width="40" height="10" rx="5" fill={accent} opacity="0.7"/>
        <rect x="16" y="34" width="12" height="4" rx="2" fill="white"/>
        <rect x="32" y="34" width="6" height="4" rx="2" fill="white" opacity="0.6"/>
      </svg>
    ),
    reviews: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 14 L34 24 L45 24 L36 31 L39 42 L30 35 L21 42 L24 31 L15 24 L26 24Z" fill={accent} opacity="0.5"/>
        <path d="M30 14 L34 24 L45 24 L36 31 L39 42 L30 35 L21 42 L24 31 L15 24 L26 24Z" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="30" cy="14" r="3" fill={color}/>
      </svg>
    ),
    favorites: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 44 C30 44 12 32 12 22 C12 16 17 12 22 12 C25 12 28 14 30 16 C32 14 35 12 38 12 C43 12 48 16 48 22 C48 32 30 44 30 44Z" fill={accent} opacity="0.5"/>
        <path d="M30 44 C30 44 12 32 12 22 C12 16 17 12 22 12 C25 12 28 14 30 16 C32 14 35 12 38 12 C43 12 48 16 48 22 C48 32 30 44 30 44Z" stroke={color} strokeWidth="2.5"/>
        <circle cx="30" cy="28" r="3" fill={color}/>
      </svg>
    ),
    referral: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="16" y="24" width="28" height="22" rx="4" fill={color}/>
        <path d="M16 30 L30 38 L44 30" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
        <path d="M22 24 L22 16 L38 16 L38 24" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="30" cy="14" r="4" fill={accent}/>
      </svg>
    ),
    support: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="26" r="13" fill={accent} opacity="0.35"/>
        <circle cx="30" cy="26" r="13" stroke={color} strokeWidth="2.5"/>
        <text x="30" y="33" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>?</text>
        <circle cx="30" cy="44" r="3" fill={color}/>
      </svg>
    ),
    emergency: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="28" r="15" fill={accent} opacity="0.3"/>
        <path d="M30 12 L34 24 L46 24 L36 32 L40 44 L30 36 L20 44 L24 32 L14 24 L26 24Z" fill={color}/>
        <circle cx="30" cy="12" r="4" fill={accent}/>
      </svg>
    ),
    marketplace: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M12 20 L48 20 L44 42 L16 42Z" fill={accent} opacity="0.4"/>
        <path d="M12 20 L48 20 L44 42 L16 42Z" stroke={color} strokeWidth="2"/>
        <path d="M20 20 L16 14 L44 14 L48 20" stroke={color} strokeWidth="2"/>
        <circle cx="22" cy="48" r="4" fill={color}/>
        <circle cx="38" cy="48" r="4" fill={color}/>
      </svg>
    ),
    messages: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="10" y="14" width="40" height="30" rx="6" fill={accent} opacity="0.35"/>
        <rect x="10" y="14" width="40" height="30" rx="6" stroke={color} strokeWidth="2"/>
        <path d="M10 44 L18 36" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M18 28 L36 28 M18 34 L30 34" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    notifications: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 10 C22 10 14 16 14 26 L14 38 L10 44 L50 44 L46 38 L46 26 C46 16 38 10 30 10Z" fill={accent} opacity="0.4"/>
        <path d="M30 10 C22 10 14 16 14 26 L14 38 L10 44 L50 44 L46 38 L46 26 C46 16 38 10 30 10Z" stroke={color} strokeWidth="2"/>
        <path d="M25 44 C25 46.8 27.2 49 30 49 C32.8 49 35 46.8 35 44" stroke={color} strokeWidth="2"/>
        <circle cx="42" cy="14" r="6" fill={color}/>
      </svg>
    ),
    profile: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="22" r="10" fill={accent} opacity="0.5"/>
        <circle cx="30" cy="22" r="10" stroke={color} strokeWidth="2"/>
        <circle cx="30" cy="22" r="4" fill={color}/>
        <path d="M14 48 C14 38 21 32 30 32 C39 32 46 38 46 48" fill={color} opacity="0.6"/>
        <path d="M14 48 C14 38 21 32 30 32 C39 32 46 38 46 48" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    settings: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="11" fill={accent} opacity="0.3"/>
        <circle cx="30" cy="30" r="11" stroke={color} strokeWidth="2"/>
        <circle cx="30" cy="30" r="5" fill={color}/>
        <path d="M30 14 L30 18 M30 42 L30 46 M14 30 L18 30 M42 30 L46 30" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    guarantee: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 10 L46 18 L46 32 C46 40 38 48 30 50 C22 48 14 40 14 32 L14 18Z" fill={accent} opacity="0.35"/>
        <path d="M30 10 L46 18 L46 32 C46 40 38 48 30 50 C22 48 14 40 14 32 L14 18Z" stroke={color} strokeWidth="2"/>
        <path d="M22 30 L27 36 L38 24" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    parts: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M38 14 C38 14 44 21 38 29 L22 45 C20 47 17 47 15 45 C13 43 13 40 15 38 L31 22 C38 17 38 14 38 14Z" fill={accent} opacity="0.5"/>
        <path d="M38 14 C38 14 44 21 38 29 L22 45 C20 47 17 47 15 45 C13 43 13 40 15 38 L31 22 C38 17 38 14 38 14Z" stroke={color} strokeWidth="2"/>
        <circle cx="17" cy="41" r="5" fill={color}/>
        <circle cx="38" cy="14" r="4" fill={accent}/>
      </svg>
    ),
    reports: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="16" y="12" width="28" height="36" rx="4" fill={accent} opacity="0.3"/>
        <rect x="16" y="12" width="28" height="36" rx="4" stroke={color} strokeWidth="2"/>
        <path d="M22 22 L38 22 M22 28 L38 28 M22 34 L32 34" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="38" cy="36" r="6" fill={color}/>
        <path d="M35 36 L37 38 L41 34" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    earnings: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="28" r="14" fill={accent} opacity="0.3"/>
        <circle cx="30" cy="28" r="14" stroke={color} strokeWidth="2"/>
        <path d="M26 22 L26 34 M34 22 L34 34 M22 26 L38 26 M22 30 L38 30" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    analytics: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="12" y="38" width="8" height="12" rx="2" fill={accent}/>
        <rect x="24" y="28" width="8" height="22" rx="2" fill={color}/>
        <rect x="36" y="18" width="8" height="32" rx="2" fill={color}/>
        <rect x="36" y="18" width="8" height="10" rx="2" fill={accent} opacity="0.7"/>
        <path d="M14 36 L28 24 L40 14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="40" cy="14" r="4" fill={color}/>
      </svg>
    ),
    payouts: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="14" y="20" width="32" height="28" rx="5" fill={accent} opacity="0.3"/>
        <rect x="14" y="20" width="32" height="28" rx="5" stroke={color} strokeWidth="2"/>
        <rect x="14" y="26" width="32" height="6" fill={color} opacity="0.3"/>
        <circle cx="30" cy="36" r="5" fill={color}/>
        <circle cx="30" cy="36" r="2" fill={accent}/>
      </svg>
    ),
    mechanics: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="22" cy="20" r="8" fill={accent} opacity="0.4"/>
        <circle cx="22" cy="20" r="8" stroke={color} strokeWidth="2"/>
        <path d="M10 44 C10 36 15 30 22 30 C29 30 34 36 34 44" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M40 14 C40 14 44 19 40 25 L34 36" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="34" cy="37" r="4" fill={color}/>
      </svg>
    ),
    availability: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="12" y="16" width="36" height="32" rx="5" fill={accent} opacity="0.3"/>
        <rect x="12" y="16" width="36" height="32" rx="5" stroke={color} strokeWidth="2"/>
        <rect x="12" y="22" width="36" height="6" fill={color} opacity="0.4"/>
        <rect x="18" y="12" width="4" height="8" rx="2" fill={color}/>
        <rect x="38" y="12" width="4" height="8" rx="2" fill={color}/>
        <circle cx="22" cy="36" r="3" fill={color}/>
        <circle cx="30" cy="36" r="3" fill={accent}/>
        <circle cx="38" cy="36" r="3" fill={color}/>
      </svg>
    ),
    businessHours: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="16" fill={accent} opacity="0.25"/>
        <circle cx="30" cy="30" r="16" stroke={color} strokeWidth="2.5"/>
        <path d="M30 18 L30 30 L38 36" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="30" cy="30" r="2" fill={color}/>
      </svg>
    ),
    claims: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M30 10 L46 18 L46 34 C46 42 38 50 30 52 C22 50 14 42 14 34 L14 18Z" fill={accent} opacity="0.35"/>
        <path d="M30 10 L46 18 L46 34 C46 42 38 50 30 52 C22 50 14 42 14 34 L14 18Z" stroke={color} strokeWidth="2"/>
        <path d="M22 32 L27 38 L38 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    inventory: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="10" y="22" width="40" height="26" rx="4" fill={accent} opacity="0.3"/>
        <rect x="10" y="22" width="40" height="26" rx="4" stroke={color} strokeWidth="2"/>
        <rect x="18" y="14" width="24" height="8" rx="3" stroke={color} strokeWidth="2"/>
        <path d="M22 34 L26 38 L36 30" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    orders: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="12" y="16" width="36" height="32" rx="5" fill={accent} opacity="0.3"/>
        <rect x="12" y="16" width="36" height="32" rx="5" stroke={color} strokeWidth="2"/>
        <path d="M20 26 L28 34 L40 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="44" cy="18" r="6" fill={color}/>
        <path d="M41 18 L43 20 L47 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    goRequests: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="16" fill={accent} opacity="0.25"/>
        <path d="M30 10 L34 22 L46 22 L36 30 L40 44 L30 36 L20 44 L24 30 L14 22 L26 22Z" fill={color}/>
        <circle cx="30" cy="10" r="5" fill={accent}/>
      </svg>
    ),
    signOut: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M26 14 L14 14 L14 46 L26 46" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M36 22 L46 30 L36 38" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M46 30 L24 30" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    language: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="16" fill={accent} opacity="0.25"/>
        <circle cx="30" cy="30" r="16" stroke={color} strokeWidth="2"/>
        <ellipse cx="30" cy="30" rx="7" ry="16" stroke={color} strokeWidth="1.5"/>
        <path d="M14 30 L46 30 M16 22 L44 22 M16 38 L44 38" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    collapse: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M36 18 L24 30 L36 42" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    expand: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M24 18 L36 30 L24 42" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    menu: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M14 20 L46 20 M14 30 L46 30 M14 40 L38 40" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    close: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M18 18 L42 42 M42 18 L18 42" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    garage: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M38 14 C38 14 44 21 38 29 L22 45 C20 47 17 47 15 45 C13 43 13 40 15 38 L31 22 C38 17 38 14 38 14Z" fill={accent} opacity="0.5"/>
        <path d="M38 14 C38 14 44 21 38 29 L22 45 C20 47 17 47 15 45 C13 43 13 40 15 38 L31 22 C38 17 38 14 38 14Z" stroke={color} strokeWidth="2.5"/>
        <circle cx="17" cy="43" r="6" fill={color}/>
        <path d="M38 14 L31 22 L38 29" fill={color} opacity="0.5"/>
      </svg>
    ),
    carWash: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <path d="M16 38 Q30 18 44 38 L44 48 L16 48Z" fill={accent} opacity="0.4"/>
        <path d="M16 38 Q30 18 44 38 L44 48 L16 48Z" stroke={color} strokeWidth="2.5"/>
        <rect x="24" y="32" width="12" height="16" rx="3" fill="white" stroke={color} strokeWidth="1.5"/>
        <path d="M20 30 Q30 18 40 30" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="22" cy="18" r="3" fill={accent}/>
        <circle cx="30" cy="14" r="3" fill={color}/>
        <circle cx="38" cy="18" r="3" fill={accent}/>
      </svg>
    ),
    tyreShop: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="16" fill={accent} opacity="0.25"/>
        <circle cx="30" cy="30" r="16" stroke={color} strokeWidth="2.5"/>
        <circle cx="30" cy="30" r="9" stroke={color} strokeWidth="2"/>
        <circle cx="30" cy="30" r="4" fill={color}/>
        <path d="M30 12 L30 16 M30 44 L30 48 M12 30 L16 30 M44 30 L48 30" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    autoElectrician: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="28" r="13" fill={accent} opacity="0.25"/>
        <circle cx="30" cy="28" r="13" stroke={color} strokeWidth="2"/>
        <path d="M24 20 L26 28 L22 28 L30 40 L28 32 L32 32 Z" fill={color}/>
        <path d="M24 20 L26 28 L22 28 L30 40 L28 32 L32 32 Z" stroke={accent} strokeWidth="1" opacity="0.7"/>
      </svg>
    ),
    panelBeater: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="10" y="20" width="40" height="26" rx="5" fill={accent} opacity="0.3"/>
        <rect x="10" y="20" width="40" height="26" rx="5" stroke={color} strokeWidth="2"/>
        <path d="M20 28 Q30 20 40 28" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="15" cy="18" r="5" fill={color}/>
        <path d="M12 15 L18 21" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    autoGlass: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="10" y="16" width="40" height="28" rx="6" fill={accent} opacity="0.25"/>
        <rect x="10" y="16" width="40" height="28" rx="6" stroke={color} strokeWidth="2.5"/>
        <path d="M16 24 Q30 18 44 24" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <circle cx="38" cy="24" r="5" fill={color}/>
        <path d="M36 22 L38 26 L40 22" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    partsDealer: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <rect x="12" y="22" width="36" height="24" rx="4" fill={accent} opacity="0.35"/>
        <rect x="12" y="22" width="36" height="24" rx="4" stroke={color} strokeWidth="2"/>
        <rect x="20" y="14" width="20" height="8" rx="3" stroke={color} strokeWidth="2"/>
        <path d="M22 34 L26 38 L34 30" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    accessories: (
      <svg width={s} height={s} viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="14" fill={accent} opacity="0.25"/>
        <circle cx="30" cy="30" r="14" stroke={color} strokeWidth="2"/>
        <path d="M30 16 L30 44 M16 30 L44 30 M20 20 L40 40 M40 20 L20 40" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <circle cx="30" cy="30" r="5" fill={color}/>
        <circle cx="30" cy="30" r="2" fill={accent}/>
      </svg>
    ),
  }
  return icons[name] || icons.settings
}
