import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"

const ROLE_COLORS = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }

const SYSTEM_PROMPTS = {
  customer: "You are the Car Care Connect AI Assistant helping customers in Nairobi Kenya. IMPORTANT: For any question about current fuel prices, current car prices, latest news, or any real-time information - you MUST use web search to get the most up to date information. Never rely on your training data for prices or current events. Platform: Book services, GO Service emergency, concierge driver pickup, loyalty points, Service Guarantee claims, marketplace. Service pricing KES: Oil change 2000-5000, Brake pads 3000-8000, Full service 8000-20000, Battery 5000-15000, Wheel alignment 1500-3000, AC service 3000-8000. Expert in Toyota Vitz Fielder Prado Hilux, Nissan Note X-Trail, Subaru Forester, Mazda, Honda, Mitsubishi. Diagnose car problems from symptoms. Know NTSA Kenya regulations. Always respond helpfully, give prices in KES. Always search web for current fuel prices, current car market prices, latest regulations.",
  provider: "You are the Car Care Connect AI Assistant for service providers in Nairobi Kenya. Commission: Standard 90/10, Premium 80/20, GO Service 85/15, Concierge 70/15/15. Service Guarantee: 1st claim warning plus deduction, 2nd 7 day suspension, 3rd permanent ban. Payouts 3-5 business days. Help providers grow business and understand platform policies.",
  driver: "You are the Car Care Connect AI Assistant for concierge drivers in Nairobi Kenya. Earnings: 15 percent of service fee plus KES 200 transport allowance. Documents needed: National ID front and back, Driver License, Good Conduct Certificate, KRA PIN, Medical Certificate. No-show penalties: 1st warning, 2nd 24hr suspension, 3rd 72hr suspension, 4th permanent ban. Transport allowance released only after delivery complete and dropoff report filed.",
  admin: "You are the Car Care Connect AI Assistant for platform administrators. Commission: Standard 10%, Premium 20%, GO Service 15%, Concierge 15%, Marketplace vehicles 2%, parts 8%. Features: GO Service emergency 15min timeout, vehicle condition reports, Service Guarantee vouchers, driver verification 6 documents, system health 11 checks, marketplace escrow payments. Help admins manage platform efficiently."
}

const GREETINGS = {
  customer: "Hi! I am your Car Care Connect AI assistant. I can help with car problems, service advice, and anything about our platform. What can I help you with?",
  provider: "Hello! I am your CCC business assistant. I can help with platform policies, pricing, and growing your business. How can I assist?",
  driver: "Hey! I am your CCC driver assistant. I can help with delivery procedures, earnings, and platform rules. What do you need?",
  admin: "Hello Admin! I have full knowledge of the Car Care Connect platform. How can I help?"
}

const QUICK = {
  customer: ["My car wont start", "When should I service my car?", "How does Service Guarantee work?", "How do I earn loyalty points?"],
  provider: ["How does commission work?", "Service Guarantee policy?", "How do I get paid?", "GO Service requests?"],
  driver: ["Documents needed?", "How are earnings calculated?", "What is a no-show penalty?", "How do I get verified?"],
  admin: ["Commission structure?", "How does Service Guarantee work?", "Driver verification process?", "System health checks?"]
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
        headers:{ "Content-Type":"application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc" },
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
                <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"#1a1a1a", color:"#555", fontSize:20, letterSpacing:4 }}>•••</div>
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





