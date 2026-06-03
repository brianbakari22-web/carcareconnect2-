import { useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"

function NetworkCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    let animId
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener("resize", resize)
    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 1,
      color: Math.random() > 0.6 ? "#e6821e" : Math.random() > 0.5 ? "#1d9e75" : "#8b5cf6"
    }))
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = d.color+"90"; ctx.fill()
      })
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = dots[i].color+(Math.floor((1-dist/120)*40)).toString(16).padStart(2,"0")
            ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animId) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.5, pointerEvents:"none", zIndex:0 }}/>
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d0d", color:"#e8e4dc", fontFamily:"DM Sans,sans-serif", overflowX:"hidden", position:"relative" }}>
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }}><NetworkCanvas /></div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes ping { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes glow { 0%,100%{filter:drop-shadow(0 0 20px #e6821e30)} 50%{filter:drop-shadow(0 0 40px #e6821e70)} }
        * { box-sizing:border-box; }
        html { scroll-behavior:smooth; }
        .hcard:hover { border-color:#e6821e50!important; transform:translateY(-3px); transition:all 0.2s ease; }
        .hcard { transition:all 0.2s ease; }
      `}</style>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:200, padding:"0.75rem 2rem", display:"flex", justifyContent:"space-between", alignItems:"center", background:scrolled?"rgba(13,13,13,0.97)":"transparent", backdropFilter:scrolled?"blur(12px)":"none", borderBottom:scrolled?"1px solid #1e1e1e":"none", transition:"all 0.3s" }}>
        <img src="/logo.svg" alt="Car Care Connect" style={{ height:52, animation:"glow 3s ease-in-out infinite" }}/>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:13, padding:"8px 18px", cursor:"pointer" }}>Sign in</button>
          <button onClick={()=>navigate("/auth")} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer", fontFamily:"Syne,sans-serif" }}>Get started free →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"5rem 1rem 3rem", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 40%, #e6821e12 0%, #1d9e7504 50%, transparent 70%)", pointerEvents:"none", zIndex:1 }}/>
        <div style={{ position:"relative", maxWidth:820, zIndex:1 }}>
          <img src="/logo.svg" alt="Car Care Connect" style={{ height:130, marginBottom:"2rem", animation:"glow 3s ease-in-out infinite" }}/>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#1d9e7512", border:"1px solid #1d9e7530", borderRadius:20, padding:"6px 16px", marginBottom:"1.5rem" }}>
            <div style={{ position:"relative", width:8, height:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#1d9e75", position:"absolute" }}/>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#1d9e75", animation:"ping 1.5s ease-out infinite" }}/>
            </div>
            <span style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>🇰🇪 Built in Kenya · Serving Nairobi</span>
          </div>
          <h1 style={{ fontFamily:"Syne", fontSize:"clamp(38px,6vw,74px)", fontWeight:800, lineHeight:1.1, marginBottom:"1.5rem" }}>
            One app.<br/>
            <span style={{ color:"#e6821e" }}>Every car need.</span><br/>
            Nairobi.
          </h1>
          <p style={{ fontSize:"clamp(15px,2vw,18px)", color:"#777", lineHeight:1.8, maxWidth:580, margin:"0 auto 2.5rem" }}>
            Nairobi's most trusted automotive platform. Verified mechanics, 24/7 emergency roadside help, live tracking, parts marketplace — everything your car needs, one tap away.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:"2.5rem" }}>
            <button onClick={()=>navigate("/auth")} style={{ background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"16px 40px", cursor:"pointer" }}>
              🚗 Get started free
            </button>
            <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"2px solid #e6821e", borderRadius:12, color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"14px 38px", cursor:"pointer" }}>
              Sign in →
            </button>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:"1.5rem" }}>
            {[["24/7","Emergency service"],["5min","Avg response"],["100%","Verified providers"],["🇰🇪","Made in Kenya"]].map(([v,l])=>(
              <div key={l} style={{ textAlign:"center", padding:"0.6rem 1rem", background:"#141414", borderRadius:10, border:"1px solid #1e1e1e" }}>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e6821e" }}>{v}</div>
                <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:20, justifyContent:"center", flexWrap:"wrap" }}>
            {[["🚗","Service booking"],["🚨","24/7 emergency"],["📍","Live tracking"],["🛒","Marketplace"],["💎","Loyalty rewards"]].map(([icon,label])=>(
              <div key={label} style={{ fontSize:12, color:"#444", display:"flex", alignItems:"center", gap:6 }}><span>{icon}</span><span>{label}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* EMERGENCY BANNER */}
      <div style={{ position:"relative", zIndex:1, margin:"0 1.5rem 5rem", background:"linear-gradient(135deg,#13080a,#1a0c0e)", border:"1px solid #e24b4a25", borderRadius:20, padding:"3rem 2rem", textAlign:"center", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center, #e24b4a06, transparent)", pointerEvents:"none" }}/>
        <div style={{ fontSize:52, marginBottom:16 }}>🚨</div>
        <h2 style={{ fontFamily:"Syne", fontSize:"clamp(22px,4vw,36px)", fontWeight:800, color:"#e24b4a", marginBottom:12 }}>
          Breakdown anywhere in Nairobi? We dispatch a mechanic to you.
        </h2>
        <p style={{ fontSize:15, color:"#777", maxWidth:540, margin:"0 auto 2rem", lineHeight:1.8 }}>
          Kenya's only 24/7 emergency roadside service. Our certified mechanics come to your exact GPS location — highway, parking lot, or home. Just KES 500 callout fee.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:"1.5rem" }}>
          {[["🛞","Flat tyre"],["🔋","Dead battery"],["⛽","Out of fuel"],["🌡️","Overheating"],["🚚","Towing"]].map(([icon,label])=>(
            <div key={label} style={{ background:"#e24b4a15", border:"1px solid #e24b4a30", borderRadius:8, padding:"6px 12px", fontSize:12, color:"#e24b4a" }}>{icon} {label}</div>
          ))}
        </div>
        <button onClick={()=>navigate("/auth")} style={{ background:"#e24b4a", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px 36px", cursor:"pointer" }}>
          🚨 Request emergency help
        </button>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1000, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>How it works</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,4vw,40px)", fontWeight:800 }}>Car care has never been this easy</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20 }}>
          {[
            { n:"01", icon:"🔍", title:"Find a service", desc:"Browse verified providers near you. Compare prices, read reviews, and pick the best mechanic for your car and budget." },
            { n:"02", icon:"📱", title:"Book and pay", desc:"Book in seconds. Pay securely via M-Pesa or card through Pesapal, regulated by Central Bank of Kenya." },
            { n:"03", icon:"✅", title:"Track and review", desc:"Track your mechanic live on the map. Rate your experience and earn loyalty points on every booking." },
          ].map(s=>(
            <div key={s.n} className="hcard" style={{ background:"#141414", border:"1px solid #1e1e1e", borderRadius:16, padding:"2rem", position:"relative", overflow:"hidden" }}>
              <div style={{ fontFamily:"Syne", fontSize:64, fontWeight:800, color:"#e6821e06", position:"absolute", top:0, right:12, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:40, marginBottom:16 }}>{s.icon}</div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:700, color:"#e8e4dc", marginBottom:10 }}>{s.title}</div>
              <div style={{ fontSize:13, color:"#666", lineHeight:1.8 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1000, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>Features</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,4vw,40px)", fontWeight:800 }}>Everything your car needs, in one place</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
          {[
            { icon:"🔧", title:"Service booking", desc:"Oil change, brakes, AC, full diagnostics from verified Nairobi providers", color:"#e6821e" },
            { icon:"🚨", title:"GO Service", desc:"24/7 emergency roadside. Mechanic dispatched to your GPS location fast", color:"#e24b4a" },
            { icon:"🚙", title:"Concierge delivery", desc:"We collect your car, service it, and return it to your door", color:"#378add" },
            { icon:"🛒", title:"Marketplace", desc:"Buy and sell vehicles, parts and accessories with CCC inspection badge", color:"#1d9e75" },
            { icon:"💎", title:"Loyalty rewards", desc:"Earn points every booking. Redeem for discounts on future services", color:"#8b5cf6" },
            { icon:"📍", title:"Live tracking", desc:"Track your driver or mechanic on a live dark map in real time", color:"#e6821e" },
            { icon:"🛡️", title:"Service guarantee", desc:"Not happy? We investigate and issue a full service voucher refund", color:"#1d9e75" },
            { icon:"💬", title:"24/7 assistant", desc:"Always-on help for car problems, bookings, and platform guidance", color:"#8b5cf6" },
          ].map(f=>(
            <div key={f.title} className="hcard" style={{ background:"#141414", border:"1px solid #1e1e1e", borderRadius:14, padding:"1.25rem" }}>
              <div style={{ fontSize:28, marginBottom:10, color:f.color }}>{f.icon}</div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e8e4dc", marginBottom:6 }}>{f.title}</div>
              <div style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TRUST SECTION */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1000, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>Why CCC</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,4vw,40px)", fontWeight:800 }}>Built for Kenya. Built for trust.</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16 }}>
          {[
            { icon:"🛡️", title:"Service Guarantee", desc:"Not happy with the service? We investigate and issue a full refund voucher. No questions asked.", color:"#1d9e75" },
            { icon:"✅", title:"Verified providers only", desc:"Every mechanic, parts dealer and service provider is manually verified before listing on CCC.", color:"#378add" },
            { icon:"📍", title:"Real-time tracking", desc:"Know exactly where your mechanic or driver is at all times. Live GPS tracking on every job.", color:"#e6821e" },
            { icon:"🔒", title:"Secure payments", desc:"All payments processed through Pesapal, regulated by the Central Bank of Kenya.", color:"#8b5cf6" },
            { icon:"💬", title:"24/7 support", desc:"Always-on support to help diagnose car problems, guide bookings, and answer any question.", color:"#e6821e" },
            { icon:"🇰🇪", title:"Made in Kenya", desc:"Built by Kenyans for Kenyan roads. We understand Nairobi traffic, local mechanics, and Kenyan cars.", color:"#1d9e75" },
          ].map(t=>(
            <div key={t.title} className="hcard" style={{ background:"#141414", border:"1px solid #1e1e1e", borderRadius:14, padding:"1.5rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>{t.icon}</div>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:t.color, marginBottom:6 }}>{t.title}</div>
              <div style={{ fontSize:12, color:"#666", lineHeight:1.7 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ROLES */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1000, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>Who is it for</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,4vw,40px)", fontWeight:800 }}>Join Built for everyone in the ecosystem</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16 }}>
          {[
            { icon:"🚗", role:"Customer", color:"#e6821e", desc:"Book services, get emergency help, track your car, earn rewards", features:["Book car services","Emergency GO Service","Live mechanic tracking","Buy and sell vehicles"] },
            { icon:"🔧", role:"Service Provider", color:"#378add", desc:"List services, manage bookings, earn commissions, dispatch mechanics", features:["Manage bookings","GO Service requests","Parts inventory","Earnings dashboard"] },
            { icon:"🚙", role:"Concierge Driver", color:"#1d9e75", desc:"Pick up and deliver customer vehicles and parts, earn per delivery", features:["Accept deliveries","Parts delivery jobs","Live navigation","KES 200 allowance per trip"] },
          ].map(r=>(
            <div key={r.role} className="hcard" style={{ background:"#141414", border:"1px solid "+r.color+"30", borderRadius:16, padding:"1.75rem" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>{r.icon}</div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:r.color, marginBottom:6 }}>{r.role}</div>
              <div style={{ fontSize:12, color:"#555", marginBottom:14, lineHeight:1.6 }}>{r.desc}</div>
              {r.features.map(f=>(
                <div key={f} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:7 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:r.color, flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:"#777" }}>{f}</span>
                </div>
              ))}
              <button onClick={()=>navigate("/auth")} style={{ marginTop:18, width:"100%", background:r.color+"18", border:"1px solid "+r.color+"40", borderRadius:9, color:r.color, fontSize:13, fontWeight:700, padding:"10px", cursor:"pointer", fontFamily:"Syne,sans-serif" }}>
                Join as {r.role} →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* PROVIDER TYPES */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1000, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>For businesses</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,4vw,40px)", fontWeight:800 }}>All automotive businesses welcome</h2>
          <p style={{ fontSize:14, color:"#555", marginTop:8 }}>Not just mechanics — list any automotive business and reach thousands of customers in Nairobi</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
          {[
            { icon:"🔧", type:"Garage/Mechanic", commission:"90%", color:"#e6821e" },
            { icon:"⚙️", type:"Parts Dealer", commission:"95%", color:"#378add" },
            { icon:"✨", type:"Accessories Shop", commission:"92%", color:"#8b5cf6" },
            { icon:"🛞", type:"Tyre Shop", commission:"94%", color:"#1d9e75" },
            { icon:"⚡", type:"Auto Electrician", commission:"88%", color:"#e6821e" },
            { icon:"🚿", type:"Car Wash", commission:"90%", color:"#378add" },
            { icon:"🔨", type:"Panel Beater", commission:"85%", color:"#e24b4a" },
            { icon:"🪟", type:"Auto Glass", commission:"88%", color:"#1d9e75" },
          ].map(b=>(
            <div key={b.type} className="hcard" style={{ background:"#141414", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{b.icon}</div>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e8e4dc", marginBottom:4 }}>{b.type}</div>
              <div style={{ fontSize:11, color:b.color, fontWeight:600 }}>Keep {b.commission}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:"2rem" }}>
          <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"2px solid #e6821e", borderRadius:12, color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px 32px", cursor:"pointer" }}>
            Register your business →
          </button>
        </div>
      </div>

      {/* PRICING */}
      <div style={{ position:"relative", zIndex:1, maxWidth:900, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>Pricing</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,4vw,40px)", fontWeight:800 }}>Earn more. Keep more.</h2>
          <p style={{ fontSize:14, color:"#555", marginTop:8 }}>No monthly fees. No hidden charges. We only make money when you make money.</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:16 }}>
          {[
            { type:"Shop Standard", provider:"90%", platform:"10%", desc:"Customer brings car to your shop", color:"#e6821e" },
            { type:"Shop Premium", provider:"80%", platform:"20%", desc:"Your mechanic travels to customer", color:"#378add" },
            { type:"GO Service", provider:"85%", platform:"15%", desc:"Emergency roadside assistance", color:"#e24b4a" },
            { type:"Marketplace", provider:"92-98%", platform:"2-8%", desc:"Buy and sell vehicles and parts", color:"#1d9e75" },
          ].map(p=>(
            <div key={p.type} className="hcard" style={{ background:"#141414", border:"1px solid "+p.color+"30", borderRadius:14, padding:"1.5rem", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:p.color, marginBottom:12 }}>{p.type}</div>
              <div style={{ fontFamily:"Syne", fontSize:36, fontWeight:800, color:"#e8e4dc", marginBottom:4 }}>{p.provider}</div>
              <div style={{ fontSize:11, color:"#555", marginBottom:10 }}>Your earnings</div>
              <div style={{ fontSize:11, color:"#333", marginBottom:6 }}>Platform: {p.platform}</div>
              <div style={{ fontSize:11, color:"#444", lineHeight:1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NAIROBI PRICING */}
      <div style={{ position:"relative", zIndex:1, maxWidth:900, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ background:"#141414", border:"1px solid #1e1e1e", borderRadius:20, padding:"2rem" }}>
          <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>Nairobi market prices</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(20px,3vw,28px)", fontWeight:800 }}>What services cost in Nairobi 2026</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            {[
              ["Oil change (minor service)","KES 4,000 - 7,000"],
              ["Brake pads replacement","KES 7,000 - 15,000"],
              ["Minor service","KES 12,000 - 15,000"],
              ["Major service","KES 30,000 - 35,000"],
              ["Battery replacement","KES 5,000 - 12,000"],
              ["Wheel alignment","KES 2,500 - 5,000"],
              ["AC service","KES 5,000 - 12,000"],
              ["Suspension repair","KES 15,000 - 25,000"],
              ["Full diagnostic","KES 3,000 - 8,000"],
              ["Tyre replacement (each)","KES 8,000 - 30,000"],
              ["GO callout fee","KES 500 flat"],
              ["Transmission repair","KES 20,000 - 50,000"],
            ].map(([service,price])=>(
              <div key={service} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"#0f0f0f", borderRadius:8 }}>
                <span style={{ fontSize:12, color:"#888" }}>{service}</span>
                <span style={{ fontSize:12, color:"#e6821e", fontWeight:600 }}>{price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PARTS MARKETPLACE */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1000, margin:"0 auto 5rem", padding:"0 1.5rem" }}>
        <div style={{ background:"linear-gradient(135deg,#141414,#1a1a1a)", border:"1px solid #1e1e1e", borderRadius:20, padding:"2.5rem 2rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"2rem", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#e6821e", marginBottom:8 }}>Parts marketplace</div>
              <h2 style={{ fontFamily:"Syne", fontSize:"clamp(22px,3vw,32px)", fontWeight:800, marginBottom:12 }}>Order parts online. Delivered to your door.</h2>
              <p style={{ fontSize:13, color:"#666", lineHeight:1.8, marginBottom:"1.5rem" }}>Browse genuine and aftermarket parts from verified Nairobi shops. Order online, pay securely via M-Pesa, get it delivered by CCC riders.</p>
              {[["⚙️","Engine and mechanical parts"],["✨","Car accessories"],["🛞","Tyres all brands"],["🔋","Batteries and electrical"],["🛢️","Engine oils and fluids"]].map(([icon,label])=>(
                <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:16 }}>{icon}</span>
                  <span style={{ fontSize:13, color:"#888" }}>{label}</span>
                </div>
              ))}
              <button onClick={()=>navigate("/auth")} style={{ marginTop:"1.5rem", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px 28px", cursor:"pointer" }}>
                Browse parts →
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {[
                { icon:"🏪", title:"Pickup", desc:"Collect from shop" },
                { icon:"🚚", title:"Delivery", desc:"CCC riders deliver" },
                { icon:"✅", title:"Verified shops", desc:"All shops checked" },
                { icon:"💳", title:"Secure pay", desc:"M-Pesa or card" },
              ].map(f=>(
                <div key={f.title} style={{ background:"#0f0f0f", borderRadius:12, padding:"1rem", textAlign:"center" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{f.icon}</div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e8e4dc", marginBottom:4 }}>{f.title}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position:"relative", zIndex:1, textAlign:"center", padding:"4rem 1.5rem 6rem", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center, #e6821e08, transparent)", pointerEvents:"none" }}/>
        <img src="/logo.svg" alt="Car Care Connect" style={{ height:80, marginBottom:"1.5rem", animation:"glow 3s ease-in-out infinite", position:"relative" }}/>
        <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,5vw,52px)", fontWeight:800, marginBottom:16, position:"relative" }}>
          Nairobi's car care platform<br/><span style={{ color:"#e6821e" }}>starts here.</span>
        </h2>
        <p style={{ fontSize:15, color:"#666", maxWidth:440, margin:"0 auto 2.5rem", lineHeight:1.7, position:"relative" }}>
          Join thousands of car owners and mechanics already on CCC. Free to join. Available 24/7. Built for Nairobi.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", position:"relative" }}>
          <button onClick={()=>navigate("/auth")} style={{ background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"16px 40px", cursor:"pointer" }}>
            🚗 Get started free
          </button>
          <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"2px solid #333", borderRadius:12, color:"#666", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"14px 38px", cursor:"pointer" }}>
            Sign in →
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ position:"relative", zIndex:1, borderTop:"1px solid #141414", padding:"2.5rem 1.5rem", textAlign:"center" }}>
        <img src="/logo.svg" alt="Car Care Connect" style={{ height:44, marginBottom:16, opacity:0.5 }}/>
        <div style={{ display:"flex", gap:24, justifyContent:"center", flexWrap:"wrap", marginBottom:16 }}>
          {[["Privacy Policy","/privacy"],["Terms of Service","/terms"],["Contact","mailto:carcareconnect254@gmail.com"],["Support","mailto:carcareconnect254@gmail.com"]].map(([label,href])=>(
            <a key={label} href={href} style={{ fontSize:12, color:"#444", textDecoration:"none" }}>{label}</a>
          ))}
        </div>
        <div style={{ fontSize:12, color:"#333", marginBottom:6 }}>🇰🇪 Nairobi's most trusted automotive platform</div>
        <div style={{ fontSize:11, color:"#2a2a2a" }}>© 2026 Car Care Connect · Nairobi, Kenya · 0113858966 · carcareconnect254@gmail.com</div>
        <div style={{ fontSize:10, color:"#222", marginTop:6 }}>Payments secured by Pesapal · Regulated by Central Bank of Kenya</div>
      </footer>
    </div>
  )
}





