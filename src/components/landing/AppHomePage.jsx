import { useState, useEffect, useRef } from "react"

const ROLES = [
  { key:"customer", emoji:"Customer", label:"Customers", title:"Vehicle Owners", tagline:"Book, track & relax.", desc:"Find verified mechanics near you, get 24/7 emergency help, order genuine parts all from your phone.", color:"#e6821e", bg:"#fff8f0", border:"#e6821e25", img:"https://images.unsplash.com/photo-1611448746128-7c39e03b71e4?w=700&q=85", actions:["Book a mechanic","GO Emergency","Order parts","Track my car"], path:"/auth" },
  { key:"provider", emoji:"Garage", label:"Garages", title:"Garages and Shops", tagline:"List. Earn. Grow.", desc:"Reach thousands of vehicle owners across Kenya. Manage bookings, dispatch mechanics and get paid instantly.", color:"#378add", bg:"#eff6ff", border:"#378add25", img:"https://images.unsplash.com/photo-1551522435-b2347f669045?w=700&q=85", actions:["Manage bookings","View earnings","GO requests","Manage mechanics"], path:"/auth" },
  { key:"mechanic", emoji:"Mechanic", label:"Mechanics", title:"Mechanics", tagline:"Get jobs. Get paid.", desc:"Get job assignments from your garage, track earnings, upload service photos and grow your reputation.", color:"#1d9e75", bg:"#f0fdf4", border:"#1d9e7525", img:"https://images.unsplash.com/photo-1702146713858-8e7d1cc29fe8?w=700&q=85", actions:["View assigned jobs","Track earnings","Request parts","Service photos"], path:"/mechanic-login" },
  { key:"driver", emoji:"Driver", label:"Drivers", title:"Drivers", tagline:"Drive. Deliver. Earn.", desc:"Accept vehicle pickup and parts delivery jobs across Kenya. GPS routes, earnings dashboard and a PANIC button.", color:"#8b5cf6", bg:"#faf5ff", border:"#8b5cf625", img:"https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=700&q=85", actions:["Available jobs","Active delivery","My earnings","Performance"], path:"/auth" },
  { key:"dealer", emoji:"Dealer", label:"Dealers", title:"Parts Dealers", tagline:"List parts. Sell more.", desc:"Sell genuine and aftermarket parts online. Manage inventory, fulfill orders and reach mechanics across Kenya.", color:"#f59e0b", bg:"#fefce8", border:"#f59e0b25", img:"https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=700&q=85", actions:["My inventory","Incoming orders","Sales analytics","Add new parts"], path:"/auth" },
]

const SERVICES = [
  { emoji:"Mechanic", name:"Mechanic" },
  { emoji:"Emergency", name:"Emergency" },
  { emoji:"Parts", name:"Parts" },
  { emoji:"Concierge", name:"Concierge" },
  { emoji:"Car Wash", name:"Car Wash" },
  { emoji:"Diagnostics", name:"Diagnostics" },
  { emoji:"Tyres", name:"Tyres" },
  { emoji:"Electrical", name:"Electrical" },
]

const SVC_ICONS = {
  mech:"Fix", sos:"SOS", parts:"Box", car:"Car", wash:"Wsh", diag:"Dig", tyre:"Tyr", elec:"Zap"
}

const ROLE_ICONS = {
  customer:"cust", provider:"wrch", mechanic:"mech", driver:"drvr", dealer:"dlr"
}

