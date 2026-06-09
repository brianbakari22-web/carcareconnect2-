import { useNavigate } from "react-router-dom"
import CCCIcon from "../shared/CCCIcon"

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
    { id:11, icon:"🏎️", left:8, top:40, size:46, duration:11, delay:1, opacity:0.20 },
  ]
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      <style>{`
        @keyframes float-up { 0%{transform:translateY(0) rotate(0deg);opacity:var(--op)} 50%{transform:translateY(-30px) rotate(10deg);opacity:calc(var(--op)*0.7)} 100%{transform:translateY(0) rotate(0deg);opacity:var(--op)} }
      `}</style>
      {items.map(p=>(
        <div key={p.id} style={{ position:"absolute", left:p.left+"%", top:p.top+"%", fontSize:p.size, "--op":p.opacity, opacity:p.opacity, animation:`float-up ${p.duration}s ease-in-out ${p.delay}s infinite` }}>
          {p.icon}
        </div>
      ))}
    </div>
  )
}

const HOW_IT_WORKS = [
  { n:"01", icon:"search", title:"Find a service", desc:"Browse verified providers near you. Compare prices, read reviews, and pick the best mechanic for your car and budget." },
  { n:"02", icon:"bookings", title:"Book and pay", desc:"Book in seconds. Pay securely via M-Pesa or card through Pesapal, regulated by Central Bank of Kenya." },
  { n:"03", icon:"claims", title:"Track and review", desc:"Track your mechanic live on the map. Rate your experience and earn loyalty points on every booking." },
]

const FEATURES = [
  { icon:"garage", title:"Service booking", desc:"Oil change, brakes, AC, full diagnostics from verified Nairobi providers" },
  { icon:"emergency", title:"GO Service", desc:"24/7 emergency roadside. Mechanic dispatched to your GPS location fast" },
  { icon:"vehicles", title:"Concierge delivery", desc:"We collect your car, service it, and return it to your door" },
  { icon:"marketplace", title:"Parts marketplace", desc:"Buy genuine and aftermarket parts from verified Nairobi shops" },
  { icon:"referral", title:"Loyalty rewards", desc:"Earn points every booking. Redeem for discounts on future services" },
  { icon:"tracking", title:"Live tracking", desc:"Track your driver or mechanic on a live map in real time" },
  { icon:"guarantee", title:"Service guarantee", desc:"Not happy? We investigate and issue a full service voucher refund" },
  { icon:"support", title:"24/7 assistant", desc:"Always-on help for car problems, bookings, and platform guidance" },
]

const WHY_CCC = [
  { icon:"guarantee", title:"Service Guarantee", desc:"Not happy with the service? We investigate and issue a full refund voucher. No questions asked." },
  { icon:"claims", title:"Verified providers only", desc:"Every mechanic, parts dealer and service provider is manually verified before listing on CCC." },
  { icon:"tracking", title:"Real-time tracking", desc:"Know exactly where your mechanic or driver is at all times. Live GPS tracking on every job." },
  { icon:"settings", title:"Secure payments", desc:"All payments processed through Pesapal, regulated by the Central Bank of Kenya." },
  { icon:"support", title:"24/7 support", desc:"Always-on support to help diagnose car problems, guide bookings, and answer any question." },
  { icon:"discover", title:"Made in Kenya", desc:"Built by Kenyans for Kenyan roads. We understand Nairobi traffic, local mechanics, and Kenyan cars." },
]

const ROLES = [
  { icon:"vehicles", role:"Customer", color:"#e6821e", desc:"Book services, get emergency help, track your car, earn rewards", features:["Book car services","Emergency GO Service","Live mechanic tracking","Parts marketplace"] },
  { icon:"garage", role:"Service Provider", color:"#378add", desc:"List services, manage bookings, earn commissions, dispatch mechanics", features:["Manage bookings","GO Service requests","Parts inventory","Earnings dashboard"] },
  { icon:"tracking", role:"Concierge Driver", color:"#1d9e75", desc:"Pick up and deliver customer vehicles and parts, earn per delivery", features:["Accept deliveries","Parts delivery jobs","Live navigation","KES 200 allowance per trip"] },
]

