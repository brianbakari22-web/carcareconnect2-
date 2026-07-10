import { useState, useEffect } from "react"

const ROLES = [
  { key:"customer", emoji:"car", title:"Vehicle Owners", tagline:"Book, track, relax.", desc:"Find verified mechanics, order parts, get emergency help from your phone.", color:"#e6821e", bg:"#fff8f0", border:"#e6821e20", img:"https://images.unsplash.com/photo-1611448746128-7c39e03b71e4?w=600&q=80", actions:["Book a mechanic","GO Emergency","Order parts","Track my car"], path:"/auth" },
  { key:"provider", emoji:"wrench", title:"Garages and Shops", tagline:"List. Earn. Grow.", desc:"Reach more customers, manage bookings, receive payments and grow your business.", color:"#378add", bg:"#eff6ff", border:"#378add20", img:"https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600&q=80", actions:["Manage bookings","View earnings","Handle GO requests","Manage mechanics"], path:"/auth" },
  { key:"mechanic", emoji:"gear", title:"Mechanics", tagline:"Get jobs. Get paid.", desc:"Receive job assignments from your garage, track earnings and build your reputation.", color:"#1d9e75", bg:"#f0fdf4", border:"#1d9e7520", img:"https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600&q=80", actions:["View assigned jobs","Track earnings","Request parts","My photos"], path:"/mechanic-login" },
  { key:"driver", emoji:"truck", title:"Drivers", tagline:"Drive. Deliver. Earn.", desc:"Accept delivery jobs, earn per trip, track your performance and grow your income.", color:"#8b5cf6", bg:"#faf5ff", border:"#8b5cf620", img:"https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&q=80", actions:["Available jobs","Active delivery","My earnings","Performance"], path:"/auth" },
  { key:"dealer", emoji:"box", title:"Parts Dealers", tagline:"List parts. Sell more.", desc:"Sell genuine and aftermarket parts online. Manage inventory and fulfill orders across Kenya.", color:"#f59e0b", bg:"#fefce8", border:"#f59e0b20", img:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80", actions:["My inventory","Incoming orders","Sales analytics","Add new parts"], path:"/auth" },
]

const SERVICES = [
  { emoji:"fix", name:"Mechanic" },
  { emoji:"sos", name:"Emergency" },
  { emoji:"box", name:"Parts" },
  { emoji:"car", name:"Concierge" },
  { emoji:"wash", name:"Car Wash" },
  { emoji:"diag", name:"Diagnostics" },
  { emoji:"tyre", name:"Tyres" },
  { emoji:"elec", name:"Electrical" },
]

export default function AppHomePage() {
  const [activeRole, setActiveRole] = useState(0)
  const nav = (path) => window.location.href = path

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRole(prev => (prev + 1) % ROLES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const role = ROLES[activeRole]

  const roleEmojis = { customer:"Car", provider:"Fix", mechanic:"Mech", driver:"Drv", dealer:"Pts" }
  const svcEmojis = { fix:"Fix", sos:"SOS", box:"Box", car:"Car", wash:"Wsh", diag:"Dig", tyre:"Tyr", elec:"Zap" }

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"#f8f8f8", minHeight:"100vh", overflowX:"hidden" }}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap");
        *{box-sizing:border-box;margin:0;padding:0;}
        .role-tab{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 10px;border-radius:12px;border:1.5px solid transparent;cursor:pointer;transition:all 0.2s;background:#fff;}
        .svc-btn{background:#fff;border:1px solid #f0f0f0;border-radius:12px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:all 0.18s;}
        .svc-btn:active{transform:scale(0.96);}
        .wa-float{position:fixed;bottom:24px;right:18px;background:#25d366;border-radius:50%;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 16px rgba(37,211,102,0.45);text-decoration:none;z-index:999;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.35s ease forwards;}
      `}</style>

      <div style={{ background:"#fff", padding:"3rem 1.25rem 1rem", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:800, letterSpacing:"-0.5px" }}>Car<span style={{color:"#e6821e"}}>Care</span> Connect</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>KE Kenya automotive marketplace</div>
          </div>
          <button onClick={()=>nav("/auth")} style={{ background:"#e6821e", border:"none", borderRadius:100, color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, padding:"8px 18px", cursor:"pointer" }}>Get started</button>
        </div>
        <div onClick={()=>nav("/auth")} style={{ marginTop:"0.875rem", background:"#f5f5f5", border:"1.5px solid #eee", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
          <span style={{ fontSize:15, color:"#aaa" }}>Search</span>
          <span style={{ fontSize:13, color:"#bbb" }}>Mechanics, parts, services...</span>
        </div>
      </div>

      <div style={{ padding:"1.25rem" }}>

        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#aaa", marginBottom:"0.75rem" }}>One platform. Everyone welcome.</div>

          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:"1rem" }}>
            {ROLES.map((r,i)=>(
              <div key={r.key} className="role-tab"
                style={{ borderColor:activeRole===i?r.color:"transparent", background:activeRole===i?r.bg:"#fff" }}
                onClick={()=>setActiveRole(i)}>
                <span style={{ fontSize:11, fontFamily:"Syne,sans-serif", fontWeight:800, color:r.color }}>{roleEmojis[r.key]}</span>
                <span style={{ fontSize:10, fontWeight:600, color:activeRole===i?r.color:"#888", whiteSpace:"nowrap" }}>{r.title.split(" ")[0]}</span>
              </div>
            ))}
          </div>

          <div key={activeRole} className="fade-in" style={{ background:"#fff", borderRadius:20, overflow:"hidden", border:"1.5px solid "+role.border, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ position:"relative" }}>
              <img src={role.img} alt={role.title} style={{ width:"100%", height:200, objectFit:"cover", objectPosition:"center 30%", display:"block" }}/>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,"+role.color+"ee 0%,transparent 50%)" }}/>
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"1.25rem" }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:100, padding:"3px 10px", marginBottom:6 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.06em" }}>{role.title}</span>
                </div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:22, fontWeight:800, color:"#fff", lineHeight:1.1, marginBottom:4 }}>{role.tagline}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.6 }}>{role.desc}</div>
              </div>
            </div>
            <div style={{ padding:"1rem 1.25rem" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"0.75rem" }}>What you can do</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:"1rem" }}>
                {role.actions.map(a=>(
                  <div key={a} style={{ background:role.bg, border:"1px solid "+role.border, borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:600, color:role.color, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:role.color, flexShrink:0 }}/>
                    {a}
                  </div>
                ))}
              </div>
              <button onClick={()=>nav(role.path)} style={{ width:"100%", background:role.color, border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
                Join as {role.title.split(" ")[0]} and get started
              </button>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:"0.75rem" }}>
            {ROLES.map((_,i)=>(
              <div key={i} onClick={()=>setActiveRole(i)} style={{ width:activeRole===i?20:6, height:6, borderRadius:100, background:activeRole===i?ROLES[i].color:"#ddd", transition:"all 0.3s", cursor:"pointer" }}/>
            ))}
          </div>
        </div>

        <div onClick={()=>nav("/auth")} style={{ borderRadius:18, overflow:"hidden", marginBottom:"1.25rem", cursor:"pointer", boxShadow:"0 4px 20px rgba(226,75,74,0.2)" }}>
          <div style={{ position:"relative", height:160 }}>
            <img src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80" alt="GO Emergency Service" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 35%", display:"block" }}/>
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,rgba(226,75,74,0.92) 0%,rgba(226,75,74,0.6) 50%,rgba(0,0,0,0.2) 100%)" }}/>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", padding:"1rem 1.25rem", gap:14 }}>
              <div style={{ width:56, height:56, borderRadius:14, background:"rgba(255,255,255,0.15)", border:"2px solid rgba(255,255,255,0.35)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, color:"#fff", lineHeight:1 }}>GO!</span>
                <span style={{ fontSize:8, color:"rgba(255,255,255,0.8)", fontWeight:600, marginTop:2 }}>24/7</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>GO SERVICE EMERGENCY</div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:17, fontWeight:800, color:"#fff", lineHeight:1.15, marginBottom:4 }}>Broke down? We come to you.</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>KES 500 callout. Mechanic in under 15 min.</div>
              </div>
              <div style={{ background:"#fff", borderRadius:10, padding:"8px 12px", flexShrink:0 }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:800, color:"#e24b4a", lineHeight:1.2 }}>Request</div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:800, color:"#e24b4a", lineHeight:1.2 }}>now</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, color:"#000", marginBottom:"0.875rem" }}>Our services</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            {SERVICES.map(s=>(
              <div key={s.name} className="svc-btn" onClick={()=>nav("/auth")}>
                <span style={{ fontSize:11, fontFamily:"Syne,sans-serif", fontWeight:800, color:"#e6821e" }}>{svcEmojis[s.emoji]}</span>
                <span style={{ fontSize:10, fontWeight:600, color:"#555", textAlign:"center" }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, color:"#000", marginBottom:"0.875rem" }}>Built for everyone</div>
          <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
            {ROLES.map((r,i)=>(
              <div key={r.key} onClick={()=>{ setActiveRole(i); window.scrollTo({top:0,behavior:"smooth"}) }}
                style={{ background:"#fff", border:"1.5px solid "+r.border, borderRadius:16, padding:"1rem", minWidth:140, cursor:"pointer", flexShrink:0 }}>
                <div style={{ position:"relative", borderRadius:12, overflow:"hidden", height:80, marginBottom:10 }}>
                  <img src={r.img} alt={r.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  <div style={{ position:"absolute", inset:0, background:r.color+"88" }}/>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:800, color:"#fff" }}>{roleEmojis[r.key]}</div>
                </div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#000", marginBottom:2 }}>{r.title}</div>
                <div style={{ fontSize:10, color:r.color, fontWeight:600 }}>{r.tagline}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:18, padding:"1.25rem", marginBottom:"1.5rem", display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, border:"1px solid #f0f0f0" }}>
          {[{e:"ok",title:"Verified providers",desc:"Every business manually vetted"},{e:"lk",title:"Secure payments",desc:"M-Pesa and card via Pesapal"},{e:"pt",title:"Live tracking",desc:"GPS track every job"},{e:"sh",title:"Service guarantee",desc:"Full refund if unsatisfied"}].map(t=>(
            <div key={t.title} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
              <span style={{ fontSize:11, fontFamily:"Syne,sans-serif", fontWeight:800, color:"#e6821e", flexShrink:0 }}>{t.e.toUpperCase()}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#000" }}>{t.title}</div>
                <div style={{ fontSize:10, color:"#888", marginTop:1 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:"#fff8f0", borderRadius:18, padding:"1.25rem", marginBottom:"1.5rem", border:"1px solid #e6821e20" }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:"0.75rem" }}>KE Available across Kenya</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru","Kitale","Malindi","Garissa"].map(t=>(
              <span key={t} style={{ background:"#fff", border:"1px solid #e6821e20", borderRadius:100, padding:"4px 10px", fontSize:11, color:"#555" }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ background:"#e6821e", borderRadius:20, padding:"1.5rem", marginBottom:"1.5rem", textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.08)" }}/>
          <div style={{ position:"relative", zIndex:1 }}>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:18, fontWeight:800, color:"#fff", marginBottom:6, lineHeight:1.2 }}>Join Kenya automotive marketplace.</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginBottom:"1.25rem", lineHeight:1.6 }}>Free to join. No subscriptions. Available 24/7 across Kenya.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>nav("/auth")} style={{ flex:1, background:"#fff", border:"none", borderRadius:12, color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>Get started free</button>
              <button onClick={()=>window.open("https://wa.me/254113858966","_blank")} style={{ background:"#25d366", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, padding:"12px 16px", cursor:"pointer" }}>Chat</button>
            </div>
          </div>
        </div>

        <div style={{ textAlign:"center", fontSize:11, color:"#ccc", paddingBottom:"1rem" }}>2026 Car Care Connect Kenya Payments by Pesapal</div>
      </div>

      <a href="https://wa.me/254113858966" target="_blank" rel="noopener noreferrer" className="wa-float">WA</a>
    </div>
  )
}
