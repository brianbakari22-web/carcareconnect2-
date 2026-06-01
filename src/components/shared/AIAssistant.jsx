import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"

const ROLE_COLORS = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }

const PLATFORM_KNOWLEDGE = `
CAR CARE CONNECT PLATFORM - COMPLETE KNOWLEDGE BASE

ABOUT THE PLATFORM:
Car Care Connect (CCC) is a full-stack automotive service platform based in Nairobi, Kenya.
Website: carcareconnect2.pages.dev
Contact: carcareconnect254@gmail.com | 0113858966
Privacy Policy: carcareconnect2.pages.dev/privacy
Terms of Service: carcareconnect2.pages.dev/terms

4 ROLES:
1. Customer - Books services, tracks drivers, earns loyalty points, uses marketplace
2. Service Provider - Lists services, manages bookings, earns commissions
3. Concierge Driver - Picks up and delivers customer vehicles to providers
4. Admin - Manages entire platform

COMMISSION STRUCTURE:
- Shop Standard: Provider 90%, Platform 10%
- Shop Premium: Provider 80%, Platform 20%
- GO Service Emergency: Provider 85%, Platform 15%
- Concierge Service: Provider 70%, Platform 15%, Driver 15%
- Marketplace Vehicles: Seller 98%, Platform 2%
- Marketplace Parts/Accessories: Seller 92%, Platform 8%

BOOKING FLOW:
Customer finds service -> Books online -> Provider confirms -> Service performed -> Customer reviews
Payment via Pesapal (M-Pesa STK push, Visa/Mastercard cards, bank transfers)

GO SERVICE (Emergency):
- Customer requests emergency roadside assistance
- KES 500 mechanic callout fee paid upfront via Pesapal before request is sent
- Callout fee split: Mechanic KES 425 (85%), Platform KES 75 (15%)
- This deters prank calls — only serious emergencies will pay upfront
- Maximum 2 GO Service requests per day per customer
- Provider has 15 minutes to respond per attempt
- Up to 5 providers attempted before notifying customer of unavailability
- Live 15-minute countdown timer shown to customer while waiting
- Safety checklist shown to customer while waiting (hazards, warning triangles, NTSA 0800 723 573, Police 999)
- Provider receives loud alarm + browser push notification when new request arrives
- After provider accepts: customer gets notification with mechanic name, phone, specialization
- Service fee paid separately after service completion
- Waiting screen auto-resumes after Pesapal payment redirect
- Emergency types: flat tire, dead battery, out of fuel, car wont start, overheating, towing, other

CONCIERGE SERVICE:
- Driver picks up customer vehicle
- Takes it to service provider
- Returns vehicle after service
- Driver earns 15% commission + KES 200 transport allowance
- Transport allowance released ONLY after dropoff report filed
- Full 7-step delivery flow with condition reports

LOYALTY POINTS:
- Earn points on every booking
- Bronze 0-999pts: 100pts = KES 1
- Silver 1000-4999pts: 90pts = KES 1
- Gold 5000-9999pts: 80pts = KES 1
- Platinum 10000+pts: 70pts = KES 1
- Points redeemable for service discounts

REFERRAL SYSTEM:
- Each user has a unique referral code
- Refer friends and earn bonus points
- Referrer tracked in database

CLAIM INVESTIGATION CHAT:
- When a service claim is filed, admin can message both provider and customer directly
- All parties can communicate through the platform for fair investigation
- Admin sees unread claim messages at top of Service Claims page
- Provider can respond to admin via Respond to admin button in their Service Claims page
- Customer can add evidence via Add evidence button in their Service Guarantee page
- All messages stored against the claim ID for full audit trail
- Admin makes decision only after hearing both sides

SERVICE GUARANTEE POLICY:
- Customer submits claim within 7 days of completed service
- Admin reviews within 24 hours
- If approved: customer gets service voucher (full value, 30 days, different provider)
- Cash refunds only as last resort exception
- Provider penalties: 1st claim = warning + cost deduction, 2nd = 7 day suspension, 3rd = permanent ban
- Voucher code format: CCC-XXXX-XXXX-XXXX

DRIVER REQUIREMENTS:
Required documents (6):
1. National ID - Front
2. National ID - Back  
3. Driver License
4. Certificate of Good Conduct (DCI Kenya)
5. KRA PIN Certificate
6. Medical Certificate (NTSA fitness to drive)
Optional: PSV Badge

No-show penalties:
- 1st: Warning
- 2nd: 24 hour suspension
- 3rd: 72 hour suspension
- 4th: Permanent ban

MARKETPLACE:
- All users can list vehicles, parts, accessories
- Listings require admin approval before going live
- No contact sharing allowed (phone/WhatsApp/email blocked by database trigger)
- Commission: 2% on vehicles, 8% on parts/accessories
- Escrow payments: funds held until buyer confirms receipt
- 7-day dispute window
- CCC Inspection service: KES 500 for vehicle inspection
- Featured listings: KES 200/week
- Photo uploads: up to 10 photos per listing

VEHICLE CONDITION REPORTS:
- Filed at pickup and dropoff for concierge deliveries
- Includes odometer, fuel level, checklist
- Mileage alert triggered if >30km difference
- Customer can dispute within 24 hours

CHAT SYSTEM:
- Real-time messaging between customer and provider
- Marketplace chat between buyer and seller
- One-way admin notifications
- Message delivery receipts (single tick = sent, double tick = read)

NOTIFICATIONS:
- Real-time notifications for all roles
- Admin notified of: new users, bookings, disputes, support tickets, payout requests, mileage alerts
- Unread badge on bell icon

SYSTEM HEALTH MONITOR (11 checks):
1. Stuck bookings (pending >24hrs)
2. GO Service timeouts
3. Pending claims (>24hrs)
4. Unanswered support tickets (>24hrs)
5. Unresolved mileage alerts (>48hrs)
6. Pending payouts (>7 days)
7. Unpaid completed bookings
8. Unverified drivers
9. Expiring vouchers (within 3 days)
10. Idle online drivers (>4hrs)
11. Database connection and response time

DATA & PRIVACY POLICY:
- All data stored in Supabase PostgreSQL with Row Level Security (RLS)
- Users can export data as PDF/JSON/CSV from profile settings
- Data never sold to third parties
- Payment data handled by Pesapal (regulated by Central Bank of Kenya)
- Driver documents stored in Supabase Storage (encrypted)
- Data retention: active accounts keep all data, deleted accounts removed after 30 days
- 2FA available for admin accounts
- HTTPS encryption on all connections

SUPPORT:
- Support tickets from any dashboard
- Admin responds within 24 hours
- Categories: technical, billing, account, service quality, other

PAYMENTS:
- Pesapal payment gateway (replaces Flutterwave)
- Supports M-Pesa STK push, Visa/Mastercard cards, bank transfers
- Processing fee: 2.5% on all transactions (split between customer, provider, platform)
- KES currency only
- Payout requests processed 3-5 business days
- Platform holds escrow for marketplace transactions until buyer confirms receipt
- 7-day dispute window on marketplace transactions
- Booking payments: customer pays at booking, provider confirmed after payment
- Marketplace payments: escrow held until buyer confirms delivery
- Cash payment option available for standard bookings only
- GO Service requires online payment (M-Pesa or card)
- Vouchers can be applied at checkout to reduce total amount

SERVICE CATEGORIES:
- Standard services (oil change, brakes, tyres, battery, AC, suspension, alignment)
- Premium services (full diagnostic, major repairs)
- GO Service (emergency roadside)
- Concierge (vehicle pickup/delivery)

MARKETPLACE VEHICLE INSPECTION FLOW:
- All vehicle listings require CCC inspection before going live
- Parts and accessories: no inspection required
- Flow: Seller lists -> Admin requests inspection -> Seller pays KES 500 via Pesapal -> Admin assigns inspector -> Inspector visits -> Pass/Fail decision -> If passed: CCC Inspected badge added -> Admin approves listing -> Goes live
- Buyers cannot make offers or message seller until vehicle is inspected and approved
- Inspection status shown on listing: Pending CCC Inspection / CCC Verified
- Inspection fee: KES 500 (non-refundable)
- If failed: seller notified with reason, can relist after fixing issues

VOUCHER SYSTEM:
- Vouchers issued when service guarantee claim is approved
- Format: CCC-XXXX-XXXX-XXXX
- Valid for 30 days from issue date
- Full value of original booking
- Can be used on any provider (not the original offending provider)
- Applied at booking checkout in voucher code field
- One voucher per booking
- Visible in Customer Payments -> My Vouchers tab

PESAPAL PAYMENT DETAILS:
- Live keys integrated (not sandbox)
- Pending merchant contract signing for full activation
- Current limit: KES 1,000 per transaction (test mode)
- Full activation after contract signed with Pesapal
- Contact: merchant@pesapal.com
- Processing fee split: Customer pays 1%, Provider pays 1%, Platform pays 1% = 3% total

CONTACT BLOCKING:
- Phone numbers, emails, WhatsApp mentions automatically blocked in all chats
- Replaced with [contact blocked]
- Applies to marketplace chat, booking chat, and claim investigation chat
- Database trigger fires on every message insert

ADMIN MARKETPLACE CONTROLS:
- Cannot approve vehicle listing without inspection
- Request inspection button sends notification to seller
- Mark as passed/failed after physical inspection
- Approve and publish only available after inspection passed
- Can feature listings, suspend listings, resolve disputes
- Parts & commodities

SERVICE PRICING IN NAIROBI (approximate KES):
- Oil change: 2,000 - 5,000
- Brake pads: 3,000 - 8,000
- Full service: 8,000 - 20,000
- Battery replacement: 5,000 - 15,000
- Wheel alignment: 1,500 - 3,000
- AC service: 3,000 - 8,000
- Tyre change (per tyre): 1,500 - 4,000
- Suspension repair: 5,000 - 20,000
- Full diagnostic: 2,000 - 5,000

POPULAR KENYAN CARS SERVICED:
Toyota: Vitz, Fielder, Prado, Hilux, Land Cruiser, Harrier, RAV4, Axio, Auris
Nissan: Note, X-Trail, Navara, Patrol, March, Juke
Subaru: Forester, Outback, Legacy, Impreza, XV
Mazda: Demio, Atenza, CX-5, BT-50
Honda: Fit, CR-V, Accord, Civic
Mitsubishi: Outlander, Pajero, L200, Eclipse Cross
BMW, Mercedes, Volkswagen, Ford, Isuzu also serviced

COMMON CAR PROBLEMS & DIAGNOSIS:
- Grinding brakes: worn brake pads, needs immediate attention
- Car wont start: battery, starter motor, or fuel pump issue
- Overheating: coolant leak, thermostat, radiator problem
- Check engine light: various causes, needs OBD diagnostic scan
- Excessive oil consumption: worn piston rings or valve seals
- Vibration when driving: wheel balancing or alignment issue
- AC not cooling: refrigerant low, compressor issue
- Hard gear changes: clutch wear or transmission fluid

KENYA ROAD REGULATIONS (NTSA):
- Speed limits: 50km/h urban, 80km/h rural, 110km/h highway
- Seatbelts mandatory for all passengers
- No phone use while driving
- Annual vehicle inspection required
- Third party insurance mandatory
- NTSA emergency: 0800 723 573
- Traffic Police: 999 or 0722 722 203
`

