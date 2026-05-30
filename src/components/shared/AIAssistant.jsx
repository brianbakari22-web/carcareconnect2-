import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"

const SYSTEM_PROMPTS = {
  customer: You are the Car Care Connect AI Assistant, helping customers in Nairobi, Kenya. You have expert knowledge about:

PLATFORM KNOWLEDGE:
- Car Care Connect (CCC) is a platform connecting vehicle owners with verified service providers in Nairobi
- Customers can book services, track drivers in real-time, earn loyalty points, and use GO Service for emergencies
- Booking flow: Find service → Book → Provider confirms → Service done → Review
- GO Service: Emergency roadside assistance, online payment required, provider responds within 15 mins
- Concierge service: Driver picks up your car, takes it to provider, returns it
- Loyalty points: Earn points on every booking, redeem for discounts
- Service Guarantee: If unhappy with service, submit claim within 7 days, get voucher for free service
- Marketplace: Buy/sell vehicles and car parts, all transactions through platform
- Payment: M-Pesa and card via Flutterwave
- Support: Available through the Support tab

PRICING IN NAIROBI (approximate KES):
- Oil change: KES 2,000 - 5,000
- Brake pads replacement: KES 3,000 - 8,000
- Tyre change (per tyre): KES 1,500 - 4,000
- Full service: KES 8,000 - 20,000
- Battery replacement: KES 5,000 - 15,000
- Wheel alignment: KES 1,500 - 3,000
- AC service: KES 3,000 - 8,000
- Suspension repair: KES 5,000 - 20,000

CAR KNOWLEDGE:
- Expert in all popular Kenyan cars: Toyota (Vitz, Fielder, Prado, Hilux), Nissan (Note, X-Trail), Subaru (Forester, Outback), Mazda, Honda, Mitsubishi
- Can diagnose common problems from symptoms
- Knows maintenance schedules for all makes
- Emergency road procedures per NTSA Kenya
- Kenya road regulations

POLICIES:
- Service Guarantee: 7-day claim window, voucher issued not cash refund
- Providers penalized for poor service: warning → 7 day suspension → permanent ban
- All marketplace communication through platform only
- Driver verification requires: National ID, License, Good Conduct, KRA PIN, Medical Certificate

Always respond in a helpful, friendly tone. Recommend CCC services when relevant. Give prices in KES. Keep responses concise.,

  provider: You are the Car Care Connect AI Assistant for service providers in Nairobi, Kenya.

PLATFORM KNOWLEDGE FOR PROVIDERS:
- Car Care Connect connects you with customers needing automotive services
- Commission structure: Standard 10%, Premium 20%, GO Service 15%, Concierge 15%
- You keep 80-90% of each booking depending on your tier
- GO Service: Emergency requests, you have 15 minutes to respond, online payment only
- Mechanics: Add your mechanics, track their location, assign to bookings
- Payouts: Request payout from earnings, processed within 3-5 business days
- Service Guarantee: If customer files claim, cost deducted from your earnings. 3 strikes = ban
- Business hours: Set your availability so customers only book when you are open
- Analytics: Track your bookings, earnings, and customer ratings

POLICIES:
- Service Guarantee policy: 1st claim = warning + deduction, 2nd = 7 day suspension, 3rd = permanent ban
- Always deliver quality service to avoid claims
- Respond to bookings within 2 hours or they may be reassigned
- Keep your services and pricing updated
- Marketplace: List parts and accessories, 8% commission on sales, 2% on vehicles

PRICING GUIDANCE:
- Oil change: KES 2,000 - 5,000
- Full service: KES 8,000 - 20,000
- Brake service: KES 3,000 - 8,000

Always give practical business advice. Help providers grow their business on the platform.,

  driver: You are the Car Care Connect AI Assistant for concierge drivers in Nairobi, Kenya.

PLATFORM KNOWLEDGE FOR DRIVERS:
- You earn by picking up customer vehicles and delivering them to service providers
- Earnings: 15% of service fee + KES 200 transport allowance per job
- Transport allowance released ONLY after completing delivery and filing dropoff report
- Go online to receive job requests, go offline when not available
- Required documents: National ID (front+back), Driver License, Certificate of Good Conduct, KRA PIN, Medical Certificate
- Must be verified by admin before going online

DELIVERY FLOW:
1. Accept job
2. Go to customer pickup location
3. File vehicle condition report (pickup)
4. Transport vehicle to service provider
5. Wait or return
6. Pick up vehicle after service
7. File condition report (dropoff)
8. Complete delivery

NO-SHOW PENALTIES:
- 1st no-show: Warning
- 2nd no-show: 24 hour suspension
- 3rd no-show: 72 hour suspension
- 4th no-show: Permanent ban

POLICIES:
- Always file condition reports at pickup and dropoff
- Never miss an accepted job
- Go offline if not available
- Marketplace: You can list your own items for sale

Help drivers maximize their earnings and understand platform rules.,

  admin: You are the Car Care Connect AI Assistant for platform administrators.

FULL PLATFORM KNOWLEDGE:
- Car Care Connect is a full-stack automotive service platform in Nairobi, Kenya
- 4 roles: Customer, Provider, Driver, Admin
- Built with React + Supabase + Flutterwave

COMMISSION STRUCTURE:
- Shop Standard: Provider 90%, Platform 10%
- Shop Premium: Provider 80%, Platform 20%
- GO Service: Provider 85%, Platform 15%
- Concierge: Provider 70%, Platform 15%, Driver 15%
- Marketplace vehicles: Seller 98%, Platform 2%
- Marketplace parts: Seller 92%, Platform 8%

KEY FEATURES:
- GO Service emergency flow with 15-min timeout and 5 provider attempts
- Vehicle condition reports with mileage alerts
- Service Guarantee with voucher system and provider penalties
- Driver verification with 6 required documents
- System health monitor with 11 automated checks
- Marketplace with escrow payments and inspection service
- Realtime notifications for all roles

ADMIN RESPONSIBILITIES:
- Approve marketplace listings
- Verify driver documents
- Review service claims
- Process payouts
- Manage promo codes
- Monitor system health
- Handle support tickets
- Manage disputes

Help admins understand the platform, make decisions, and resolve issues efficiently.
}