export default function AppHomePage() {
  const [activeRole, setActiveRole] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [paused, setPaused] = useState(false)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [holdTimer, setHoldTimer] = useState(null)
  const nav = (path) => window.location.href = path

  const goToRole = (i) => {
    setActiveRole(i)
    setAnimKey(k => k + 1)
    setPaused(false)
  }

  const goNext = () => {
    setActiveRole(prev => {
      const next = (prev + 1) % ROLES.length
      setAnimKey(k => k + 1)
      return next
    })
    setPaused(false)
  }

  const goPrev = () => {
    setActiveRole(prev => {
      const next = (prev - 1 + ROLES.length) % ROLES.length
      setAnimKey(k => k + 1)
      return next
    })
    setPaused(false)
  }

  // Touch handlers - swipe + hold to pause
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX)
    setTouchEnd(null)
    // Hold to pause after 200ms
    const t = setTimeout(() => setPaused(true), 200)
    setHoldTimer(t)
  }

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
    // If moving, cancel hold
    if (holdTimer) { clearTimeout(holdTimer); setHoldTimer(null) }
  }

  const handleTouchEnd = () => {
    if (holdTimer) { clearTimeout(holdTimer); setHoldTimer(null) }
    setPaused(false)
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > 50) goNext()
    else if (distance < -50) goPrev()
  }

  useEffect(() => {
    if (paused) return
    const interval = setInterval(goNext, 5000)
    return () => clearInterval(interval)
  }, [paused, activeRole])

  const role = ROLES[activeRole]

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"#f5f5f5", minHeight:"100vh", overflowX:"hidden" }}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap");
        *{box-sizing:border-box;margin:0;padding:0;}
        .role-tab{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 14px;border-radius:14px;border:2px solid #eee;cursor:pointer;transition:all 0.25s;background:#fff;min-width:72px;}
        .role-tab.on{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.1);}
        .svc-btn{background:#fff;border:1px solid #eee;border-radius:14px;padding:13px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:all 0.18s;}
        .svc-btn:active{transform:scale(0.95);}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .slide-up{animation:slideUp 0.38s ease forwards;}
        @keyframes prog{from{width:0}to{width:100%}}
        .prog-fill{height:100%;border-radius:100px;animation:prog 5s linear forwards;}
        .prog-fill[style*="paused"]{animation-play-state:paused;}
        .trust-item{background:#fff;border-radius:14px;padding:12px;display:flex;align-items:flex-start;gap:10px;border:1px solid #f0f0f0;}
        .town-pill{background:#fff;border:1px solid #e6821e20;border-radius:100px;padding:5px 12px;font-size:11px;color:#555;display:inline-block;margin:3px;}
      `}</style>

      {/* HEADER */}
      <div style={{ background:"#fff", padding:"3rem 1.25rem 1rem", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.875rem" }}>
          <div>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:21, fontWeight:800, letterSpacing:"-0.5px" }}>Car<span style={{color:"#e6821e"}}>Care</span> Connect</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:1 }}>Kenya automotive marketplace</div>
          </div>
          <button onClick={()=>nav("/auth")} style={{ background:"#e6821e", border:"none", borderRadius:100, color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>Get started</button>
        </div>
        <div onClick={()=>nav("/auth")} style={{ background:"#f5f5f5", border:"1.5px solid #eee", borderRadius:13, padding:"11px 14px", display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
          <span style={{ fontSize:15, color:"#bbb" }}>Srch</span>
          <span style={{ fontSize:13, color:"#bbb" }}>Mechanics, parts, services...</span>
        </div>
      </div>

      <div style={{ padding:"1.25rem", display:"flex", flexDirection:"column", gap:"1.25rem" }}>

        {/* ONE PLATFORM EVERYONE WELCOME */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.875rem" }}>
            <div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, color:"#000" }}>One platform.</div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, color:"#e6821e" }}>Everyone welcome.</div>
            </div>
            <div style={{ fontSize:11, color:"#aaa", fontWeight:500 }}>{activeRole+1} of {ROLES.length}</div>
          </div>

          {/* ROLE TABS */}
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8, marginBottom:"0.875rem" }}>
            {ROLES.map((r,i)=>(
              <div key={r.key} className={"role-tab"+(activeRole===i?" on":"")}
                style={{ borderColor:activeRole===i?r.color:"#eee", background:activeRole===i?r.bg:"#fff" }}
                onClick={()=>goToRole(i)}>
                <span style={{ fontSize:22, fontFamily:"Syne,sans-serif", fontWeight:800, color:r.color }}>{ROLE_ICONS[r.key]}</span>
                <span style={{ fontSize:10, fontWeight:700, color:activeRole===i?r.color:"#888", whiteSpace:"nowrap" }}>{r.label}</span>
              </div>
            ))}
          </div>

          {/* PROGRESS BAR */}
          <div style={{ height:3, borderRadius:100, background:"#ebebeb", marginBottom:"0.875rem", overflow:"hidden" }}>
            <div key={paused ? "paused" : animKey} className="prog-fill"
              style={{ background:role.color, animationPlayState:paused?"paused":"running" }}/>
          </div>

          {/* ROLE CARD */}
          <div key={"card"+animKey} className="slide-up"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ background:"#fff", borderRadius:22, overflow:"hidden", border:"1.5px solid "+role.border, boxShadow:"0 6px 32px rgba(0,0,0,0.08)", userSelect:"none" }}>
            <div style={{ position:"relative" }}>
              <img src={role.img} alt={role.title} style={{ width:"100%", height:220, objectFit:"cover", objectPosition:"center 30%", display:"block" }}/>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,"+role.color+"f0 0%,"+role.color+"50 45%,transparent 75%)" }}/>
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"1.25rem" }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.3)", backdropFilter:"blur(4px)", borderRadius:100, padding:"4px 12px", marginBottom:8 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.08em" }}>{role.title}</span>
                </div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:24, fontWeight:800, color:"#fff", lineHeight:1.1, marginBottom:6 }}>{role.tagline}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.9)", lineHeight:1.65 }}>{role.desc}</div>
              </div>
            </div>
            <div style={{ padding:"1rem 1.25rem 1.25rem" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.625rem" }}>What you can do</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:"1rem" }}>
                {role.actions.map(a=>(
                  <div key={a} style={{ display:"flex", alignItems:"center", gap:8, background:role.bg, border:"1.5px solid "+role.border, borderRadius:10, padding:"9px 12px", fontSize:12, fontWeight:600, color:role.color }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:role.color, flexShrink:0 }}/>
                    {a}
                  </div>
                ))}
              </div>
              <button onClick={()=>nav(role.path)} style={{ width:"100%", background:role.color, border:"none", borderRadius:13, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:"pointer", boxShadow:"0 4px 16px "+role.color+"44" }}>
                Join as {role.title} and get started
              </button>
            </div>
          </div>

          {/* DOTS */}
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:"0.875rem" }}>
            {ROLES.map((r,i)=>(
              <div key={i} onClick={()=>goToRole(i)} style={{ height:6, borderRadius:100, cursor:"pointer", width:activeRole===i?22:6, background:activeRole===i?r.color:"#ddd", transition:"all 0.35s ease" }}/>
            ))}
          </div>
        </div>

        {/* GO EMERGENCY */}
        <div onClick={()=>nav("/auth")} style={{ borderRadius:20, overflow:"hidden", cursor:"pointer", boxShadow:"0 6px 24px rgba(226,75,74,0.2)", position:"relative" }}>
          <img src="https://images.unsplash.com/photo-1639927676452-984f8210befc?w=800&q=85" alt="Broken down vehicle" style={{ width:"100%", height:150, objectFit:"cover", objectPosition:"center 40%", display:"block" }}/>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,rgba(226,75,74,0.94) 0%,rgba(226,75,74,0.65) 55%,rgba(0,0,0,0.15) 100%)" }}/>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", padding:"1rem 1.25rem", gap:14 }}>
            <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,0.18)", border:"2px solid rgba(255,255,255,0.35)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontFamily:"Syne,sans-serif", fontSize:17, fontWeight:800, color:"#fff", lineHeight:1 }}>GO</span>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.8)", fontWeight:700, marginTop:2 }}>24/7</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.75)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Emergency Service</div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, color:"#fff", lineHeight:1.15, marginBottom:3 }}>Broke down? We come to you.</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)", fontWeight:500 }}>KES 500 callout · Under 15 min</div>
            </div>
            <div style={{ background:"#fff", borderRadius:10, padding:"9px 13px", flexShrink:0 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:800, color:"#e24b4a", lineHeight:1.25 }}>Request</div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:800, color:"#e24b4a", lineHeight:1.25 }}>now</div>
            </div>
          </div>
        </div>

        {/* SERVICES */}
        <div>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, color:"#000", marginBottom:"0.875rem" }}>Our services</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            {SERVICES.map(s=>(
              <div key={s.name} className="svc-btn" onClick={()=>nav("/auth")}>
                <span style={{ fontSize:11, fontFamily:"Syne,sans-serif", fontWeight:700, color:"#e6821e" }}>{s.name.substring(0,4)}</span>
                <span style={{ fontSize:10, fontWeight:600, color:"#555", textAlign:"center" }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MINI ROLE STRIP */}
        <div>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, color:"#000", marginBottom:"0.875rem" }}>Built for everyone</div>
          <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
            {ROLES.map((r,i)=>(
              <div key={r.key} onClick={()=>{ goToRole(i); window.scrollTo({top:0,behavior:"smooth"}) }}
                style={{ background:"#fff", border:"1.5px solid "+r.border, borderRadius:18, padding:"0.875rem", minWidth:136, cursor:"pointer", flexShrink:0 }}>
                <div style={{ position:"relative", borderRadius:12, overflow:"hidden", height:78, marginBottom:10 }}>
                  <img src={r.img} alt={r.title} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 30%", display:"block" }}/>
                  <div style={{ position:"absolute", inset:0, background:r.color+"99" }}/>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:800, color:"#fff" }}>{r.label}</div>
                </div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, color:"#000", marginBottom:3 }}>{r.title}</div>
                <div style={{ fontSize:10, color:r.color, fontWeight:600 }}>{r.tagline}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TRUST */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[{t:"Verified providers",d:"Every business manually vetted"},{t:"Secure payments",d:"M-Pesa and card via Pesapal"},{t:"Live tracking",d:"GPS every job, every time"},{t:"Service guarantee",d:"Full refund if unsatisfied"}].map(x=>(
            <div key={x.t} className="trust-item">
              <span style={{ fontSize:14, fontWeight:800, color:"#16a34a", flexShrink:0 }}>ok</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#000" }}>{x.t}</div>
                <div style={{ fontSize:10, color:"#888", marginTop:2, lineHeight:1.5 }}>{x.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* COVERAGE */}
        <div style={{ background:"#fff8f0", borderRadius:18, padding:"1.25rem", border:"1px solid #e6821e18" }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:"0.75rem" }}>Launching in Nairobi first</div>
          <div style={{ fontSize:11, color:"#aaa", marginBottom:"0.75rem" }}>Expanding county by county across Kenya</div>
          <div style={{ display:"flex", gap:0, flexWrap:"wrap" }}>
            {[{n:"Nairobi",live:true},{n:"Mombasa",live:false},{n:"Kisumu",live:false},{n:"Nakuru",live:false},{n:"Eldoret",live:false},{n:"Thika",live:false},{n:"Nyeri",live:false},{n:"Machakos",live:false},{n:"Meru",live:false},{n:"Kitale",live:false},{n:"Malindi",live:false},{n:"Garissa",live:false}].map(t=>(
              <span key={t.n} className="town-pill" style={{ background:t.live?"#e6821e":"#fff", color:t.live?"#fff":"#555", border:t.live?"1px solid #e6821e":"1px solid #e6821e20", fontWeight:t.live?700:500 }}>{t.n}{t.live?" live":""}</span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background:"#e6821e", borderRadius:22, padding:"1.5rem", position:"relative", overflow:"hidden", textAlign:"center" }}>
          <div style={{ position:"absolute", top:-24, right:-24, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.08)" }}/>
          <div style={{ position:"absolute", bottom:-36, left:-24, width:130, height:130, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }}/>
          <div style={{ position:"relative", zIndex:1 }}>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:19, fontWeight:800, color:"#fff", marginBottom:6, lineHeight:1.2 }}>Join Kenya automotive marketplace.</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginBottom:"1.25rem", lineHeight:1.65 }}>Free to join. No subscriptions. Available 24/7 across Kenya.</div>
            <button onClick={()=>nav("/auth")} style={{ width:"100%", background:"#fff", border:"none", borderRadius:12, color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"13px", cursor:"pointer" }}>Get started free</button>
          </div>
        </div>

        <div style={{ textAlign:"center", fontSize:11, color:"#bbb", paddingBottom:"0.5rem" }}>2026 Car Care Connect Kenya Payments by Pesapal</div>
      </div>
    </div>
  )
}