const SYSTEM_PROMPTS = {
  customer: `You are the Car Care Connect AI Assistant for customers. Be helpful, friendly and concise. Always give prices in KES.

${PLATFORM_KNOWLEDGE}

FOR CUSTOMERS specifically:
- Help diagnose car problems from symptoms
- Recommend appropriate CCC services
- Explain how to book, track, and review services
- Help with loyalty points, referrals, and vouchers
- Guide through GO Service emergency process
- Explain Service Guarantee claims
- Help navigate marketplace for buying/selling`,

  provider: `You are the Car Care Connect AI Assistant for service providers. Be professional and business-focused.

${PLATFORM_KNOWLEDGE}

FOR PROVIDERS specifically:
- Explain commission structure and earnings
- Guide through adding and managing services
- Explain Service Guarantee policy and consequences
- Help with GO Service request handling
- Advise on mechanic management
- Explain payout process
- Help with business hours and availability settings
- Marketplace listing guidance`,

  driver: `You are the Car Care Connect AI Assistant for concierge drivers. Be clear and practical.

${PLATFORM_KNOWLEDGE}

FOR DRIVERS specifically:
- Explain earnings calculation (15% + KES 200 allowance)
- Guide through verification document requirements
- Explain delivery flow step by step
- Clarify no-show penalty system
- Help with condition reports
- Explain suspension and reinstatement process
- Marketplace listing guidance`,

  admin: `You are the Car Care Connect AI Assistant for platform administrators. Be comprehensive and precise.

${PLATFORM_KNOWLEDGE}

FOR ADMINS specifically:
- Full platform policy knowledge
- Commission and revenue management
- Driver verification process
- Service Guarantee claim resolution
- System health monitoring and fixes
- Marketplace listing approval
- User management and support
- Data and privacy compliance
- Dispute resolution
- Promo code management`
}

