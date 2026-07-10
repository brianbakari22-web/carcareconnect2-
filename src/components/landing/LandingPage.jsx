import { useState, useEffect } from "react"

const NAV_LINKS = ["Services", "Marketplace", "How It Works", "Providers", "GO Service"]

const SERVICES = [
  { icon:"🔧", name:"General Service", desc:"Full vehicle checkup and service" },
  { icon:"🔴", name:"Brake Repair", desc:"Pads, discs, calipers" },
  { icon:"🛢", name:"Oil Change", desc:"Engine oil and filter" },
  { icon:"🛞", name:"Tyres", desc:"Supply, fit and balancing" },
  { icon:"🔋", name:"Battery", desc:"Test, replace and charge" },
  { icon:"❄", name:"AC Repair", desc:"Regas, repair and diagnostics" },
  { icon:"🔍", name:"Diagnostics", desc:"OBD scan and fault codes" },
  { icon:"🚿", name:"Car Wash", desc:"Interior and exterior detailing" },
  { icon:"🎨", name:"Painting", desc:"Respray and touch-up" },
  { icon:"🔨", name:"Body Repair", desc:"Dent removal and panel beating" },
  { icon:"🚨", name:"GO Emergency", desc:"24/7 roadside assistance" },
  { icon:"✅", name:"Inspection", desc:"Pre-purchase vehicle check" },
]

const STEPS = [
  { n:"01", title:"Search", desc:"Find verified mechanics and garages near you across Kenya" },
  { n:"02", title:"Compare", desc:"Compare prices, ratings and availability in real time" },
  { n:"03", title:"Book", desc:"Confirm your booking and pay securely via M-Pesa or card" },
  { n:"04", title:"Done", desc:"Track your service live and leave a review when complete" },
]

const TESTIMONIALS = [
  { initials:"JM", color:"#e6821e", name:"James M.", location:"Nairobi · Toyota Fielder", text:"Booked a mechanic at 10pm. He arrived in 12 minutes. Car fixed on the spot. This is the future of car care in Kenya." },
  { initials:"AW", color:"#378add", name:"Amina W.", location:"Mombasa · Mazda CX5", text:"Ordered brake pads through the parts marketplace. Delivered same day. Price was better than walking into a shop." },
  { initials:"PK", color:"#16a34a", name:"Peter K.", location:"Nakuru · Garage Owner", text:"As a garage owner CCC has tripled my monthly bookings. The dashboard is clean and payments are instant." },
]

const FAQS = [
  { q:"How do I book a service?", a:"Search for a provider near you, select a service, pick a time and confirm. You will receive a notification once the provider confirms your booking." },
  { q:"What is GO Service?", a:"GO Service is 24/7 emergency roadside assistance. A certified mechanic comes to your GPS location. Just KES 500 callout fee." },
  { q:"Is payment secure?", a:"All payments are processed through Pesapal — M-Pesa, Visa and Mastercard — regulated by the Central Bank of Kenya." },
  { q:"How do I become a provider?", a:"Sign up as a provider, choose your business type, add your services and start receiving customers. Registration is free." },
  { q:"Can I track my mechanic?", a:"Yes. Once your booking is confirmed you can track your mechanic or driver live on the map in real time." },
  { q:"How does parts delivery work?", a:"Browse the parts marketplace, pay via M-Pesa, choose pickup or delivery. CCC riders deliver across Kenya." },
  { q:"What is the Service Guarantee?", a:"File a claim within 7 days. We investigate and issue a full service voucher if the claim is approved." },
  { q:"Which towns does CCC cover?", a:"Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Thika and expanding to more Kenyan towns every month." },
]