const PROVIDER_TYPES = [
  { icon:"garage", type:"Garage/Mechanic", keep:"90%" },
  { icon:"partsDealer", type:"Parts Dealer", keep:"95%" },
  { icon:"accessories", type:"Accessories Shop", keep:"92%" },
  { icon:"tyreShop", type:"Tyre Shop", keep:"94%" },
  { icon:"autoElectrician", type:"Auto Electrician", keep:"88%" },
  { icon:"carWash", type:"Car Wash", keep:"90%" },
  { icon:"panelBeater", type:"Panel Beater", keep:"85%" },
  { icon:"autoGlass", type:"Auto Glass", keep:"88%" },
]

const PRICES = [
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
]

const FAQS = [
  { q:"How do I book a service?", a:"Go to Find Services, browse providers near you, select a service and click Book. Choose your date, time and payment method. Provider confirms within 30 minutes." },
  { q:"How does parts delivery work?", a:"Browse the parts marketplace, add items to cart, choose pickup or delivery, and pay securely via M-Pesa. CCC riders deliver within Nairobi." },
  { q:"How do I become a provider?", a:"Click Get Started, select Service Provider, choose your business type and register. Our team verifies your business within 24 hours." },
  { q:"Is payment secure?", a:"Yes. All payments are processed through Pesapal, regulated by the Central Bank of Kenya. We support M-Pesa STK push, Visa and Mastercard." },
  { q:"What is GO Service?", a:"GO Service is our 24/7 emergency roadside assistance. Pay KES 500 callout fee upfront, and a verified mechanic is dispatched to your GPS location within minutes." },
  { q:"Can I track my mechanic?", a:"Yes! Once a mechanic or driver accepts your booking, you get a live map showing their exact location and estimated arrival time." },
]

const Divider = () => (
  <div style={{ display:"flex", justifyContent:"center", padding:"2rem 0", overflow:"hidden" }}>
    <div style={{ fontSize:24, whiteSpace:"nowrap", animation:"marquee 20s linear infinite", opacity:0.4 }}>
      {"🛞⚙️🔧🚗🔋🛢️🔩⚡🪛🔑🛠️🏎️  ".repeat(4)}
    </div>
  </div>
)