const GREETINGS = {
  customer: "Hi! I am your Car Care Connect AI assistant. I can help with car problems, booking services, loyalty points, marketplace, and anything about our platform. What can I help you with?",
  provider: "Hello! I am your CCC business assistant. I can help with commissions, service management, GO Service, payouts, and platform policies. How can I assist?",
  driver: "Hey! I am your CCC driver assistant. I can help with earnings, document verification, delivery procedures, and platform rules. What do you need?",
  admin: "Hello Admin! I have complete knowledge of the Car Care Connect platform including all policies, features, and procedures. How can I help?"
}

const QUICK = {
  customer: ["My car wont start", "How do I book a service?", "How does Service Guarantee work?", "How do I earn loyalty points?"],
  provider: ["How does commission work?", "Service Guarantee policy?", "How do I get paid?", "How do GO requests work?"],
  driver: ["What documents do I need?", "How are earnings calculated?", "What is a no-show penalty?", "How do I complete a delivery?"],
  admin: ["Commission structure?", "Service Guarantee policy?", "Driver verification process?", "Data privacy policy?"]
}

export default function AIAssistant() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const role = profile?.role || "customer"
  const color = ROLE_COLORS[role] || "#e6821e"

  useEffect(() => {
    if (open && !greeted) {
      setMessages([{ role:"assistant", content:GREETINGS[role] }])
      setGreeted(true)
    }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [messages, loading])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  async function send(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput("")
    const msgs = [...messages, { role:"user", content:text }]
    setMessages(msgs)
    setLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPTS[role],
          messages: msgs.map(m=>({ role:m.role, content:m.content }))
        })
      })
      const data = await res.json()
      const reply = data.text || data.content?.[0]?.text || "Sorry I could not process that. Please try again."
      setMessages(prev => [...prev, { role:"assistant", content:reply }])
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"Connection error. Please try again." }])
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @keyframes ai-pulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.5);opacity:0} }
        @keyframes ai-spin { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.1)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes ai-spark1 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(-10px,-10px) scale(1)} }
        @keyframes ai-spark2 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(10px,-12px) scale(1)} }
        @keyframes ai-spark3 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(-12px,8px) scale(1)} }
        @keyframes ai-spark4 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(10px,8px) scale(1)} }
      `}</style>

      {!open&&(
        <div onClick={()=>setOpen(true)} style={{ position:"fixed", bottom:88, right:20, zIndex:999, cursor:"pointer", width:56, height:56 }}>
          <div style={{ position:"absolute", inset:-6, borderRadius:"50%", border:"2px solid "+color, animation:"ai-pulse 2s ease-out infinite" }}/>
          <div style={{ position:"absolute", inset:-6, borderRadius:"50%", border:"2px solid "+color, animation:"ai-pulse 2s ease-out infinite 1s" }}/>
          <div style={{ position:"absolute", top:-8, left:-4, fontSize:11, color:color, animation:"ai-spark1 2.5s ease-in-out infinite" }}>✦</div>
          <div style={{ position:"absolute", top:-10, right:-2, fontSize:9, color:color, animation:"ai-spark2 2.5s ease-in-out infinite 0.8s" }}>✦</div>
          <div style={{ position:"absolute", bottom:0, left:-10, fontSize:7, color:color, animation:"ai-spark3 2.5s ease-in-out infinite 1.4s" }}>✦</div>
          <div style={{ position:"absolute", bottom:0, right:-8, fontSize:8, color:color, animation:"ai-spark4 2.5s ease-in-out infinite 0.4s" }}>✦</div>
          <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,"+color+","+color+"99)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 20px "+color+"60", animation:"ai-spin 8s linear infinite" }}>
            <div style={{ fontSize:18, color:"#fff", animation:"ai-spin 8s linear infinite reverse" }}>✦</div>
            <div style={{ fontFamily:"Syne", fontSize:8, fontWeight:800, color:"#fff", letterSpacing:2 }}>AI</div>
          </div>
        </div>
      )}

      {open&&(
        <div style={{ position:"fixed", bottom:88, right:20, width:340, height:520, background:"#0a0a0a", border:"1px solid "+color+"44", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.7)", zIndex:999, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"linear-gradient(135deg,"+color+","+color+"cc)", padding:"0.9rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#fff" }}>✦</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#fff" }}>CCC Assistant</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>AI-powered car care help</div>
              </div>
            </div>
            <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", opacity:0.8, lineHeight:1 }}>×</button>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"0.9rem", display:"flex", flexDirection:"column", gap:8 }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"85%", padding:"10px 12px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?color:"#1a1a1a", color:"#f0ede6", fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{ display:"flex" }}>
                <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"#1a1a1a", color:"#555", fontSize:18, letterSpacing:4 }}>•••</div>
              </div>
            )}
            {messages.length<=1&&!loading&&(
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
                <div style={{ fontSize:10, color:"#555", textAlign:"center" }}>Quick questions:</div>
                {QUICK[role].map((q,i)=>(
                  <button key={i} onClick={()=>{ setInput(q); inputRef.current?.focus() }}
                    style={{ background:"#111", border:"1px solid "+color+"33", borderRadius:8, color:"#888", fontSize:11, padding:"7px 10px", cursor:"pointer", textAlign:"left" }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <form onSubmit={send} style={{ padding:"0.75rem", borderTop:"1px solid #1e1e1e", display:"flex", gap:8, background:"#111", flexShrink:0 }}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              placeholder="Ask me anything..."
              style={{ flex:1, background:"#0f0f0f", border:"1px solid #222", borderRadius:10, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none" }}/>
            <button type="submit" disabled={!input.trim()||loading}
              style={{ background:input.trim()&&!loading?color:"#222", border:"none", borderRadius:10, color:input.trim()&&!loading?"#fff":"#555", fontSize:16, padding:"0 14px", cursor:input.trim()&&!loading?"pointer":"default" }}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  )
}