export default function AIAssistant() {
  const { profile } = useAuth()
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hasGreeted, setHasGreeted] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const role = profile?.role || "customer"
  const systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.customer

  const GREETINGS = {
    customer: "Hi! I am your Car Care Connect assistant. I can help you with car problems, service advice, booking help, and anything about our platform. What can I help you with?",
    provider: "Hello! I am your CCC business assistant. I can help you with platform policies, pricing guidance, and growing your service business. How can I assist?",
    driver: "Hey! I am your CCC driver assistant. I can help you with delivery procedures, earnings questions, and platform rules. What do you need?",
    admin: "Hello Admin! I have full knowledge of the Car Care Connect platform. I can help with policies, user issues, and platform management. What would you like to know?"
  }

  useEffect(() => {
    if (open && !hasGreeted) {
      setMessages([{ role:"assistant", content:GREETINGS[role] }])
      setHasGreeted(true)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput("")
    const newMessages = [...messages, { role:"user", content:userMsg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || "Sorry, I could not process that. Please try again."
      setMessages(prev => [...prev, { role:"assistant", content:reply }])
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Sorry, I am having trouble connecting. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const ROLE_COLORS = {
    customer: "#e6821e",
    provider: "#378add",
    driver: "#1d9e75",
    admin: "#8b5cf6"
  }
  const color = ROLE_COLORS[role] || "#e6821e"

  const QUICK_QUESTIONS = {
    customer: ["My car won't start", "When should I service my car?", "How do I track my driver?", "How does Service Guarantee work?"],
    provider: ["How does commission work?", "What is the Service Guarantee policy?", "How do I get paid?", "How do GO Service requests work?"],
    driver: ["How do I get verified?", "What documents do I need?", "How are earnings calculated?", "What happens if I miss a job?"],
    admin: ["Explain commission structure", "How does Service Guarantee work?", "What does system health check?", "How are drivers verified?"]
  }

  return (
    <>
      {/* Floating button */}
      {!open&&(
        <div onClick={()=>setOpen(true)}
          style={{ position:"fixed", bottom:80, right:20, zIndex:1000, cursor:"pointer" }}>
          <style>{`
            @keyframes twinkle {
              0%,100% { transform: scale(1) rotate(0deg); box-shadow: 0 0 10px ${color}, 0 0 20px ${color}40; }
              25% { transform: scale(1.1) rotate(-5deg); box-shadow: 0 0 20px ${color}, 0 0 40px ${color}60; }
              50% { transform: scale(1.05) rotate(5deg); box-shadow: 0 0 30px ${color}, 0 0 60px ${color}40; }
              75% { transform: scale(1.1) rotate(-3deg); box-shadow: 0 0 20px ${color}, 0 0 40px ${color}60; }
            }
            @keyframes sparkle1 {
              0%,100% { opacity:0; transform: scale(0) translate(0,0); }
              50% { opacity:1; transform: scale(1) translate(-8px,-8px); }
            }
            @keyframes sparkle2 {
              0%,100% { opacity:0; transform: scale(0) translate(0,0); }
              50% { opacity:1; transform: scale(1) translate(8px,-10px); }
            }
            @keyframes sparkle3 {
              0%,100% { opacity:0; transform: scale(0) translate(0,0); }
              50% { opacity:1; transform: scale(1) translate(-10px,6px); }
            }
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity:0.6; }
              100% { transform: scale(1.6); opacity:0; }
            }
          `}</style>

          {/* Pulse ring */}
          <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:`2px solid ${color}`, animation:"pulse-ring 1.5s ease-out infinite" }}/>
          <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:`2px solid ${color}`, animation:"pulse-ring 1.5s ease-out infinite 0.5s" }}/>

          {/* Sparkles */}
          <div style={{ position:"absolute", top:-4, left:-4, fontSize:10, animation:"sparkle1 2s ease-in-out infinite", color:color }}>✦</div>
          <div style={{ position:"absolute", top:-6, right:-2, fontSize:8, animation:"sparkle2 2s ease-in-out infinite 0.7s", color:color }}>✦</div>
          <div style={{ position:"absolute", bottom:-2, left:-6, fontSize:6, animation:"sparkle3 2s ease-in-out infinite 1.2s", color:color }}>✦</div>

          {/* Main button */}
          <div style={{ width:52, height:52, borderRadius:"50%", background:`linear-gradient(135deg, ${color}, ${color}cc)`, display:"flex", alignItems:"center", justifyContent:"center", animation:"twinkle 3s ease-in-out infinite", position:"relative" }}>
            <div style={{ fontFamily:"Syne", fontSize:11, fontWeight:800, color:"#fff", textAlign:"center", lineHeight:1.1 }}>
              <div style={{ fontSize:18 }}>✦</div>
              <div style={{ fontSize:8, letterSpacing:1 }}>AI</div>
            </div>
          </div>

          {/* Tooltip */}
          <div style={{ position:"absolute", right:60, top:"50%", transform:"translateY(-50%)", background:"#111", border:`1px solid ${color}40`, borderRadius:8, padding:"4px 10px", fontSize:11, color:"#f0ede6", whiteSpace:"nowrap", pointerEvents:"none", opacity:0.9 }}>
            Ask AI ✦
          </div>
        </div>
      )}

      {/* Chat window */}
      {open&&(
        <div style={{ position:"fixed", bottom:80, right:20, width:340, height:500, background:"#0f0f0f", border:1px solid 40, borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.6)", zIndex:1000, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* Header */}
          <div style={{ background:color, padding:"0.9rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:10, fontWeight:800, color:"#fff" }}>✦ AI</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#fff" }}>CCC Assistant</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>AI-powered car care help</div>
              </div>
            </div>
            <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:18, cursor:"pointer", opacity:0.8 }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"0.9rem", display:"flex", flexDirection:"column", gap:8 }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"85%", padding:"10px 12px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?color:"#1a1a1a", color:"#f0ede6", fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{ display:"flex", justifyContent:"flex-start" }}>
                <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"#1a1a1a", color:"#555", fontSize:18, letterSpacing:4 }}>•••</div>
              </div>
            )}
            {/* Quick questions */}
            {messages.length<=1&&!loading&&(
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
                <div style={{ fontSize:10, color:"#555", textAlign:"center" }}>Quick questions:</div>
                {QUICK_QUESTIONS[role].map((q,i)=>(
                  <button key={i} onClick={()=>{ setInput(q); inputRef.current?.focus() }}
                    style={{ background:"#111", border:1px solid 30, borderRadius:8, color:"#888", fontSize:11, padding:"7px 10px", cursor:"pointer", textAlign:"left", fontFamily:"DM Sans,sans-serif" }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding:"0.75rem", borderTop:"1px solid #1e1e1e", display:"flex", gap:8, background:"#111" }}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              placeholder="Ask me anything..."
              style={{ flex:1, background:"#0f0f0f", border:"1px solid #222", borderRadius:10, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
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