export default function LandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)
  const btnOrange = { background:"#e6821e", border:"none", borderRadius:500, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px 28px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }
  const btnBlack = { background:"#000", border:"none", borderRadius:500, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px 28px", cursor:"pointer" }

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"#fff", color:"#000", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <FloatingParts/>

      {/* NAV */}
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 5%", height:60, background:"#000", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#fff" }}>Car<span style={{ color:"#e6821e" }}>Care</span></div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>navigate("/auth")} style={{ ...btnBlack, background:"none", border:"1px solid #333", fontSize:13, padding:"8px 18px" }}>Sign in</button>
          <button onClick={()=>navigate("/auth")} style={{ ...btnOrange, fontSize:13, padding:"8px 18px" }}>Get started</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position:"relative", minHeight:"92vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"4rem 5%", zIndex:1 }}>
        <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:16, textTransform:"uppercase" }}>🇰🇪 Built in Kenya · Serving Nairobi</div>
        <h1 style={{ fontFamily:"Syne", fontSize:"clamp(42px,8vw,88px)", fontWeight:900, lineHeight:1.0, letterSpacing:-2, color:"#000", marginBottom:16, maxWidth:900 }}>
          One app.<br/><span style={{ color:"#e6821e" }}>Every car need.</span><br/>Nairobi.
        </h1>
        <p style={{ fontSize:"clamp(15px,2vw,18px)", color:"#555", maxWidth:560, lineHeight:1.7, marginBottom:36 }}>
          Nairobi's most trusted automotive platform. Verified mechanics, 24/7 emergency roadside help, live tracking, parts marketplace — everything your car needs, one tap away.
        </p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center", marginBottom:48 }}>
          <button onClick={()=>navigate("/auth")} style={btnOrange}>🚗 Get started free</button>
          <button onClick={()=>navigate("/auth")} style={{ ...btnBlack, background:"none", border:"2px solid #000", color:"#000" }}>Sign in →</button>
        </div>
        <div style={{ display:"flex", gap:32, flexWrap:"wrap", justifyContent:"center" }}>
          {[["24/7","Emergency service"],["5min","Avg response"],["100%","Verified providers"],["🇰🇪","Made in Kenya"]].map(([v,l])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#000" }}>{v}</div>
              <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:40, flexWrap:"wrap", justifyContent:"center" }}>
          {[["vehicles","Service booking"],["emergency","24/7 emergency"],["tracking","Live tracking"],["marketplace","Marketplace"],["referral","Loyalty rewards"]].map(([icon,label])=>(
            <div key={label} style={{ display:"flex", alignItems:"center", gap:6, background:"#f5f5f5", borderRadius:100, padding:"6px 14px" }}>
              <CCCIcon name={icon} size={16}/>
              <span style={{ fontSize:12, fontWeight:500, color:"#333" }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <Divider/>

      {/* GO SERVICE */}
      <section style={{ padding:"5rem 5%", background:"#0a0a0a", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:900, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:12, textTransform:"uppercase" }}>GO Service</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(32px,5vw,56px)", fontWeight:900, color:"#fff", marginBottom:16 }}>Broke down? We come to you.</h2>
          <p style={{ fontSize:16, color:"#aaa", maxWidth:560, margin:"0 auto 40px", lineHeight:1.7 }}>
            Kenya's only 24/7 emergency roadside service. Our certified mechanics come to your exact GPS location — highway, parking lot, or home. Just KES 500 callout fee.
          </p>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center", marginBottom:40 }}>
            {["🛞 Flat tyre","🔋 Dead battery","⛽ Out of fuel","🌡️ Overheating","🚚 Towing"].map(item=>(
              <div key={item} style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:100, padding:"8px 16px", fontSize:13, color:"#fff" }}>{item}</div>
            ))}
          </div>
          <button onClick={()=>navigate("/auth")} style={{ ...btnOrange, background:"#e24b4a", fontSize:15, padding:"14px 32px" }}>🚨 Request emergency help</button>
        </div>
      </section>

      <Divider/>

      {/* HOW IT WORKS */}
      <section style={{ padding:"5rem 5%", background:"#fff", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>How it works</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:"#000" }}>Car care has never been this easy</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:24 }}>
            {HOW_IT_WORKS.map(hw=>(
              <div key={hw.n} style={{ background:"#f8f8f8", borderRadius:20, padding:"2rem", textAlign:"center" }}>
                <div style={{ fontFamily:"Syne", fontSize:48, fontWeight:900, color:"#f0f0f0", marginBottom:8 }}>{hw.n}</div>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><CCCIcon name={hw.icon} size={48}/></div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:8 }}>{hw.title}</div>
                <div style={{ fontSize:14, color:"#666", lineHeight:1.6 }}>{hw.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* FEATURES */}
      <section style={{ padding:"5rem 5%", background:"#fafafa", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>Features</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:"#000" }}>Everything your car needs, in one place</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16 }}>
            {FEATURES.map(f=>(
              <div key={f.title} style={{ background:"#fff", borderRadius:16, padding:"1.5rem", border:"1px solid #eeeeee" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}><CCCIcon name={f.icon} size={44}/></div>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:6, textAlign:"center" }}>{f.title}</div>
                <div style={{ fontSize:13, color:"#666", lineHeight:1.6, textAlign:"center" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* WHY CCC */}
      <section style={{ padding:"5rem 5%", background:"#fff", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>Why CCC</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:"#000" }}>Built for Kenya. Built for trust.</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
            {WHY_CCC.map(w=>(
              <div key={w.title} style={{ display:"flex", gap:16, padding:"1.25rem", background:"#f8f8f8", borderRadius:16 }}>
                <div style={{ flexShrink:0 }}><CCCIcon name={w.icon} size={40}/></div>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:4 }}>{w.title}</div>
                  <div style={{ fontSize:13, color:"#666", lineHeight:1.6 }}>{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* WHO IS IT FOR */}
      <section style={{ padding:"5rem 5%", background:"#fafafa", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>Who is it for</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:"#000" }}>Built for everyone in the ecosystem</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
            {ROLES.map(r=>(
              <div key={r.role} style={{ background:"#fff", borderRadius:20, padding:"2rem", border:`2px solid ${r.color}20` }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><CCCIcon name={r.icon} size={56}/></div>
                <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:900, color:"#000", marginBottom:8, textAlign:"center" }}>{r.role}</div>
                <div style={{ fontSize:13, color:"#666", marginBottom:16, textAlign:"center", lineHeight:1.6 }}>{r.desc}</div>
                <ul style={{ listStyle:"none", padding:0, margin:"0 0 20px" }}>
                  {r.features.map(feat=>(
                    <li key={feat} style={{ fontSize:13, color:"#555", padding:"4px 0", borderBottom:"1px solid #f0f0f0", display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:r.color, fontSize:16 }}>✓</span> {feat}
                    </li>
                  ))}
                </ul>
                <button onClick={()=>navigate("/auth")} style={{ ...btnOrange, background:r.color, width:"100%", justifyContent:"center" }}>
                  Join as {r.role} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* PROVIDER TYPES */}
      <section style={{ padding:"5rem 5%", background:"#000", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>For businesses</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:"#fff" }}>All automotive businesses welcome</h2>
            <p style={{ fontSize:15, color:"#888", marginTop:12 }}>Not just mechanics — list any automotive business and reach thousands of customers in Nairobi</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:32 }}>
            {PROVIDER_TYPES.map(pt=>(
              <div key={pt.type} style={{ background:"#111", border:"1px solid #222", borderRadius:16, padding:"1.5rem", textAlign:"center" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}><CCCIcon name={pt.icon} size={44} color="#e6821e" accent="#FFA040"/></div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#fff", marginBottom:4 }}>{pt.type}</div>
                <div style={{ fontSize:13, color:"#e6821e", fontWeight:700 }}>Keep {pt.keep}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center" }}>
            <button onClick={()=>navigate("/auth")} style={btnOrange}>Register your business →</button>
          </div>
        </div>
      </section>

      <Divider/>

      {/* PRICING */}
      <section style={{ padding:"5rem 5%", background:"#fff", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:900, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>Pricing</div>
          <h2 style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:"#000", marginBottom:8 }}>Earn more. Keep more.</h2>
          <p style={{ fontSize:15, color:"#666", marginBottom:40 }}>No monthly fees. No hidden charges. We only make money when you make money.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
            {[
              { cat:"Shop Standard", pct:"90%", sub:"Platform: 10%", desc:"Customer brings car to your shop" },
              { cat:"Shop Premium", pct:"80%", sub:"Platform: 20%", desc:"Your mechanic travels to customer" },
              { cat:"GO Service", pct:"85%", sub:"Platform: 15%", desc:"Emergency roadside assistance" },
              { cat:"Marketplace", pct:"92-98%", sub:"Platform: 2-8%", desc:"Buy and sell vehicles and parts" },
            ].map(p=>(
              <div key={p.cat} style={{ background:"#f8f8f8", borderRadius:16, padding:"1.5rem", textAlign:"center" }}>
                <div style={{ fontSize:13, color:"#888", marginBottom:4 }}>{p.cat}</div>
                <div style={{ fontFamily:"Syne", fontSize:36, fontWeight:900, color:"#e6821e" }}>{p.pct}</div>
                <div style={{ fontSize:12, color:"#888", marginBottom:8 }}>Your earnings</div>
                <div style={{ fontSize:11, color:"#aaa", marginBottom:8 }}>{p.sub}</div>
                <div style={{ fontSize:12, color:"#555" }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* NAIROBI PRICES */}
      <section style={{ padding:"5rem 5%", background:"#fafafa", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:800, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>Nairobi market prices</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,3vw,36px)", fontWeight:900, color:"#000" }}>What services cost in Nairobi 2026</h2>
          </div>
          <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", border:"1px solid #eeeeee" }}>
            {PRICES.map(([service, price], i)=>(
              <div key={service} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:i<PRICES.length-1?"1px solid #f5f5f5":"none", background:i%2===0?"#fff":"#fafafa" }}>
                <span style={{ fontSize:14, color:"#333" }}>{service}</span>
                <span style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>{price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider/>

      {/* PARTS MARKETPLACE */}
      <section style={{ padding:"5rem 5%", background:"#fff", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>Parts marketplace</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,3vw,36px)", fontWeight:900, color:"#000", marginBottom:12 }}>Order parts online. Delivered to your door.</h2>
            <p style={{ fontSize:15, color:"#666", maxWidth:540, margin:"0 auto" }}>Browse genuine and aftermarket parts from verified Nairobi shops. Order online, pay securely via M-Pesa, get it delivered by CCC riders.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:32 }}>
            {[["partsDealer","Engine & mechanical"],["accessories","Car accessories"],["tyreShop","Tyres all brands"],["autoElectrician","Batteries & electrical"],["earnings","Oils & fluids"]].map(([icon,label])=>(
              <div key={label} style={{ background:"#f8f8f8", borderRadius:12, padding:"1.25rem", textAlign:"center" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><CCCIcon name={icon} size={36}/></div>
                <div style={{ fontSize:13, color:"#333", fontWeight:500 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:32 }}>
            {[["🏪","Pickup","Collect from shop"],["🚚","Delivery","CCC riders deliver"],["✅","Verified shops","All shops checked"],["💳","Secure pay","M-Pesa or card"]].map(([icon,title,desc])=>(
              <div key={title} style={{ display:"flex", alignItems:"center", gap:8, background:"#f5f5f5", borderRadius:12, padding:"12px 16px" }}>
                <span style={{ fontSize:20 }}>{icon}</span>
                <div><div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{title}</div><div style={{ fontSize:11, color:"#888" }}>{desc}</div></div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center" }}>
            <button onClick={()=>navigate("/auth")} style={btnOrange}>Browse parts →</button>
          </div>
        </div>
      </section>

      <Divider/>

      {/* FAQ */}
      <section style={{ padding:"5rem 5%", background:"#fafafa", zIndex:1, position:"relative" }}>
        <div style={{ maxWidth:700, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:8, textTransform:"uppercase" }}>FAQ</div>
            <h2 style={{ fontFamily:"Syne", fontSize:"clamp(24px,3vw,36px)", fontWeight:900, color:"#000" }}>Frequently asked questions</h2>
          </div>
          {FAQS.map((faq,i)=>(
            <div key={i} style={{ border:"1px solid #eeeeee", borderRadius:12, marginBottom:8, overflow:"hidden" }}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", background:"#fff", border:"none", cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:"#000" }}>{faq.q}</span>
                <span style={{ fontSize:20, color:"#e6821e", flexShrink:0, marginLeft:12 }}>{openFaq===i?"−":"+"}</span>
              </button>
              {openFaq===i&&<div style={{ padding:"0 20px 16px", fontSize:14, color:"#666", lineHeight:1.7, background:"#fff" }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      <Divider/>

      {/* CTA */}
      <section style={{ padding:"6rem 5%", background:"#000", textAlign:"center", zIndex:1, position:"relative" }}>
        <div style={{ fontSize:12, fontWeight:600, letterSpacing:2, color:"#e6821e", marginBottom:16, textTransform:"uppercase" }}>Car Care Connect</div>
        <h2 style={{ fontFamily:"Syne", fontSize:"clamp(32px,5vw,60px)", fontWeight:900, color:"#fff", marginBottom:16, lineHeight:1.1 }}>
          Nairobi's car care platform<br/><span style={{ color:"#e6821e" }}>starts here.</span>
        </h2>
        <p style={{ fontSize:16, color:"#888", maxWidth:480, margin:"0 auto 40px", lineHeight:1.7 }}>
          Join thousands of car owners and mechanics already on CCC. Free to join. Available 24/7. Built for Nairobi.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={()=>navigate("/auth")} style={btnOrange}>🚗 Get started free</button>
          <button onClick={()=>navigate("/auth")} style={{ ...btnBlack, background:"none", border:"1px solid #333", color:"#fff" }}>Sign in →</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:"#000", borderTop:"1px solid #111", padding:"2rem 5%", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#fff", marginBottom:4 }}>CarCare Connect</div>
          <div style={{ fontSize:12, color:"#555" }}>🇰🇪 Nairobi's most trusted automotive platform</div>
        </div>
        <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
          <a href="/privacy" style={{ fontSize:12, color:"#555", textDecoration:"none" }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize:12, color:"#555", textDecoration:"none" }}>Terms of Service</a>
          <a href="tel:0113858966" style={{ fontSize:12, color:"#555", textDecoration:"none" }}>0113858966</a>
          <a href="mailto:carcareconnect254@gmail.com" style={{ fontSize:12, color:"#555", textDecoration:"none" }}>carcareconnect254@gmail.com</a>
        </div>
        <div style={{ fontSize:11, color:"#333", width:"100%" }}>© 2026 Car Care Connect · Nairobi, Kenya · Payments secured by Pesapal · Regulated by Central Bank of Kenya</div>
      </footer>
    </div>
  )
}


