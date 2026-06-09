import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

function FloatingParts() {
  const items = [
    { id:0, icon:"🛞", left:5, top:15, size:52, duration:7, delay:0, opacity:0.35 },
    { id:1, icon:"⚙️", left:88, top:10, size:48, duration:9, delay:1, opacity:0.30 },
    { id:2, icon:"🔧", left:15, top:75, size:40, duration:6, delay:2, opacity:0.28 },
    { id:3, icon:"🚗", left:78, top:65, size:56, duration:8, delay:0.5, opacity:0.25 },
    { id:4, icon:"🔋", left:45, top:5, size:38, duration:7, delay:1.5, opacity:0.30 },
    { id:5, icon:"🛢️", left:92, top:45, size:44, duration:10, delay:3, opacity:0.28 },
    { id:6, icon:"🔩", left:25, top:45, size:34, duration:5, delay:0, opacity:0.32 },
    { id:7, icon:"⚡", left:60, top:80, size:42, duration:8, delay:2, opacity:0.30 },
    { id:8, icon:"🪛", left:70, top:25, size:36, duration:6, delay:1, opacity:0.28 },
    { id:9, icon:"🔑", left:35, top:90, size:34, duration:9, delay:4, opacity:0.25 },
    { id:10, icon:"🛠️", left:50, top:55, size:38, duration:7, delay:2.5, opacity:0.22 },
    { id:11, icon:"🏎️", left:10, top:55, size:46, duration:11, delay:0.5, opacity:0.28 },
  ]
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
      {items.map(item => (
        <div key={item.id} style={{ position:"absolute", left:item.left+"%", top:item.top+"%", fontSize:item.size, opacity:item.opacity, animation:`float-${item.id%3} ${item.duration}s ease-in-out infinite`, animationDelay:item.delay+"s", filter:"drop-shadow(0 4px 12px rgba(230,130,30,0.4))" }}>
          {item.icon}
        </div>
      ))}
    </div>
  )
}



