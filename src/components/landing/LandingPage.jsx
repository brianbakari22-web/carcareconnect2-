import { useState, useEffect } from "react"

const NAV_LINKS = ["Services", "Marketplace", "Providers", "GO Service", "FAQ"]

const ROLES = [
  { key:"customer", icon:"Car", title:"Vehicle Owners", tagline:"Book, track, relax.", desc:"Find verified mechanics near you, get 24/7 emergency help, order genuine parts and track every job live.", color:"#e6821e", bg:"#fff8f0", border:"#e6821e25", img:"https://images.unsplash.com/photo-1611448746128-7c39e03b71e4?w=600&q=80", cta:"Book a service", path:"/auth", perks:["Verified mechanics","Live GPS tracking","M-Pesa payments","Service guarantee"] },
  { key:"provider", icon:"Fix", title:"Garages and Shops", tagline:"List. Earn. Grow.", desc:"Reach thousands of vehicle owners across Kenya. Manage bookings, dispatch mechanics and receive instant payments.", color:"#378add", bg:"#eff6ff", border:"#378add25", img:"https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600&q=80", cta:"List your business", path:"/auth", perks:["Keep up to 95%","Free to register","Real-time bookings","Mechanic management"] },
  { key:"mechanic", icon:"Wrn", title:"Mechanics", tagline:"Get jobs. Get paid.", desc:"Receive job assignments from your garage, track your earnings, upload before and after photos and grow your reputation.", color:"#1d9e75", bg:"#f0fdf4", border:"#1d9e7525", img:"https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600&q=80", cta:"Join as mechanic", path:"/mechanic-login", perks:["Assigned jobs","Earnings dashboard","Photo documentation","Parts requests"] },
  { key:"driver", icon:"Drv", title:"Drivers", tagline:"Drive. Deliver. Earn.", desc:"Accept vehicle pickup and parts delivery jobs across Kenya. GPS-guided routes, earnings tracking and a PANIC button for safety.", color:"#8b5cf6", bg:"#faf5ff", border:"#8b5cf625", img:"https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&q=80", cta:"Become a driver", path:"/auth", perks:["Earn per delivery","GPS navigation","PANIC button","Performance tracking"] },
  { key:"dealer", icon:"Pts", title:"Parts Dealers", tagline:"List parts. Sell more.", desc:"Sell genuine and aftermarket parts online. Manage inventory, fulfill orders and reach mechanics and vehicle owners across Kenya.", color:"#f59e0b", bg:"#fefce8", border:"#f59e0b25", img:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80", cta:"List your parts", path:"/auth", perks:["Keep 95%","Inventory management","Order fulfillment","Delivery network"] },
]

const SERVICES = [
  { icon:"Fix", name:"Mechanic booking", desc:"Verified garages near you" },
  { icon:"SOS", name:"GO Emergency", desc:"24/7 roadside help" },
  { icon:"Car", name:"Concierge", desc:"Car pickup and return" },
  { icon:"Box", name:"Parts marketplace", desc:"Genuine parts delivered" },
  { icon:"Wsh", name:"Car wash", desc:"Book a wash near you" },
  { icon:"Dig", name:"Diagnostics", desc:"OBD scan and fault codes" },
  { icon:"Tyr", name:"Tyre service", desc:"Supply, fit and balance" },
  { icon:"Zap", name:"Auto electrical", desc:"Wiring, battery, alternator" },
  { icon:"Pnt", name:"Painting", desc:"Respray and touch-up" },
  { icon:"Bdy", name:"Body repair", desc:"Dent removal and panels" },
  { icon:"Chk", name:"Inspection", desc:"Pre-purchase vehicle check" },
  { icon:"Rwd", name:"Loyalty rewards", desc:"Earn on every booking" },
]

const TESTIMONIALS = [
  { initials:"JM", color:"#e6821e", name:"James M.", role:"Vehicle owner Nairobi", text:"Booked a mechanic at 10pm. He arrived in 12 minutes. Car fixed on the spot. This is the future of car care in Kenya." },
  { initials:"PK", color:"#378add", name:"Peter K.", role:"Garage owner Nakuru", text:"CCC has tripled my monthly bookings. The dashboard is clean, payments are instant and I can manage all my mechanics from one place." },
  { initials:"AM", color:"#1d9e75", name:"Amina M.", role:"Mechanic Mombasa", text:"I get job notifications instantly. The before and after photo system helps me show my work quality. My reputation has grown massively." },
  { initials:"DK", color:"#8b5cf6", name:"David K.", role:"Driver Kisumu", text:"I earn daily doing vehicle pickups and parts deliveries. The GPS is accurate and the PANIC button gives me confidence on the road." },
  { initials:"SW", color:"#f59e0b", name:"Sarah W.", role:"Parts dealer Eldoret", text:"My parts shop went online and I now sell to mechanics across Kenya. Inventory management is seamless and payments are always on time." },
  { initials:"TN", color:"#e24b4a", name:"Tom N.", role:"Vehicle owner Thika", text:"The GO Service saved me on the Thika highway at night. Mechanic arrived in 18 minutes and fixed my tyre. Absolutely brilliant." },
]

const FAQS = [
  { q:"How do I book a service?", a:"Search for a provider near you, select a service, pick a time and confirm. You will receive a notification once the provider confirms your booking." },
  { q:"What is GO Service?", a:"GO Service is 24/7 emergency roadside assistance. A certified mechanic comes to your exact GPS location when your car breaks down anywhere in Kenya. Just KES 500 callout fee." },
  { q:"Is payment secure?", a:"All payments are processed through Pesapal - M-Pesa, Visa and Mastercard - regulated by the Central Bank of Kenya." },
  { q:"How do I register my business?", a:"Sign up, choose your business type, add your services or inventory and go live immediately. Registration is completely free." },
  { q:"How do mechanics get jobs?", a:"Mechanics are assigned jobs by their garage manager through the CCC platform. They receive real-time notifications and can track earnings from their own dashboard." },
  { q:"Can I track my mechanic?", a:"Yes. Once your booking is confirmed you can track your mechanic or driver live on the map inside the app in real time." },
  { q:"How does parts delivery work?", a:"Browse the parts marketplace, pay via M-Pesa or card, choose pickup or delivery. CCC drivers deliver parts across Kenya." },
  { q:"What is the Service Guarantee?", a:"If you are not satisfied with a completed service, file a claim within 7 days. We investigate and issue a full service voucher if the claim is approved." },
]

const PROVIDERS = [
  { icon:"Fix", type:"Garage / Mechanic", keep:"90%", color:"#e6821e", desc:"Shop standard bookings" },
  { icon:"Pts", type:"Parts Dealer", keep:"95%", color:"#378add", desc:"Lowest platform fee" },
  { icon:"Tyr", type:"Tyre Shop", keep:"94%", color:"#8b5cf6", desc:"Tyre sales and fitting" },
  { icon:"Wsh", type:"Car Wash", keep:"90%", color:"#1d9e75", desc:"Wash queue management" },
  { icon:"Zap", type:"Auto Electrician", keep:"88%", color:"#f59e0b", desc:"Electrical service bookings" },
  { icon:"Bdy", type:"Panel Beater", keep:"85%", color:"#e24b4a", desc:"Bodywork bookings" },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [activeRole, setActiveRole] = useState(0)
  const nav = (path) => window.location.href = path

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", fn)
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const EB = { fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color:"#e6821e", display:"block", marginBottom:8 }
  const H2 = { fontFamily:"Syne,sans-serif", fontSize:"clamp(26px,4vw,40px)", fontWeight:800, letterSpacing:"-1px" }
  const BP = { background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:15, fontWeight:700, padding:"14px 28px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }
  const BO = { background:"#fff", border:"2px solid #e0e0e0", borderRadius:12, color:"#0f172a", fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:600, padding:"13px 26px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }
  const role = ROLES[activeRole]

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"#fff", color:"#0f172a", overflowX:"hidden" }}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap");
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        .lp-card{background:#fff;border-radius:20px;border:1.5px solid #f0f0f0;padding:1.75rem;transition:all 0.25s;}
        .lp-card:hover{border-color:#e6821e30;box-shadow:0 12px 40px rgba(0,0,0,0.08);transform:translateY(-4px);}
        .svc-card{background:#f9f9f9;border-radius:16px;padding:1.5rem 1.25rem;text-align:center;border:1.5px solid transparent;transition:all 0.2s;cursor:pointer;}
        .svc-card:hover{background:#fff8f0;border-color:#e6821e;transform:translateY(-4px);box-shadow:0 8px 24px rgba(230,130,30,0.12);}
        .role-tab{background:#f8f8f8;border:1.5px solid transparent;border-radius:100px;padding:8px 18px;font-size:13px;font-weight:600;color:#888;cursor:pointer;transition:all 0.2s;white-space:nowrap;font-family:DM Sans,sans-serif;}
        .role-tab.on{background:#e6821e;color:#fff;border-color:#e6821e;}
        .faq-item{border:1.5px solid #f0f0f0;border-radius:14px;margin-bottom:8px;overflow:hidden;cursor:pointer;}
        .faq-item:hover{border-color:#e6821e30;}
        .prov-card{background:#fff;border:1.5px solid #f0f0f0;border-radius:18px;padding:1.5rem;text-align:center;transition:all 0.2s;cursor:pointer;}
        .prov-card:hover{transform:translateY(-4px);box-shadow:0 8px 28px rgba(0,0,0,0.08);}
        .town{background:#f8f8f8;border:1px solid #f0f0f0;border-radius:100px;padding:7px 16px;font-size:12px;color:#555;font-weight:500;display:inline-block;margin:4px;}
        .wa-float{position:fixed;bottom:28px;right:22px;background:#25d366;border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 4px 20px rgba(37,211,102,0.5);text-decoration:none;z-index:999;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.4s ease forwards;}
        .role-img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block;transition:transform 0.4s ease;}
        .role-img-wrap:hover .role-img{transform:scale(1.03);}
      `}</style>

      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,background:scrolled?"rgba(255,255,255,0.97)":"rgba(255,255,255,0.85)",backdropFilter:"blur(16px)",borderBottom:scrolled?"1px solid #f0f0f0":"1px solid transparent",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 2rem",transition:"all 0.3s" }}>
        <div style={{ fontFamily:"Syne,sans-serif",fontSize:20,fontWeight:800,letterSpacing:"-0.5px",cursor:"pointer" }} onClick={()=>nav("/")}>Car<span style={{color:"#e6821e"}}>Care</span> Connect</div>
        <div style={{ display:"flex",gap:4 }}>
          {NAV_LINKS.map(l=><button key={l} style={{ background:"none",border:"none",color:"#475569",fontSize:13,fontWeight:500,padding:"7px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>{l}</button>)}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={()=>nav("/auth")} style={{ background:"none",border:"1.5px solid #e0e0e0",borderRadius:100,color:"#0f172a",fontSize:13,fontWeight:600,padding:"7px 18px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>Sign in</button>
          <button onClick={()=>nav("/auth")} style={{ background:"#e6821e",border:"none",borderRadius:100,color:"#fff",fontSize:13,fontWeight:700,padding:"8px 20px",cursor:"pointer",fontFamily:"DM Sans,sans-serif" }}>Get started free</button>
        </div>
      </nav>

      <section style={{ paddingTop:64,minHeight:"95vh",display:"flex",alignItems:"center",background:"linear-gradient(160deg,#fff8f0 0%,#fff 55%,#f0f9ff 100%)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-100,right:-200,width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(230,130,30,0.07) 0%,transparent 70%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:1200,margin:"0 auto",padding:"4rem 2rem",width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem",alignItems:"center" }}>
          <div>
            <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #e6821e30",borderRadius:100,padding:"5px 14px",marginBottom:"1.5rem",fontSize:11,color:"#e6821e",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",boxShadow:"0 2px 12px rgba(230,130,30,0.1)" }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block" }}/>
              Kenya Automotive Marketplace
            </div>
            <h1 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(38px,5vw,64px)",fontWeight:800,lineHeight:1.04,letterSpacing:"-2.5px",marginBottom:"1.25rem" }}>
              One platform.<br/><em style={{ color:"#e6821e",fontStyle:"normal" }}>Every road.</em><br/>All of Kenya.
            </h1>
            <p style={{ fontSize:17,color:"#475569",lineHeight:1.75,marginBottom:"2rem",maxWidth:460 }}>Whether you own a car, run a garage, wrench for a living, drive for income or sell parts - Car Care Connect is your business platform.</p>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap",marginBottom:"2rem" }}>
              <button style={BP} onClick={()=>nav("/auth")}>Get started free</button>
              <button style={BO} onClick={()=>nav("/auth")}>Browse services</button>
            </div>
            <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
              {["Vehicle owners","Garages and shops","Mechanics","Drivers","Parts dealers"].map(l=>(
                <div key={l} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#888" }}>
                  <span style={{ color:"#16a34a",fontWeight:700 }}>ok</span>{l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:12,height:480 }}>
            <div className="role-img-wrap" style={{ borderRadius:20,overflow:"hidden",gridRow:"1 / 3",position:"relative",boxShadow:"0 12px 40px rgba(0,0,0,0.1)" }}>
              <img className="role-img" src="https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600&q=80" alt="Mechanic"/>
              <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 60%)",padding:"1rem" }}>
                <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Mechanics</div>
                <div style={{ fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:"#fff" }}>Get jobs. Get paid.</div>
              </div>
            </div>
            <div className="role-img-wrap" style={{ borderRadius:20,overflow:"hidden",position:"relative",boxShadow:"0 8px 24px rgba(0,0,0,0.08)" }}>
              <img className="role-img" src="https://images.unsplash.com/photo-1611448746128-7c39e03b71e4?w=400&q=80" alt="Vehicle owner"/>
              <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(230,130,30,0.85) 0%,transparent 60%)",padding:"0.75rem" }}>
                <div style={{ fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700,color:"#fff" }}>Vehicle owners</div>
              </div>
            </div>
            <div className="role-img-wrap" style={{ borderRadius:20,overflow:"hidden",position:"relative",boxShadow:"0 8px 24px rgba(0,0,0,0.08)" }}>
              <img className="role-img" src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&q=80" alt="Driver"/>
              <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(139,92,246,0.85) 0%,transparent 60%)",padding:"0.75rem" }}>
                <div style={{ fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700,color:"#fff" }}>Drivers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ background:"#e6821e",display:"grid",gridTemplateColumns:"repeat(5,1fr)" }}>
        {[{v:"5 roles",l:"All served"},{v:"24/7",l:"Emergency"},{v:"100%",l:"Verified"},{v:"KES 500",l:"GO callout"},{v:"15+ towns",l:"Across Kenya"}].map((s,i)=>(
          <div key={s.l} style={{ padding:"1.25rem 1rem",textAlign:"center",borderRight:i<4?"1px solid rgba(255,255,255,0.2)":"none" }}>
            <div style={{ fontFamily:"Syne,sans-serif",fontSize:22,fontWeight:800,color:"#fff" }}>{s.v}</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.75)",marginTop:3,textTransform:"uppercase",letterSpacing:"0.06em" }}>{s.l}</div>
          </div>
        ))}
      </div>

      <section style={{ padding:"5rem 2rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={EB}>Built for everyone</span>
            <h2 style={H2}>One platform. Every role.</h2>
            <p style={{ fontSize:15,color:"#64748b",marginTop:8 }}>Whether you own a car or own a garage - CCC is your home.</p>
          </div>
          <div style={{ display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:"2.5rem" }}>
            {ROLES.map((r,i)=>(
              <button key={r.key} className={"role-tab"+(activeRole===i?" on":"")} onClick={()=>setActiveRole(i)}>{r.icon} {r.title}</button>
            ))}
          </div>
          <div key={activeRole} className="fade-in" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3rem",alignItems:"center",background:"#fff",borderRadius:24,overflow:"hidden",border:"1.5px solid "+role.border,boxShadow:"0 8px 40px rgba(0,0,0,0.06)" }}>
            <div className="role-img-wrap" style={{ height:400,overflow:"hidden" }}>
              <img className="role-img" src={role.img} alt={role.title} style={{ width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 30%" }}/>
            </div>
            <div style={{ padding:"2.5rem 2.5rem 2.5rem 0" }}>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:role.bg,border:"1px solid "+role.border,borderRadius:100,padding:"5px 14px",marginBottom:"1.25rem" }}>
                <span style={{ fontSize:16,fontFamily:"Syne,sans-serif",fontWeight:800,color:role.color }}>{role.icon}</span>
                <span style={{ fontSize:11,fontWeight:700,color:role.color,textTransform:"uppercase",letterSpacing:"0.08em" }}>{role.title}</span>
              </div>
              <h3 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(24px,3vw,36px)",fontWeight:800,letterSpacing:"-0.5px",marginBottom:"0.75rem",lineHeight:1.1 }}>{role.tagline}</h3>
              <p style={{ fontSize:15,color:"#475569",lineHeight:1.75,marginBottom:"1.75rem" }}>{role.desc}</p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:"1.75rem" }}>
                {role.perks.map(p=>(
                  <div key={p} style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#0f172a",fontWeight:500 }}>
                    <span style={{ width:8,height:8,borderRadius:"50%",background:role.color,flexShrink:0 }}/>
                    {p}
                  </div>
                ))}
              </div>
              <button onClick={()=>nav(role.path)} style={{ ...BP,background:role.color,fontSize:14 }}>{role.cta} and get started</button>
            </div>
          </div>
          <div style={{ display:"flex",justifyContent:"center",gap:8,marginTop:"1.5rem" }}>
            {ROLES.map((r,i)=>(
              <div key={i} onClick={()=>setActiveRole(i)} style={{ width:activeRole===i?24:8,height:8,borderRadius:100,background:activeRole===i?ROLES[i].color:"#e0e0e0",transition:"all 0.3s",cursor:"pointer" }}/>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#fff" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={EB}>Services</span>
            <h2 style={H2}>Everything your car needs</h2>
            <p style={{ fontSize:15,color:"#64748b",marginTop:8 }}>Book any service from verified providers across Kenya</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12 }}>
            {SERVICES.map(s=>(
              <div key={s.name} className="svc-card" onClick={()=>nav("/auth")}>
                <div style={{ fontSize:13,fontFamily:"Syne,sans-serif",fontWeight:800,color:"#e6821e",marginBottom:10 }}>{s.icon}</div>
                <div style={{ fontWeight:700,fontSize:13,color:"#0f172a",marginBottom:4 }}>{s.name}</div>
                <div style={{ fontSize:11,color:"#94a3b8",lineHeight:1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={EB}>For businesses</span>
            <h2 style={H2}>List your business. Earn more.</h2>
            <p style={{ fontSize:15,color:"#64748b",marginTop:8 }}>No monthly fees. You pay only when you earn.</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:"2.5rem" }}>
            {PROVIDERS.map(p=>(
              <div key={p.type} className="prov-card">
                <div style={{ fontSize:13,fontFamily:"Syne,sans-serif",fontWeight:800,color:p.color,marginBottom:12 }}>{p.icon}</div>
                <div style={{ fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:4 }}>{p.type}</div>
                <div style={{ fontFamily:"Syne,sans-serif",fontSize:28,fontWeight:800,color:p.color,marginBottom:4 }}>{p.keep}</div>
                <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>you keep</div>
                <div style={{ fontSize:11,color:"#64748b" }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center" }}>
            <button style={BP} onClick={()=>nav("/auth")}>Register your business free</button>
          </div>
        </div>
      </section>

      <section style={{ position:"relative",overflow:"hidden" }}>
        <img src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1400&q=85" alt="GO Service" style={{ width:"100%",height:460,objectFit:"cover",objectPosition:"center 40%",display:"block" }}/>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.4) 55%,rgba(0,0,0,0) 100%)" }}/>
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",padding:"2rem 2rem" }}>
          <div style={{ maxWidth:520 }}>
            <span style={{ display:"inline-block",background:"#e24b4a",borderRadius:8,padding:"4px 12px",fontSize:10,fontWeight:700,color:"#fff",marginBottom:16,letterSpacing:"0.08em" }}>GO SERVICE 24/7 EMERGENCY</span>
            <h2 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:"#fff",marginBottom:16,lineHeight:1.08 }}>Broke down anywhere in Kenya? We come to you.</h2>
            <p style={{ fontSize:15,color:"rgba(255,255,255,0.8)",lineHeight:1.75,marginBottom:"1.5rem" }}>Our certified mechanics are dispatched to your exact GPS location in under 15 minutes. Highway, town centre, or home. Just KES 500 callout fee.</p>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:"1.75rem" }}>
              {["Flat tyre","Dead battery","Out of fuel","Overheating","Towing"].map(t=>(
                <span key={t} style={{ background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:100,padding:"6px 14px",fontSize:12,color:"rgba(255,255,255,0.9)" }}>{t}</span>
              ))}
            </div>
            <button style={{ background:"#e24b4a",border:"none",borderRadius:12,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700,padding:"14px 28px",cursor:"pointer" }} onClick={()=>nav("/auth")}>Request GO Service</button>
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#fff" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={EB}>Marketplace</span>
            <h2 style={H2}>Find the right provider</h2>
          </div>
          <div style={{ background:"#f8fafc",border:"2px solid #f0f0f0",borderRadius:16,padding:"10px 10px 10px 20px",display:"flex",alignItems:"center",gap:12,maxWidth:700,margin:"0 auto 2.5rem",boxShadow:"0 4px 20px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize:18,color:"#cbd5e1" }}>Srch</span>
            <input type="text" placeholder="Search mechanics, parts, garages, services..." style={{ flex:1,border:"none",outline:"none",background:"transparent",fontSize:14,color:"#0f172a",fontFamily:"DM Sans,sans-serif" }}/>
            <div style={{ width:1,height:28,background:"#e2e8f0" }}/>
            <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#64748b",padding:"0 8px",cursor:"pointer",whiteSpace:"nowrap" }}>Loc Detect location</div>
            <button style={{ ...BP,padding:"10px 20px",fontSize:13,borderRadius:10 }}>Search</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16 }}>
            {[
              {icon:"Fix",name:"Westlands Auto Garage",type:"Garage",rating:4.8,reviews:124,dist:"0.8 km",price:"KES 2,500",tags:["Oil change","Brakes","Diagnostics"],bg:"#fff8f0",bd:"#e6821e20"},
              {icon:"Pts",name:"Karen Parts and Spares",type:"Parts Dealer",rating:4.6,reviews:89,dist:"1.2 km",price:"KES 450+",tags:["Engine parts","Brake pads","Filters"],bg:"#eff6ff",bd:"#bfdbfe"},
              {icon:"Wsh",name:"Langata Premium Wash",type:"Car Wash",rating:4.9,reviews:67,dist:"1.8 km",price:"KES 800",tags:["Exterior","Interior","Detailing"],bg:"#f0fdf4",bd:"#bbf7d0"},
              {icon:"Zap",name:"Gigiri Auto Electricals",type:"Auto Electrician",rating:4.7,reviews:43,dist:"2.1 km",price:"KES 1,800",tags:["Wiring","Battery","Alternator"],bg:"#fefce8",bd:"#fde68a"},
            ].map(p=>(
              <div key={p.name} style={{ background:p.bg,border:"1.5px solid "+p.bd,borderRadius:20,padding:"1.25rem",cursor:"pointer",transition:"all 0.2s" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.08)"}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <div style={{ width:44,height:44,borderRadius:12,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"Syne,sans-serif",fontWeight:800,color:"#e6821e",border:"1px solid rgba(0,0,0,0.06)" }}>{p.icon}</div>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:"#0f172a" }}>{p.name}</div>
                      <div style={{ fontSize:11,color:"#64748b",marginTop:1 }}>{p.type}</div>
                    </div>
                  </div>
                  <span style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,color:"#16a34a",flexShrink:0 }}>Verified</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:3,fontSize:12,fontWeight:600 }}><span style={{ color:"#f59e0b" }}>star</span>{p.rating} ({p.reviews})</div>
                  <span style={{ fontSize:11,color:"#94a3b8" }}>{p.dist} away</span>
                  <span style={{ marginLeft:"auto",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,color:"#e6821e" }}>{p.price}</span>
                </div>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:12 }}>
                  {p.tags.map(t=><span key={t} style={{ background:"rgba(255,255,255,0.8)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#475569" }}>{t}</span>)}
                </div>
                <button style={{ ...BP,width:"100%",justifyContent:"center",padding:"10px",fontSize:13 }} onClick={()=>nav("/auth")}>Book now</button>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center",marginTop:"2rem" }}>
            <button style={BO} onClick={()=>nav("/auth")}>View all providers</button>
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3rem" }}>
            <span style={EB}>Reviews</span>
            <h2 style={H2}>Voices from across Kenya</h2>
            <p style={{ fontSize:14,color:"#64748b",marginTop:8 }}>From vehicle owners to mechanics - everyone loves CCC</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16 }}>
            {TESTIMONIALS.map(t=>(
              <div key={t.name} className="lp-card">
                <div style={{ display:"flex",gap:2,marginBottom:12 }}>{[1,2,3,4,5].map(i=><span key={i} style={{ color:"#f59e0b",fontSize:14 }}>star</span>)}</div>
                <p style={{ fontSize:13,color:"#475569",lineHeight:1.75,marginBottom:"1.25rem",fontStyle:"italic" }}>{t.text}</p>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:40,height:40,borderRadius:"50%",background:t.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0 }}>{t.initials}</div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13,color:"#0f172a" }}>{t.name}</div>
                    <div style={{ fontSize:11,color:"#94a3b8" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#fff" }}>
        <div style={{ maxWidth:900,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"3.5rem" }}>
            <span style={EB}>How it works</span>
            <h2 style={H2}>Up and running in minutes</h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,position:"relative" }}>
            <div style={{ position:"absolute",top:36,left:"16.66%",right:"16.66%",height:2,background:"#e6821e",zIndex:0,opacity:0.2 }}/>
            {[{n:"01",icon:"User",title:"Create your account",desc:"Sign up free in under 2 minutes. Choose your role - customer, provider, driver or dealer."},{n:"02",icon:"Gear",title:"Set up your profile",desc:"Add your services, inventory or vehicle details. Go live immediately with no approval wait."},{n:"03",icon:"Cash",title:"Start trading",desc:"Book services, receive jobs, sell parts or deliver - and get paid via M-Pesa instantly."}].map((s,i)=>(
              <div key={s.n} style={{ textAlign:"center",padding:"0 1.5rem",position:"relative",zIndex:1 }}>
                <div style={{ width:72,height:72,borderRadius:"50%",background:i===0?"#e6821e":"#fff",border:"2px solid "+(i===0?"#e6821e":"#e0e0e0"),display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1.5rem",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:800,color:i===0?"#fff":"#e6821e",boxShadow:i===0?"0 4px 20px rgba(230,130,30,0.3)":"none" }}>{s.icon}</div>
                <div style={{ fontFamily:"Syne,sans-serif",fontSize:11,fontWeight:800,color:"#e6821e",letterSpacing:"0.1em",marginBottom:8 }}>{s.n}</div>
                <div style={{ fontWeight:700,fontSize:16,color:"#0f172a",marginBottom:8 }}>{s.title}</div>
                <div style={{ fontSize:13,color:"#64748b",lineHeight:1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"4rem 2rem",background:"#fff8f0",textAlign:"center" }}>
        <div style={{ maxWidth:800,margin:"0 auto" }}>
          <span style={EB}>Coverage</span>
          <h2 style={{ ...H2,marginBottom:"0.5rem" }}>Available across Kenya</h2>
          <p style={{ fontSize:13,color:"#94a3b8",marginBottom:"1.5rem" }}>Expanding town by town. Coming soon to more cities.</p>
          <div style={{ display:"flex",gap:0,flexWrap:"wrap",justifyContent:"center" }}>
            {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru","Kitale","Malindi","Garissa","Kisii","Kakamega","Rongai"].map(t=>(
              <span key={t} className="town">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#f8fafc" }}>
        <div style={{ maxWidth:720,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:"2.5rem" }}>
            <span style={EB}>FAQ</span>
            <h2 style={H2}>Frequently asked questions</h2>
          </div>
          {FAQS.map((f,i)=>(
            <div key={i} className="faq-item" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
              <div style={{ padding:"1rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                <span style={{ fontSize:14,fontWeight:600,color:"#0f172a" }}>{f.q}</span>
                <span style={{ color:"#e6821e",fontSize:20,flexShrink:0,transform:openFaq===i?"rotate(45deg)":"rotate(0)",transition:"transform 0.2s" }}>+</span>
              </div>
              {openFaq===i&&<div style={{ padding:"0 1.25rem 1rem",fontSize:13,color:"#64748b",lineHeight:1.75 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#0f172a" }}>
        <div style={{ maxWidth:600,margin:"0 auto",textAlign:"center" }}>
          <h2 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(28px,5vw,44px)",fontWeight:800,color:"#fff",marginBottom:"1rem",lineHeight:1.1 }}>
            Get the CCC app.<br/><span style={{ color:"#e6821e" }}>Kenya marketplace in your pocket.</span>
          </h2>
          <p style={{ fontSize:14,color:"#64748b",marginBottom:"2rem",lineHeight:1.75 }}>Free to download. Available 24/7. For every role. No subscription required.</p>
          <div style={{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap" }}>
            <a href="https://play.google.com/store/apps/details?id=care.carcareconnect.app" target="_blank" rel="noopener noreferrer"
              style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,textDecoration:"none" }}>
              <span style={{ fontSize:22 }}>Play</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:9,color:"#888" }}>Get it on</div>
                <div style={{ fontSize:13,color:"#fff",fontWeight:700 }}>Google Play</div>
              </div>
            </a>
            <a href="https://wa.me/254113858966" target="_blank" rel="noopener noreferrer"
              style={{ background:"#25d366",borderRadius:14,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,textDecoration:"none" }}>
              <span style={{ fontSize:22 }}>WA</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:9,color:"rgba(255,255,255,0.75)" }}>Chat us on</div>
                <div style={{ fontSize:13,color:"#fff",fontWeight:700 }}>WhatsApp</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section style={{ padding:"5rem 2rem",background:"#e6821e",textAlign:"center",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-60,right:-100,width:400,height:400,borderRadius:"50%",background:"rgba(255,255,255,0.05)",pointerEvents:"none" }}/>
        <div style={{ position:"relative",zIndex:1,maxWidth:600,margin:"0 auto" }}>
          <h2 style={{ fontFamily:"Syne,sans-serif",fontSize:"clamp(28px,5vw,48px)",fontWeight:800,color:"#fff",marginBottom:"1rem",lineHeight:1.08 }}>Join Kenya automotive revolution.</h2>
          <p style={{ fontSize:15,color:"rgba(255,255,255,0.85)",marginBottom:"2rem",lineHeight:1.75 }}>Whether you own a car, run a garage, wrench for a living, drive for income or sell parts - there is a place for you here.</p>
          <div style={{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap" }}>
            <button onClick={()=>nav("/auth")} style={{ background:"#fff",border:"none",borderRadius:12,color:"#e6821e",fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700,padding:"14px 28px",cursor:"pointer" }}>Get started free</button>
            <button onClick={()=>window.open("https://wa.me/254113858966","_blank")} style={{ background:"rgba(255,255,255,0.12)",border:"1.5px solid rgba(255,255,255,0.3)",borderRadius:12,color:"#fff",fontSize:14,fontWeight:600,padding:"13px 24px",cursor:"pointer" }}>WhatsApp us</button>
          </div>
        </div>
      </section>

      <footer style={{ background:"#0a0a0a",padding:"4rem 2rem 2rem" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:"3rem",marginBottom:"3rem",paddingBottom:"3rem",borderBottom:"1px solid #1a1a1a" }}>
            <div>
              <div style={{ fontFamily:"Syne,sans-serif",fontSize:20,fontWeight:800,color:"#fff",marginBottom:10 }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
              <p style={{ fontSize:12,color:"#475569",lineHeight:1.75,maxWidth:220,marginBottom:"1.5rem" }}>Kenya most trusted automotive marketplace. Built for Kenyan roads. Scaling across Africa.</p>
              <div style={{ display:"flex",gap:8 }}>
                {["WA","IG","TW","YT"].map((ic,idx)=>(
                  <div key={idx} style={{ width:32,height:32,background:"#1a1a1a",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"Syne,sans-serif",fontWeight:700,color:"#e6821e",cursor:"pointer" }}>{ic}</div>
                ))}
              </div>
            </div>
            {[
              {t:"Services",l:["Mechanic booking","GO Emergency","Parts marketplace","Concierge","Car Wash"]},
              {t:"For Business",l:["Register garage","List parts shop","Become a driver","Mechanic login","Provider dashboard"]},
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

      <a href="https://wa.me/254113858966" target="_blank" rel="noopener noreferrer" className="wa-float">WA</a>
    </div>
  )
}