const PROVIDERS = [
  { icon:"🔧", type:"Garage / Mechanic", keep:"90%", color:"#e6821e" },
  { icon:"⚙", type:"Parts Dealer", keep:"95%", color:"#378add" },
  { icon:"🛞", type:"Tyre Shop", keep:"94%", color:"#8b5cf6" },
  { icon:"🚿", type:"Car Wash", keep:"90%", color:"#1d9e75" },
  { icon:"⚡", type:"Auto Electrician", keep:"88%", color:"#f59e0b" },
  { icon:"🔨", type:"Panel Beater", keep:"85%", color:"#e24b4a" },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [activeTab, setActiveTab] = useState("customer")
  const nav = (path) => window.location.href = path

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", fn)
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const btn = { background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:15, fontWeight:700, padding:"14px 28px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }
  const btnOut = { background:"#fff", border:"2px solid #e0e0e0", borderRadius:12, color:"#0f172a", fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:600, padding:"13px 26px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }
  const eyebrow = { fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color:"#e6821e", display:"block", marginBottom:8 }
  const h2style = { fontFamily:"Syne,sans-serif", fontSize:"clamp(26px,4vw,40px)", fontWeight:800, letterSpacing:"-1px" }

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"#fff", color:"#0f172a", overflowX:"hidden" }}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap");
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        .lp-card{background:#fff;border-radius:20px;border:1.5px solid #f0f0f0;padding:1.75rem;transition:all 0.25s;}
        .lp-card:hover{border-color:#e6821e30;box-shadow:0 12px 40px rgba(0,0,0,0.08);transform:translateY(-4px);}
        .lp-svc{background:#f9f9f9;border-radius:16px;padding:1.5rem 1.25rem;text-align:center;border:1.5px solid transparent;transition:all 0.2s;cursor:pointer;}
        .lp-svc:hover{background:#fff8f0;border-color:#e6821e;transform:translateY(-4px);box-shadow:0 8px 24px rgba(230,130,30,0.12);}
        .lp-tab{background:none;border:none;font-family:DM Sans,sans-serif;font-size:14px;font-weight:600;color:#888;padding:10px 20px;cursor:pointer;border-radius:100px;transition:all 0.15s;}
        .lp-tab.on{background:#e6821e;color:#fff;}
        .lp-faq{border:1.5px solid #f0f0f0;border-radius:14px;margin-bottom:8px;overflow:hidden;cursor:pointer;}
        .lp-faq:hover{border-color:#e6821e30;}
        .wa-btn{position:fixed;bottom:28px;right:22px;background:#25d366;border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 20px rgba(37,211,102,0.5);text-decoration:none;z-index:999;}
        .prov-card{background:#fff;border:1.5px solid #f0f0f0;border-radius:16px;padding:1.25rem;text-align:center;transition:all 0.2s;cursor:pointer;}
        .prov-card:hover{transform:translateY(-4px);box-shadow:0 8px 28px rgba(0,0,0,0.08);}
        .town{background:#f8f8f8;border:1px solid #f0f0f0;border-radius:100px;padding:7px 16px;font-size:12px;color:#555;font-weight:500;display:inline-block;margin:4px;}
      `}</style>

      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,background:scrolled?"rgba(255,255,255,0.97)":"rgba(255,255,255,0.85)",backdropFilter:"blur(16px)",borderBottom:scrolled?"1px solid #f0f0f0":"1px solid transparent",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1.5rem",transition:"all 0.3s" }}>
        <div style={{ fontFamily:"Syne,sans-serif",fontSize:20,fontWeight:800,letterSpacing:"-0.5px",cursor:"pointer" }} onClick={()=>nav("/")}>Car<span style={{color:"#e6821e"}}>Care</span> Connect</div>
        <div style={{ display:"flex",gap:4 }}>
          {NAV_LINKS.map(l=><button key={l} style={{ background:"none",border:"none",color:"#475569",fontSize:13,fontWeight:500,padding:"7px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>{l}</button>)}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={()=>nav("/auth")} style={{ background:"none",border:"1.5px solid #e0e0e0",borderRadius:100,color:"#0f172a",fontSize:13,fontWeight:600,padding:"7px 18px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>Sign in</button>
          <button onClick={()=>nav("/auth")} style={{ background:"#e6821e",border:"none",borderRadius:100,color:"#fff",fontSize:13,fontWeight:700,padding:"8px 20px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>Get started</button>
        </div>
      </nav>

      <section style={{ paddingTop:64,minHeight:"94vh",display:"flex",alignItems:"center",background:"linear-gradient(160deg,#fff8f0 0%,#fff 55%,#f0f9ff 100%)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-100,right:-200,width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(230,130,30,0.08) 0%,transparent 70%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:1200,margin:"0 auto",padding:"4rem 1.5rem",width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem",alignItems:"center" }}>
          <div>
            <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #e6821e30",borderRadius:100,padding:"5px 14px",marginBottom:"1.5rem",fontSize:11,color:"#e6821e",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",boxShadow:"0 2px 12px rgba(230,130,30,0.1)" }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block" }}/>
              Kenya First Automotive Marketplace
            </div>
            <h1 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(38px,5vw,62px)",fontWeight:800,lineHeight:1.04,letterSpacing:"-2px",marginBottom:"1.25rem" }}>
              Car care,<br/><em style={{ color:"#e6821e",fontStyle:"normal" }}>connected</em><br/>to you.
            </h1>
            <p style={{ fontSize:17,color:"#475569",lineHeight:1.75,marginBottom:"2rem",maxWidth:460 }}>Book trusted mechanics, compare prices, buy genuine spare parts, and request concierge drivers. Across Kenya.</p>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap",marginBottom:"2rem" }}>
              <button style={btn} onClick={()=>nav("/auth")}>Book a mechanic</button>
              <button style={btnOut} onClick={()=>nav("/auth")}>Become a provider</button>
            </div>
            <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
              {["Verified providers","M-Pesa payments","Free to join"].map(l=>(
                <div key={l} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#888" }}>
                  <span style={{ color:"#16a34a",fontWeight:700 }}>✓</span>{l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:"relative" }}>
            <div style={{ borderRadius:24,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.12)" }}>
              <img src="https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=900&q=85" alt="Mechanic" style={{ width:"100%",height:480,objectFit:"cover",objectPosition:"center 30%",display:"block" }}/>
            </div>
            <div style={{ position:"absolute",top:24,left:-28,background:"#fff",borderRadius:16,padding:"12px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",display:"flex",alignItems:"center",gap:10,minWidth:180 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>✅</div>
              <div><div style={{ fontSize:12,fontWeight:700 }}>Verified Mechanic</div><div style={{ fontSize:10,color:"#888" }}>Background checked</div></div>
            </div>
            <div style={{ position:"absolute",bottom:48,left:-28,background:"#fff",borderRadius:16,padding:"12px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",display:"flex",alignItems:"center",gap:10,minWidth:190 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"#fff8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>📍</div>
              <div><div style={{ fontSize:12,fontWeight:700 }}>Booking confirmed</div><div style={{ fontSize:10,color:"#16a34a",fontWeight:600 }}>Mechanic on the way</div></div>
            </div>
            <div style={{ position:"absolute",top:80,right:-24,background:"#e24b4a",borderRadius:16,padding:"12px 16px",boxShadow:"0 8px 32px rgba(226,75,74,0.3)",minWidth:140 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#fff",marginBottom:2 }}>GO Service</div>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.8)" }}>Mechanic in 12 min</div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ background:"#e6821e",display:"grid",gridTemplateColumns:"repeat(4,1fr)" }}>
        {[{v:"24/7",l:"Emergency service"},{v:"100%",l:"Verified providers"},{v:"KES 500",l:"GO callout fee"},{v:"KE",l:"Kenya and Beyond"}].map((s,i)=>(
          <div key={s.l} style={{ padding:"1.5rem 1rem",textAlign:"center",borderRight:i<3?"1px solid rgba(255,255,255,0.2)":"none" }}>
            <div style={{ fontFamily:"Syne,sans-serif",fontSize:26,fontWeight:800,color:"#fff" }}>{s.v}</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.75)",marginTop:3,textTransform:"uppercase",letterSpacing:"0.06em" }}>{s.l}</div>
          </div>
        ))}
      </div>

      <section style={{ padding:"5rem 1.5rem",background:"#fff" }}>
        <div style={{ maxWidth:1000,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={eyebrow}>Why CCC</span>
            <h2 style={h2style}>Built for Kenya. Built for trust.</h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16 }}>
            {[{icon:"✅",t:"Verified mechanics only",d:"Every mechanic and provider is manually verified before listing on CCC."},{icon:"💰",t:"Transparent pricing",d:"See prices upfront. No hidden charges. Compare before you book."},{icon:"⚡",t:"Fast booking",d:"Book a service in under 60 seconds. Provider notified instantly."},{icon:"🛡",t:"Service guarantee",d:"Not satisfied? We investigate and issue a full service voucher refund."}].map(x=>(
              <div key={x.t} className="lp-card">
                <div style={{ fontSize:32,marginBottom:14 }}>{x.icon}</div>
                <div style={{ fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:6 }}>{x.t}</div>
                <div style={{ fontSize:13,color:"#64748b",lineHeight:1.65 }}>{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:900,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3.5rem" }}>
            <span style={eyebrow}>How it works</span>
            <h2 style={h2style}>Book in under 60 seconds</h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,position:"relative" }}>
            <div style={{ position:"absolute",top:36,left:"12.5%",right:"12.5%",height:2,background:"#e6821e",zIndex:0,opacity:0.2 }}/>
            {STEPS.map((s,i)=>(
              <div key={s.n} style={{ textAlign:"center",padding:"0 1rem",position:"relative",zIndex:1 }}>
                <div style={{ width:72,height:72,borderRadius:"50%",background:i===0?"#e6821e":"#fff",border:"2px solid "+(i===0?"#e6821e":"#e0e0e0"),display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1.25rem",fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:800,color:i===0?"#fff":"#e6821e",boxShadow:i===0?"0 4px 20px rgba(230,130,30,0.3)":"none" }}>
                  {s.n}
                </div>
                <div style={{ fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:12,color:"#64748b",lineHeight:1.65 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#fff" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={eyebrow}>Services</span>
            <h2 style={h2style}>Everything your car needs</h2>
            <p style={{ fontSize:15,color:"#64748b",marginTop:8 }}>Book any service from verified providers across Kenya</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12 }}>
            {SERVICES.map(s=>(
              <div key={s.name} className="lp-svc" onClick={()=>nav("/auth")}>
                <div style={{ fontSize:34,marginBottom:10 }}>{s.icon}</div>
                <div style={{ fontWeight:700,fontSize:13,color:"#0f172a",marginBottom:4 }}>{s.name}</div>
                <div style={{ fontSize:11,color:"#94a3b8",lineHeight:1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ position:"relative",overflow:"hidden" }}>
        <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&q=85" alt="GO Service" style={{ width:"100%",height:420,objectFit:"cover",objectPosition:"center 40%",display:"block" }}/>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.4) 55%,rgba(0,0,0,0) 100%)" }}/>
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",padding:"2rem 1.5rem" }}>
          <div style={{ maxWidth:480 }}>
            <span style={{ display:"inline-block",background:"#e24b4a",borderRadius:8,padding:"4px 12px",fontSize:10,fontWeight:700,color:"#fff",marginBottom:14,letterSpacing:"0.08em" }}>GO SERVICE 24/7 EMERGENCY</span>
            <h2 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(24px,4vw,44px)",fontWeight:800,color:"#fff",marginBottom:14,lineHeight:1.1 }}>Broke down anywhere in Kenya? We come to you.</h2>
            <p style={{ fontSize:14,color:"rgba(255,255,255,0.78)",lineHeight:1.75,marginBottom:"1.25rem" }}>Certified mechanics dispatched to your GPS in under 15 minutes. Just KES 500 callout fee.</p>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:"1.5rem" }}>
              {["Flat tyre","Dead battery","Out of fuel","Overheating","Towing"].map(t=>(
                <span key={t} style={{ background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:100,padding:"5px 12px",fontSize:11,color:"rgba(255,255,255,0.88)" }}>{t}</span>
              ))}
            </div>
            <button style={{ background:"#e24b4a",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:700,padding:"13px 24px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }} onClick={()=>nav("/auth")}>Request GO Service</button>
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:1000,margin:"0 auto",textAlign:"center" }}>
          <span style={eyebrow}>Platform</span>
          <h2 style={{ ...h2style,marginBottom:"0.5rem" }}>Built for everyone</h2>
          <p style={{ fontSize:14,color:"#64748b",marginBottom:"2rem" }}>Choose your role to see what CCC offers you</p>
          <div style={{ display:"inline-flex",background:"#fff",border:"1.5px solid #f0f0f0",borderRadius:100,padding:4,marginBottom:"2.5rem",gap:4 }}>
            {[["customer","Customer"],["provider","Provider"],["driver","Driver"]].map(([k,l])=>(
              <button key={k} className={"lp-tab"+(activeTab===k?" on":"")} onClick={()=>setActiveTab(k)}>{l}</button>
            ))}
          </div>
          {activeTab==="customer"&&(
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12 }}>
              {[{icon:"🔧",n:"Mechanic booking",d:"Verified garages near you"},{icon:"🚨",n:"GO Emergency",d:"24/7 roadside help"},{icon:"🚗",n:"Concierge",d:"Car pickup and delivery"},{icon:"🛒",n:"Parts",d:"Genuine parts delivered"},{icon:"📍",n:"Live tracking",d:"Track in real time"},{icon:"🎁",n:"Rewards",d:"Earn on every booking"}].map(s=>(
                <div key={s.n} className="lp-svc" style={{ background:"#fff" }}>
                  <div style={{ fontSize:30,marginBottom:10 }}>{s.icon}</div>
                  <div style={{ fontWeight:700,fontSize:13 }}>{s.n}</div>
                  <div style={{ fontSize:11,color:"#94a3b8",marginTop:4 }}>{s.d}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab==="provider"&&(
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12 }}>
              {PROVIDERS.map(p=>(
                <div key={p.type} className="prov-card">
                  <div style={{ fontSize:30,marginBottom:10 }}>{p.icon}</div>
                  <div style={{ fontWeight:700,fontSize:14,marginBottom:4 }}>{p.type}</div>
                  <div style={{ fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:800,color:p.color,marginBottom:4 }}>{p.keep}</div>
                  <div style={{ fontSize:11,color:"#94a3b8" }}>you keep per booking</div>
                </div>
              ))}
            </div>
          )}
          {activeTab==="driver"&&(
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12 }}>
              {[{icon:"📦",n:"Accept deliveries",d:"Pick up and drop off vehicles"},{icon:"🛒",n:"Parts delivery",d:"Deliver parts orders"},{icon:"📍",n:"Live navigation",d:"GPS-guided routes"},{icon:"💰",n:"Earn per trip",d:"15 percent plus KES 200 allowance"},{icon:"📊",n:"Earnings dashboard",d:"Track income and performance"},{icon:"🆘",n:"PANIC button",d:"Emergency alert with GPS"}].map(s=>(
                <div key={s.n} className="lp-svc" style={{ background:"#fff" }}>
                  <div style={{ fontSize:30,marginBottom:10 }}>{s.icon}</div>
                  <div style={{ fontWeight:700,fontSize:13 }}>{s.n}</div>
                  <div style={{ fontSize:11,color:"#94a3b8",marginTop:4 }}>{s.d}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#fff" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={eyebrow}>Marketplace</span>
            <h2 style={h2style}>Find the right provider</h2>
          </div>
          <div style={{ background:"#f8fafc",border:"2px solid #f0f0f0",borderRadius:16,padding:"10px 10px 10px 20px",display:"flex",alignItems:"center",gap:12,maxWidth:680,margin:"0 auto 2.5rem",boxShadow:"0 4px 20px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize:18,color:"#cbd5e1" }}>🔍</span>
            <input type="text" placeholder="Search mechanics, parts, services..." style={{ flex:1,border:"none",outline:"none",background:"transparent",fontSize:14,color:"#0f172a",fontFamily:"DM Sans,sans-serif" }}/>
            <button style={{ ...btn,padding:"10px 20px",fontSize:13,borderRadius:10 }}>Search</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16 }}>
            {[
              {icon:"🔧",name:"Westlands Auto Garage",type:"Garage Shop Standard",rating:4.8,reviews:124,dist:"0.8 km",price:"KES 2,500",tags:["Oil change","Brakes","Diagnostics"],bg:"#fff8f0",bd:"#e6821e20"},
              {icon:"⚙",name:"Karen Parts and Spares",type:"Parts Dealer",rating:4.6,reviews:89,dist:"1.2 km",price:"KES 450+",tags:["Engine parts","Brake pads","Filters"],bg:"#eff6ff",bd:"#bfdbfe"},
              {icon:"🚿",name:"Langata Premium Wash",type:"Car Wash",rating:4.9,reviews:67,dist:"1.8 km",price:"KES 800",tags:["Exterior","Interior","Detailing"],bg:"#f0fdf4",bd:"#bbf7d0"},
              {icon:"⚡",name:"Gigiri Auto Electricals",type:"Auto Electrician",rating:4.7,reviews:43,dist:"2.1 km",price:"KES 1,800",tags:["Wiring","Battery","Alternator"],bg:"#fefce8",bd:"#fde68a"},
            ].map(p=>(
              <div key={p.name} style={{ background:p.bg,border:"1.5px solid "+p.bd,borderRadius:18,padding:"1.25rem",cursor:"pointer" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <div style={{ width:44,height:44,borderRadius:12,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"1px solid rgba(0,0,0,0.06)" }}>{p.icon}</div>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:"#0f172a" }}>{p.name}</div>
                      <div style={{ fontSize:11,color:"#64748b",marginTop:1 }}>{p.type}</div>
                    </div>
                  </div>
                  <span style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:"#16a34a",flexShrink:0 }}>Verified</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:3,fontSize:12,fontWeight:600 }}><span style={{ color:"#f59e0b" }}>★</span>{p.rating} ({p.reviews})</div>
                  <span style={{ fontSize:11,color:"#94a3b8" }}>{p.dist} away</span>
                  <span style={{ marginLeft:"auto",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,color:"#e6821e" }}>{p.price}</span>
                </div>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:12 }}>
                  {p.tags.map(t=><span key={t} style={{ background:"rgba(255,255,255,0.8)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#475569" }}>{t}</span>)}
                </div>
                <button style={{ ...btn,width:"100%",justifyContent:"center",padding:"10px",fontSize:13 }} onClick={()=>nav("/auth")}>Book now</button>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center",marginTop:"2rem" }}>
            <button style={btnOut} onClick={()=>nav("/auth")}>View all providers</button>
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:1000,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={eyebrow}>Reviews</span>
            <h2 style={h2style}>What Kenyans are saying</h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16 }}>
            {TESTIMONIALS.map(t=>(
              <div key={t.name} className="lp-card">
                <div style={{ display:"flex",gap:2,marginBottom:12 }}>{[1,2,3,4,5].map(i=><span key={i} style={{ color:"#f59e0b",fontSize:16 }}>★</span>)}</div>
                <p style={{ fontSize:13,color:"#475569",lineHeight:1.75,marginBottom:"1.25rem",fontStyle:"italic" }}>{t.text}</p>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:38,height:38,borderRadius:"50%",background:t.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0 }}>{t.initials}</div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13,color:"#0f172a" }}>{t.name}</div>
                    <div style={{ fontSize:11,color:"#94a3b8" }}>{t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"4rem 1.5rem",background:"#fff8f0",textAlign:"center" }}>
        <div style={{ maxWidth:700,margin:"0 auto" }}>
          <span style={eyebrow}>Coverage</span>
          <h2 style={{ ...h2style,marginBottom:"0.5rem" }}>Available across Kenya</h2>
          <p style={{ fontSize:13,color:"#94a3b8",marginBottom:"1.5rem" }}>Expanding town by town across the country</p>
          <div style={{ display:"flex",gap:0,flexWrap:"wrap",justifyContent:"center" }}>
            {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru","Kitale","Malindi","Garissa","Kisii","Kakamega","Rongai"].map(t=>(
              <span key={t} className="town">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:680,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"2.5rem" }}>
            <span style={eyebrow}>FAQ</span>
            <h2 style={h2style}>Frequently asked questions</h2>
          </div>
          {FAQS.map((f,i)=>(
            <div key={i} className="lp-faq" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
              <div style={{ padding:"1rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                <span style={{ fontSize:14,fontWeight:600,color:"#0f172a" }}>{f.q}</span>
                <span style={{ color:"#e6821e",fontSize:20,flexShrink:0,transform:openFaq===i?"rotate(45deg)":"rotate(0)",transition:"transform 0.2s" }}>+</span>
              </div>
              {openFaq===i&&<div style={{ padding:"0 1.25rem 1rem",fontSize:13,color:"#64748b",lineHeight:1.75 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#0f172a" }}>
        <div style={{ maxWidth:560,margin:"0 auto",textAlign:"center" }}>
          <h2 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(28px,5vw,44px)",fontWeight:800,color:"#fff",marginBottom:"1rem",lineHeight:1.1 }}>
            Get the CCC app. <span style={{ color:"#e6821e" }}>Kenya car care in your pocket.</span>
          </h2>
          <p style={{ fontSize:14,color:"#64748b",marginBottom:"2rem",lineHeight:1.75 }}>Free to download. Available 24/7. No subscription required.</p>
          <div style={{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap" }}>
            <a href="https://play.google.com/store/apps/details?id=care.carcareconnect.app" target="_blank" rel="noopener noreferrer"
              style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,textDecoration:"none" }}>
              <span style={{ fontSize:22 }}>▶</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:9,color:"#888" }}>Get it on</div>
                <div style={{ fontSize:13,color:"#fff",fontWeight:700 }}>Google Play</div>
              </div>
            </a>
            <a href="https://wa.me/254113858966" target="_blank" rel="noopener noreferrer"
              style={{ background:"#25d366",borderRadius:14,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,textDecoration:"none" }}>
              <span style={{ fontSize:22 }}>💬</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:9,color:"rgba(255,255,255,0.75)" }}>Chat us on</div>
                <div style={{ fontSize:13,color:"#fff",fontWeight:700 }}>WhatsApp</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 1.5rem",background:"#e6821e",textAlign:"center",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"relative",zIndex:1,maxWidth:500,margin:"0 auto" }}>
          <h2 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(28px,5vw,46px)",fontWeight:800,color:"#fff",marginBottom:"1rem",lineHeight:1.1 }}>Ready to take care of your car?</h2>
          <p style={{ fontSize:14,color:"rgba(255,255,255,0.85)",marginBottom:"2rem",lineHeight:1.75 }}>Free to join. No subscriptions. Available 24/7 across Kenya.</p>
          <div style={{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap" }}>
            <button style={{ background:"#fff",border:"none",borderRadius:12,color:"#e6821e",fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700,padding:"14px 28px",cursor:"pointer" }} onClick={()=>nav("/auth")}>Book now it is free</button>
            <button style={{ background:"rgba(255,255,255,0.12)",border:"1.5px solid rgba(255,255,255,0.3)",borderRadius:12,color:"#fff",fontSize:14,fontWeight:600,padding:"13px 24px",cursor:"pointer" }} onClick={()=>window.open("https://wa.me/254113858966","_blank")}>WhatsApp us</button>
          </div>
        </div>
      </section>

      <footer style={{ background:"#0a0a0a",padding:"3.5rem 1.5rem 2rem" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:"2.5rem",marginBottom:"2.5rem",paddingBottom:"2.5rem",borderBottom:"1px solid #1a1a1a" }}>
            <div>
              <div style={{ fontFamily:"Syne,sans-serif",fontSize:20,fontWeight:800,color:"#fff",marginBottom:10 }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
              <p style={{ fontSize:12,color:"#475569",lineHeight:1.75,maxWidth:220,marginBottom:"1.25rem" }}>Kenya most trusted automotive platform. Built for Kenyan roads, scaling across Africa.</p>
              <div style={{ display:"flex",gap:8 }}>
                {["💬","📸","🐦","▶"].map((ic,idx)=>(
                  <div key={idx} style={{ width:32,height:32,background:"#1a1a1a",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer" }}>{ic}</div>
                ))}
              </div>
            </div>
            {[
              {t:"Services",l:["Mechanic booking","GO Emergency","Parts marketplace","Concierge","Car Wash"]},
              {t:"For Business",l:["Register garage","List parts shop","Become a driver","Pricing","Provider dashboard"]},
              {t:"Company",l:["About CCC","Blog","Privacy Policy","Terms of Service","Press"]},
              {t:"Support",l:["0113858966","carcareconnect254@gmail.com","WhatsApp us","Help centre","Report an issue"]},
            ].map(col=>(
              <div key={col.t}>
                <div style={{ fontSize:11,fontWeight:700,color:"#fff",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14 }}>{col.t}</div>
                {col.l.map(lk=><div key={lk} style={{ fontSize:12,color:"#475569",marginBottom:9,cursor:"pointer" }}>{lk}</div>)}
              </div>
            ))}
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
            <div style={{ fontSize:11,color:"#1e293b" }}>2026 Car Care Connect Kenya Payments by Pesapal Regulated by CBK</div>
            <div style={{ fontSize:11,color:"#1e293b" }}>Built in Kenya Scaling across Africa</div>
          </div>
        </div>
      </footer>

      <a href="https://wa.me/254113858966" target="_blank" rel="noopener noreferrer" className="wa-btn">💬</a>
    </div>
  )
}