export default function LandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)
  const btnOrange = { background:"#e6821e", border:"none", borderRadius:500, color:"#fff", fontSize:14, fontWeight:700, padding:"13px 26px", cursor:"pointer", fontFamily:"DM Sans,sans-serif" }
  const btnOutline = { background:"none", border:"1.5px solid #000", borderRadius:500, color:"#000", fontSize:14, fontWeight:600, padding:"12px 24px", cursor:"pointer", fontFamily:"DM Sans,sans-serif" }
  const btnOutlineOrange = { background:"none", border:"1.5px solid #e6821e", borderRadius:500, color:"#e6821e", fontSize:14, fontWeight:600, padding:"12px 24px", cursor:"pointer", fontFamily:"DM Sans,sans-serif" }
  const card = { background:"rgba(245,245,245,0.85)", borderRadius:16, padding:"1.25rem" }
  const cardWhite = { background:"rgba(255,255,255,0.85)", borderRadius:16, padding:"1.25rem" }
  const sLabel = { fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color:"#e6821e", marginBottom:10, display:"block" }
  const h2 = { fontSize:"clamp(24px,4vw,42px)", fontWeight:800, lineHeight:1.1, letterSpacing:-0.5, color:"#000", marginBottom:12 }
  const h2w = { fontSize:"clamp(24px,4vw,42px)", fontWeight:800, lineHeight:1.1, letterSpacing:-0.5, color:"#fff", marginBottom:12 }
  const body = { fontSize:15, color:"#555", lineHeight:1.7 }
  const sec = (bg) => ({ background:bg, padding:"3rem 1.25rem", position:"relative", overflow:"hidden", zIndex:1 })

  const providerTypes = [
    { icon:"🔧", type:"Garage/Mechanic", keep:"90%" },
    { icon:"⚙️", type:"Parts Dealer", keep:"95%" },
    { icon:"✨", type:"Accessories Shop", keep:"92%" },
    { icon:"🛞", type:"Tyre Shop", keep:"94%" },
    { icon:"⚡", type:"Auto Electrician", keep:"88%" },
    { icon:"🚿", type:"Car Wash", keep:"90%" },
    { icon:"🔨", type:"Panel Beater", keep:"85%" },
    { icon:"🪟", type:"Auto Glass", keep:"88%" },
  ]
  const features = [
    { icon:"🔧", title:"Service booking", desc:"Oil change, brakes, AC, full diagnostics from verified Nairobi providers" },
    { icon:"🚨", title:"GO Service", desc:"24/7 emergency roadside. Mechanic dispatched to your GPS location fast" },
    { icon:"🚗", title:"Concierge delivery", desc:"We collect your car, service it, and return it to your door" },
    { icon:"🛒", title:"Parts marketplace", desc:"Buy genuine and aftermarket parts from verified Nairobi shops" },
    { icon:"🎁", title:"Loyalty rewards", desc:"Earn points every booking. Redeem for discounts on future services" },
    { icon:"📍", title:"Live tracking", desc:"Track your driver or mechanic on a live map in real time" },
    { icon:"🛡️", title:"Service guarantee", desc:"Not happy? We investigate and issue a full service voucher refund" },
    { icon:"🤖", title:"24/7 assistant", desc:"Always-on help for car problems, bookings, and platform guidance" },
  ]
  const faqs = [
    { q:"How do I book a service?", a:"Search for a provider near you, select a service, pick a time and confirm. You will receive a notification once the provider confirms." },
    { q:"How does parts delivery work?", a:"Browse the parts marketplace, add items to cart, choose pickup or delivery, and pay securely via M-Pesa. CCC riders deliver within Nairobi." },
    { q:"How do I become a provider?", a:"Sign up as a provider, choose your business type, add your services or inventory, and start receiving customers immediately." },
    { q:"Is payment secure?", a:"Yes. All payments are processed through Pesapal, supporting M-Pesa, Visa and Mastercard, regulated by the Central Bank of Kenya." },
    { q:"What is GO Service?", a:"GO Service is 24/7 emergency roadside assistance. A mechanic comes to your exact GPS location when your car breaks down. Just KES 500 callout fee." },
    { q:"Can I track my mechanic?", a:"Yes. Once your booking is confirmed, you can track your mechanic live on the map inside the app." },
  ]

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"transparent", color:"#000", minHeight:"100vh", position:"relative" }}>
      {/* White base */}
      <div style={{ position:"fixed", inset:0, zIndex:-1, background:"#fff" }}/>


      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        .hcard{transition:all 0.2s;}
        .hcard:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(230,130,30,0.15);}
        .faq-row{border-bottom:1px solid rgba(229,229,229,0.8);padding:1.1rem 0;cursor:pointer;}
        .faq-row:first-child{border-top:1px solid rgba(229,229,229,0.8);}
        @keyframes glow{0%,100%{opacity:1}50%{opacity:0.85}}
        @keyframes ping{0%{transform:scale(1);opacity:1}100%{transform:scale(2.2);opacity:0}}
        @keyframes float-0{0%,100%{transform:translateY(0px) rotate(0deg) scale(1)}25%{transform:translateY(-35px) rotate(15deg) scale(1.1)}50%{transform:translateY(-55px) rotate(5deg) scale(1.05)}75%{transform:translateY(-30px) rotate(-10deg) scale(1.08)}}
        @keyframes float-1{0%,100%{transform:translateY(0px) rotate(0deg) scale(1)}33%{transform:translateY(-45px) rotate(-12deg) scale(1.12)}66%{transform:translateY(-25px) rotate(8deg) scale(1.06)}}
        @keyframes float-2{0%,100%{transform:translateY(0px) rotate(0deg) scale(1)}40%{transform:translateY(-40px) rotate(20deg) scale(1.15)}80%{transform:translateY(-15px) rotate(-5deg) scale(1.05)}}
      `}</style>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"rgba(0,0,0,0.95)", padding:"0 1.25rem", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", backdropFilter:"blur(10px)" }}>
        <div style={{ fontSize:20, fontWeight:700, color:"#fff", letterSpacing:-0.5 }}>Car<span style={{ color:"#e6821e" }}>Care</span></div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"1px solid #444", borderRadius:500, color:"#fff", fontSize:13, fontWeight:500, padding:"7px 16px", cursor:"pointer" }}>Sign in</button>
          <button onClick={()=>navigate("/auth")} style={{ background:"#e6821e", border:"none", borderRadius:500, color:"#fff", fontSize:13, fontWeight:700, padding:"8px 18px", cursor:"pointer" }}>Get started</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ paddingTop:56, position:"relative", overflow:"hidden", minHeight:"92vh", display:"flex", flexDirection:"column", justifyContent:"center", zIndex:1 }}>
        <FloatingParts/>
        <div style={{ padding:"3rem 1.25rem 2.5rem", maxWidth:620, margin:"0 auto", textAlign:"center", position:"relative", zIndex:2 }}>
          <img src="/logo.svg" alt="Car Care Connect" style={{ height:90, marginBottom:"1.5rem", animation:"glow 3s ease-in-out infinite" }}/>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(240,253,244,0.9)", border:"1px solid #bbf7d0", borderRadius:20, padding:"5px 14px", marginBottom:"1.5rem" }}>
            <div style={{ position:"relative", width:7, height:7 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a", position:"absolute" }}/>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#16a34a", animation:"ping 1.5s ease-out infinite" }}/>
            </div>
            <span style={{ fontSize:12, color:"#16a34a", fontWeight:600 }}>🇰🇪 Built in Kenya ┬╖ Serving Nairobi</span>
          </div>
          <h1 style={{ fontSize:"clamp(36px,7vw,72px)", fontWeight:800, lineHeight:1.08, letterSpacing:-1.5, color:"#000", marginBottom:"1.25rem" }}>
            One app.<br/>
            <span style={{ color:"#e6821e" }}>Every car need.</span><br/>
            Nairobi.
          </h1>
          <p style={{ ...body, marginBottom:"2rem" }}>
            Nairobi's most trusted automotive platform. Verified mechanics, 24/7 emergency roadside help, live tracking, parts marketplace — everything your car needs, one tap away.
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:"2rem" }}>
            <button onClick={()=>navigate("/auth")} style={btnOrange}>🚗 Get started free</button>
            <button onClick={()=>navigate("/auth")} style={btnOutline}>Sign in →</button>
          </div>
          <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
            {[["24/7","Emergency service"],["5min","Avg response"],["100%","Verified providers"],["🇰🇪","Made in Kenya"]].map(([v,l])=>(
              <div key={l} style={{ textAlign:"center", padding:"0.5rem 0.9rem", background:"rgba(245,245,245,0.9)", borderRadius:10 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#000" }}>{v}</div>
                <div style={{ fontSize:10, color:"#888", marginTop:1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"rgba(0,0,0,0.9)", padding:"1.25rem", textAlign:"center", position:"relative", zIndex:2 }}>
          <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap" }}>
            {[["🚗","Service booking"],["🚨","24/7 emergency"],["📍","Live tracking"],["🛒","Marketplace"],["🎁","Loyalty rewards"]].map(([icon,label])=>(
              <div key={label} style={{ fontSize:13, color:"#aaa", display:"flex", alignItems:"center", gap:6 }}><span>{icon}</span><span>{label}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* GO SERVICE */}
      <div style={sec("rgba(17,17,17,0.88)")}>
        <FloatingParts/>
        <div style={{ maxWidth:580, margin:"0 auto", textAlign:"center", position:"relative", zIndex:2 }}>
          <span style={sLabel}>GO Service</span>
          <h2 style={h2w}>Broke down? We come to you.</h2>
          <p style={{ ...body, color:"#aaa", marginBottom:"1.5rem" }}>Kenya's only 24/7 emergency roadside service. Our certified mechanics come to your exact GPS location — highway, parking lot, or home. Just KES 500 callout fee.</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:"1.5rem" }}>
            {["🛞 Flat tyre","🔋 Dead battery","⛽ Out of fuel","🌡️ Overheating","🚚 Towing"].map(item=>(
              <span key={item} style={{ background:"rgba(34,34,34,0.9)", border:"1px solid #333", borderRadius:20, padding:"6px 14px", fontSize:13, color:"#ddd" }}>{item}</span>
            ))}
          </div>
          <button onClick={()=>navigate("/auth")} style={{ ...btnOrange, background:"#e24b4a", fontSize:15, padding:"14px 32px" }}>🚨 Request emergency help</button>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={sec("rgba(255,255,255,0.82)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>How it works</span>
            <h2 style={h2}>Car care has never been this easy</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
            {[
              { n:"01", icon:"≡ƒöì", title:"Find a service", desc:"Browse verified providers near you. Compare prices, read reviews, and pick the best mechanic for your car and budget." },
              { n:"02", icon:"📱", title:"Book and pay", desc:"Book in seconds. Pay securely via M-Pesa or card through Pesapal, regulated by Central Bank of Kenya." },
              { n:"03", icon:"✅", title:"Track and review", desc:"Track your mechanic live on the map. Rate your experience and earn loyalty points on every booking." },
            ].map(s=>(
              <div key={s.n} className="hcard" style={{ ...cardWhite, position:"relative", overflow:"hidden" }}>
                <div style={{ fontWeight:800, fontSize:52, color:"#e6821e10", position:"absolute", top:-8, right:10, lineHeight:1 }}>{s.n}</div>
                <div style={{ fontSize:36, marginBottom:12 }}>{s.icon}</div>
                <div style={{ fontWeight:700, fontSize:15, color:"#000", marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:13, color:"#666", lineHeight:1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div style={sec("rgba(245,245,245,0.84)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>Features</span>
            <h2 style={h2}>Everything your car needs, in one place</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10 }}>
            {features.map(f=>(
              <div key={f.title} className="hcard" style={cardWhite}>
                <div style={{ fontSize:28, marginBottom:10 }}>{f.icon}</div>
                <div style={{ fontWeight:700, fontSize:13, color:"#000", marginBottom:4 }}>{f.title}</div>
                <div style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRUST */}
      <div style={sec("rgba(255,255,255,0.82)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>Why CCC</span>
            <h2 style={h2}>Built for Kenya. Built for trust.</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
            {[
              { icon:"🛡️", title:"Service Guarantee", desc:"Not happy with the service? We investigate and issue a full refund voucher. No questions asked." },
              { icon:"✅", title:"Verified providers only", desc:"Every mechanic, parts dealer and service provider is manually verified before listing on CCC." },
              { icon:"📍", title:"Real-time tracking", desc:"Know exactly where your mechanic or driver is at all times. Live GPS tracking on every job." },
              { icon:"🔐", title:"Secure payments", desc:"All payments processed through Pesapal, regulated by the Central Bank of Kenya." },
              { icon:"🤖", title:"24/7 support", desc:"Always-on support to help diagnose car problems, guide bookings, and answer any question." },
              { icon:"🇰🇪", title:"Made in Kenya", desc:"Built by Kenyans for Kenyan roads. We understand Nairobi traffic, local mechanics, and Kenyan cars." },
            ].map(t=>(
              <div key={t.title} className="hcard" style={card}>
                <div style={{ fontSize:28, marginBottom:10 }}>{t.icon}</div>
                <div style={{ fontWeight:700, fontSize:14, color:"#000", marginBottom:4 }}>{t.title}</div>
                <div style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHO IS IT FOR */}
      <div style={sec("rgba(17,17,17,0.88)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>Who is it for</span>
            <h2 style={h2w}>Built for everyone in the ecosystem</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
            {[
              { icon:"🚗", role:"Customer", color:"#e6821e", desc:"Book services, get emergency help, track your car, earn rewards", features:["Book car services","Emergency GO Service","Live mechanic tracking","Parts marketplace"] },
              { icon:"🔧", role:"Service Provider", color:"#378add", desc:"List services, manage bookings, earn commissions, dispatch mechanics", features:["Manage bookings","GO Service requests","Parts inventory","Earnings dashboard"] },
              { icon:"🚗", role:"Concierge Driver", color:"#1d9e75", desc:"Pick up and deliver customer vehicles and parts, earn per delivery", features:["Accept deliveries","Parts delivery jobs","Live navigation","KES 200 allowance per trip"] },
            ].map(r=>(
              <div key={r.role} style={{ background:"rgba(26,26,26,0.92)", border:"1px solid "+r.color+"40", borderRadius:16, padding:"1.5rem" }}>
                <div style={{ fontSize:36, marginBottom:10 }}>{r.icon}</div>
                <div style={{ fontWeight:800, fontSize:16, color:r.color, marginBottom:6 }}>{r.role}</div>
                <div style={{ fontSize:12, color:"#aaa", marginBottom:12, lineHeight:1.6 }}>{r.desc}</div>
                {r.features.map(f=>(
                  <div key={f} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:r.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:"#888" }}>{f}</span>
                  </div>
                ))}
                <button onClick={()=>navigate("/auth")} style={{ marginTop:14, width:"100%", background:r.color+"22", border:"1px solid "+r.color+"50", borderRadius:9, color:r.color, fontSize:13, fontWeight:700, padding:"10px", cursor:"pointer" }}>
                  Join as {r.role} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PROVIDER TYPES */}
      <div style={sec("rgba(255,255,255,0.82)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>For businesses</span>
            <h2 style={h2}>All automotive businesses welcome</h2>
            <p style={{ ...body, maxWidth:480, margin:"0 auto" }}>Not just mechanics — list any automotive business and reach thousands of customers in Nairobi</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:"1.5rem" }}>
            {providerTypes.map(p=>(
              <div key={p.type} className="hcard" style={card}>
                <div style={{ fontSize:28, marginBottom:6, textAlign:"center" }}>{p.icon}</div>
                <div style={{ fontWeight:700, fontSize:12, color:"#000", marginBottom:2, textAlign:"center" }}>{p.type}</div>
                <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, textAlign:"center" }}>Keep {p.keep}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center" }}>
            <button onClick={()=>navigate("/auth")} style={btnOutlineOrange}>Register your business →</button>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div style={sec("rgba(245,245,245,0.84)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>Pricing</span>
            <h2 style={h2}>Earn more. Keep more.</h2>
            <p style={body}>No monthly fees. No hidden charges. We only make money when you make money.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
            {[
              { type:"Shop Standard", provider:"90%", platform:"10%", desc:"Customer brings car to your shop", color:"#000" },
              { type:"Shop Premium", provider:"80%", platform:"20%", desc:"Your mechanic travels to customer", color:"#378add" },
              { type:"GO Service", provider:"85%", platform:"15%", desc:"Emergency roadside assistance", color:"#e24b4a" },
              { type:"Marketplace", provider:"92-98%", platform:"2-8%", desc:"Buy and sell vehicles and parts", color:"#1d9e75" },
            ].map(p=>(
              <div key={p.type} style={{ ...cardWhite, border:"1px solid "+p.color+"30", textAlign:"center" }}>
                <div style={{ fontWeight:700, fontSize:13, color:p.color, marginBottom:10 }}>{p.type}</div>
                <div style={{ fontWeight:800, fontSize:32, color:"#000", marginBottom:2 }}>{p.provider}</div>
                <div style={{ fontSize:11, color:"#888", marginBottom:8 }}>Your earnings</div>
                <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Platform: {p.platform}</div>
                <div style={{ fontSize:11, color:"#888", lineHeight:1.5 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NAIROBI PRICES */}
      <div style={sec("rgba(0,0,0,0.88)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>Nairobi market prices</span>
            <h2 style={h2w}>What services cost in Nairobi 2026</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:8 }}>
            {[["Oil change (minor service)","KES 4,000 - 7,000"],["Brake pads replacement","KES 7,000 - 15,000"],["Minor service","KES 12,000 - 15,000"],["Major service","KES 30,000 - 35,000"],["Battery replacement","KES 5,000 - 12,000"],["Wheel alignment","KES 2,500 - 5,000"],["AC service","KES 5,000 - 12,000"],["Suspension repair","KES 15,000 - 25,000"],["Full diagnostic","KES 3,000 - 8,000"],["Tyre replacement (each)","KES 8,000 - 30,000"],["GO callout fee","KES 500 flat"],["Transmission repair","KES 20,000 - 50,000"]].map(([service,price])=>(
              <div key={service} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"rgba(26,26,26,0.9)", borderRadius:8, gap:8 }}>
                <span style={{ fontSize:12, color:"#aaa" }}>{service}</span>
                <span style={{ fontSize:12, color:"#e6821e", fontWeight:700, flexShrink:0 }}>{price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PARTS MARKETPLACE */}
      <div style={sec("rgba(255,255,255,0.82)")}>
        <FloatingParts/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative", zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>Parts marketplace</span>
            <h2 style={h2}>Order parts online. Delivered to your door.</h2>
            <p style={{ ...body, maxWidth:480, margin:"0 auto" }}>Browse genuine and aftermarket parts from verified Nairobi shops. Order online, pay securely via M-Pesa, get it delivered by CCC riders.</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:"1.5rem" }}>
            {[["⚙️","Engine and mechanical parts"],["✨","Car accessories"],["🛞","Tyres all brands"],["🔋","Batteries and electrical"],["🛢️","Engine oils and fluids"]].map(([icon,item])=>(
              <div key={item} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(245,245,245,0.9)", borderRadius:10, fontSize:14, color:"#000", fontWeight:500 }}>
                <span style={{ fontSize:20 }}>{icon}</span>{item}
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:"1.5rem" }}>
            {[["🏪","Pickup","Collect from shop"],["🚚","Delivery","CCC riders deliver"],["✅","Verified shops","All shops checked"],["💳","Secure pay","M-Pesa or card"]].map(([icon,title,desc])=>(
              <div key={title} style={{ ...card, display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>{icon}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#000" }}>{title}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>navigate("/auth")} style={btnOrange}>Browse parts →</button>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background:"rgba(245,245,245,0.84)", padding:"3rem 1.25rem", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:600, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <span style={sLabel}>FAQ</span>
            <h2 style={h2}>Frequently asked questions</h2>
          </div>
          {faqs.map((faq,i)=>(
            <div key={i} className="faq-row" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:15, fontWeight:500, color:"#000" }}>{faq.q}</span>
                <span style={{ fontSize:22, color:"#e6821e", flexShrink:0, fontWeight:300 }}>{openFaq===i?"ΓêÆ":"+"}</span>
              </div>
              {openFaq===i&&<div style={{ fontSize:14, color:"#666", marginTop:10, lineHeight:1.7 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:"rgba(0,0,0,0.90)", padding:"4rem 1.25rem", textAlign:"center", position:"relative", overflow:"hidden", zIndex:1 }}>
        <FloatingParts/>
        <div style={{ maxWidth:500, margin:"0 auto", position:"relative", zIndex:2 }}>
          <img src="/logo.svg" alt="Car Care Connect" style={{ height:70, marginBottom:"1.5rem", animation:"glow 3s ease-in-out infinite" }}/>
          <h2 style={{ fontWeight:800, fontSize:"clamp(26px,5vw,48px)", lineHeight:1.1, color:"#fff", marginBottom:12, letterSpacing:-0.5 }}>
            Nairobi's car care platform<br/><span style={{ color:"#e6821e" }}>starts here.</span>
          </h2>
          <p style={{ ...body, color:"#aaa", marginBottom:"2rem" }}>Join thousands of car owners and mechanics already on CCC. Free to join. Available 24/7. Built for Nairobi.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={()=>navigate("/auth")} style={btnOrange}>🚗 Get started free</button>
            <button onClick={()=>navigate("/auth")} style={{ ...btnOutline, color:"#fff", borderColor:"#555" }}>Sign in →</button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background:"rgba(17,17,17,0.95)", padding:"2rem 1.25rem", borderTop:"1px solid #222", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:800, margin:"0 auto" }}>
          <div style={{ fontWeight:700, fontSize:18, color:"#fff", marginBottom:8 }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
          <p style={{ fontSize:12, color:"#666", marginBottom:"1rem", lineHeight:1.6 }}>🇰🇪 Nairobi's most trusted automotive platform</p>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:"1rem" }}>
            <a href="/privacy" style={{ fontSize:12, color:"#666", textDecoration:"none" }}>Privacy Policy</a>
            <a href="/terms" style={{ fontSize:12, color:"#666", textDecoration:"none" }}>Terms of Service</a>
            <a href="tel:0113858966" style={{ fontSize:12, color:"#666", textDecoration:"none" }}>0113858966</a>
            <a href="mailto:carcareconnect254@gmail.com" style={{ fontSize:12, color:"#666", textDecoration:"none" }}>carcareconnect254@gmail.com</a>
          </div>
          <div style={{ fontSize:11, color:"#444" }}>┬⌐ 2026 Car Care Connect ┬╖ Nairobi, Kenya ┬╖ Payments secured by Pesapal ┬╖ Regulated by Central Bank of Kenya</div>
        </div>
      </div>

      {/* STICKY CTA */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(255,255,255,0.95)", borderTop:"2px solid #e6821e", padding:"0.75rem 1.25rem", zIndex:50, backdropFilter:"blur(10px)" }}>
        <button onClick={()=>navigate("/auth")} style={{ ...btnOrange, width:"100%", fontSize:15, padding:"13px" }}>Get started free</button>
      </div>
      <div style={{ height:64 }}/>
    </div>
  )
}




