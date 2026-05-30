import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"

const SYSTEM_PROMPTS = {
  customer: "You are the Car Care Connect AI Assistant helping customers in Nairobi Kenya. You have expert knowledge about: Car Care Connect platform - booking services, GO Service emergency, concierge driver, loyalty points, Service Guarantee, marketplace. Pricing in KES: Oil change KES 2000-5000, Brake pads KES 3000-8000, Full service KES 8000-20000, Battery KES 5000-15000, Wheel alignment KES 1500-3000. You know all popular Kenyan cars: Toyota Vitz Fielder Prado Hilux, Nissan Note X-Trail, Subaru Forester, Mazda, Honda, Mitsubishi. Diagnose car problems from symptoms. Know NTSA Kenya regulations and emergency procedures. Always respond helpfully, give prices in KES, recommend CCC services when relevant.",
  provider: "You are the Car Care Connect AI Assistant for service providers in Nairobi Kenya. Commission: Standard 10%, Premium 20%, GO Service 15%, Concierge 15%. Service Guarantee policy: 1st claim warning plus deduction, 2nd claim 7 day suspension, 3rd claim permanent ban. Payouts processed within 3-5 business days. Help providers grow their business, understand policies, and manage bookings effectively.",
  driver: "You are the Car Care Connect AI Assistant for concierge drivers in Nairobi Kenya. Earnings: 15% of service fee plus KES 200 transport allowance per job. Required documents: National ID front and back, Driver License, Certificate of Good Conduct, KRA PIN, Medical Certificate. No-show penalties: 1st warning, 2nd 24hr suspension, 3rd 72hr suspension, 4th permanent ban. Transport allowance released only after completing delivery and filing dropoff report.",
  admin: "You are the Car Care Connect AI Assistant for administrators. Full platform knowledge: 4 roles customer provider driver admin. Commission: Standard 10%, Premium 20%, GO Service 15%, Concierge 15%, Marketplace vehicles 2%, Marketplace parts 8%. Key features: GO Service emergency, vehicle condition reports, Service Guarantee vouchers, driver verification 6 documents, system health monitor 11 checks, marketplace with escrow. Help admins manage the platform efficiently."
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

  const ROLE_${color}S = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }
  const ${color} = ROLE_${color}S[role] || "#e6821e"

  const GREETINGS = {
    customer: "Hi! I am your Car Care Connect AI assistant. I can help with car problems, service advice, booking help, and anything about our platform. What can I help you with today?",
    provider: "Hello! I am your CCC business assistant. I can help with platform policies, pricing guidance, and growing your service business. How can I assist?",
    driver: "Hey! I am your CCC driver assistant. I can help with delivery procedures, earnings questions, and platform rules. What do you need?",
    admin: "Hello Admin! I have full knowledge of the Car Care Connect platform. I can help with policies, user issues, and platform management. What would you like to know?"
  }

  const QUICK_QUESTIONS = {
    customer: ["My car wont start", "When should I service my car?", "How do I track my driver?", "How does Service Guarantee work?"],
    provider: ["How does commission work?", "What is the Service Guarantee policy?", "How do I get paid?", "How do GO Service requests work?"],
    driver: ["How do I get verified?", "What documents do I need?", "How are earnings calculated?", "What happens if I miss a job?"],
    admin: ["Explain commission structure", "How does Service Guarantee work?", "What does system health check?", "How are drivers verified?"]
  }

  useEffect(() => {
    if (open && !hasGreeted) {
      setMessages([{ role:"assistant", content:GREETINGS[role] }])
      setHasGreeted(true)
    }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [messages, loading])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

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
      const reply = data.content?.[0]?.text || "Sorry I could not process that. Please try again."
      setMessages(prev => [...prev, { role:"assistant", content:reply }])
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Sorry I am having trouble connecting. Please try again." }])
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @keyframes twinkle { 0%,100%{transform:scale(1) rotate(0deg);box-shadow:0 0 10px ${color},0 0 20px ${color}aa;} 25%{transform:scale(1.1) rotate(-5deg);} 50%{transform:scale(1.05) rotate(5deg);box-shadow:0 0 25px ${color},0 0 50px ${color}aa;} 75%{transform:scale(1.1) rotate(-3deg);} }
        @keyframes sparkle1 { 0%,100%{opacity:0;transform:scale(0) translate(0,0);} 50%{opacity:1;transform:scale(1) translate(-8px,-8px);} }
        @keyframes sparkle2 { 0%,100%{opacity:0;transform:scale(0) translate(0,0);} 50%{opacity:1;transform:scale(1) translate(8px,-10px);} }
        @keyframes sparkle3 { 0%,100%{opacity:0;transform:scale(0) translate(0,0);} 50%{opacity:1;transform:scale(1) translate(-10px,6px);} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6;} 100%{transform:scale(1.7);opacity:0;} }
        .ai-btn { animation: twinkle 3s ease-in-out infinite; }
      `}</style>

      {!open&&(
        <div onClick={()=>setOpen(true)} style={{ position:"fixed", bottom:80, right:20, zIndex:1000, cursor:"pointer" }}>
          <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:"2px solid ${color}", animation:"pulse-ring 1.5s ease-out infinite" }}/>
          <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:"2px solid ${color}", animation:"pulse-ring 1.5s ease-out infinite 0.75s" }}/>
          <div style={{ position:"absolute", top:-6, left:-4, fontSize:10, animation:"sparkle1 2s ease-in-out infinite", ${color}:"${color}" }}>✦</div>
          <div style={{ position:"absolute", top:-8, right:-2, fontSize:8, animation:"sparkle2 2s ease-in-out infinite 0.7s", ${color}:"${color}" }}>✦</div>
          <div style={{ position:"absolute", bottom:-2, left:-8, fontSize:6, animation:"sparkle3 2s ease-in-out infinite 1.2s", ${color}:"${color}" }}>✦</div>
          <div className="ai-btn" style={{ width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,${color},${color}aa)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ textAlign:"center", lineHeight:1.1 }}>
              <div style={{ fontSize:16, ${color}:"#fff" }}>✦</div>
              <div style={{ fontFamily:"Syne", fontSize:9, fontWeight:800, ${color}:"#fff", letterSpacing:1 }}>AI</div>
            </div>
          </div>
        </div>
      )}

      {open&&(
        <div style={{ position:"fixed", bottom:80, right:20, width:340, height:500, background:"#0f0f0f", border:"1px solid ${color}aa", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.6)", zIndex:1000, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"linear-gradient(135deg,${color},${color}cc)", padding:"0.9rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, ${color}:"#fff" }}>✦</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, ${color}:"#fff" }}>CCC Assistant</div>
                <div style={{ fontSize:10, ${color}:"rgba(255,255,255,0.7)" }}>AI-powered car care help</div>
              </div>
            </div>
            <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", ${color}:"#fff", fontSize:20, cursor:"pointer", opacity:0.8 }}>×</button>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"0.9rem", display:"flex", flexDirection:"column", gap:8 }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"85%", padding:"10px 12px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?"${color}":"#1a1a1a", ${color}:"#f0ede6", fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{ display:"flex", justifyContent:"flex-start" }}>
                <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"#1a1a1a", ${color}:"#555", fontSize:18, letterSpacing:4 }}>•••</div>
              </div>
            )}
            {messages.length<=1&&!loading&&(
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
                <div style={{ fontSize:10, ${color}:"#555", textAlign:"center" }}>Quick questions:</div>
                {QUICK_QUESTIONS[role].map((q,i)=>(
                  <button key={i} onClick={()=>{ setInput(q); inputRef.current?.focus() }}
                    style={{ background:"#111", border:"1px solid ${color}aa", borderRadius:8, ${color}:"#888", fontSize:11, padding:"7px 10px", cursor:"pointer", textAlign:"left" }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <form onSubmit={sendMessage} style={{ padding:"0.75rem", borderTop:"1px solid #1e1e1e", display:"flex", gap:8, background:"#111" }}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              placeholder="Ask me anything..."
              style={{ flex:1, background:"#0f0f0f", border:"1px solid #222", borderRadius:10, padding:"9px 12px", ${color}:"#f0ede6", fontSize:12, outline:"none" }}/>
            <button type="submit" disabled={!input.trim()||loading}
              style={{ background:input.trim()&&!loading?"${color}":"#222", border:"none", borderRadius:10, ${color}:input.trim()&&!loading?"#fff":"#555", fontSize:16, padding:"0 14px", cursor:input.trim()&&!loading?"pointer":"default" }}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  )
}
