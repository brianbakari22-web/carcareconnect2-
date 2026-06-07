import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])

  const services = [
    { icon:"🔧", label:"Garage", desc:"Book a mechanic" },
    { icon:"⚙️", label:"Parts", desc:"Order car parts" },
    { icon:"🛞", label:"Tyres", desc:"Buy & fit tyres" },
    { icon:"🚿", label:"Car Wash", desc:"Book a wash" },
    { icon:"⚡", label:"Electrician", desc:"Auto electrical" },
    { icon:"🔨", label:"Panel Beater", desc:"Body & paint" },
  ]

  const faqs = [
    { q:"How do I book a service?", a:"Search for a provider near you, select a service, pick a time and confirm. You will receive a notification once the provider confirms." },
    { q:"How does parts delivery work?", a:"Browse the parts marketplace, add items to cart, choose pickup or delivery, and pay securely. CCC riders deliver within Nairobi." },
    { q:"How do I become a provider?", a:"Sign up as a provider, choose your business type, add your services or inventory, and start receiving customers." },
    { q:"Is payment secure?", a:"Yes. All payments are processed through Pesapal — supporting M-Pesa, Visa and Mastercard." },
    { q:"What is GO Service?", a:"GO Service is 24/7 emergency roadside assistance. A mechanic comes to your location when your car breaks down." },
  ]

  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif", background:"#fff", color:"#000", minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pill-btn { border-radius: 500px !important; }
        .service-card:hover { background: #e8e8e8 !important; }
        .faq-item { border-bottom: 1px solid #e5e5e5; }
        .faq-item:first-child { border-top: 1px solid #e5e5e5; }
      `}</style>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"#000", padding:"0 1.5rem", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"DM Sans", fontSize:22, fontWeight:700, color:"#fff", letterSpacing:-0.5 }}>
          Car<span style={{ color:"#e6821e" }}>Care</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"none", color:"#fff", fontSize:14, fontWeight:500, padding:"8px 16px", cursor:"pointer" }}>
            Log in
          </button>
          <button onClick={()=>navigate("/auth")} style={{ background:"#fff", border:"none", borderRadius:500, color:"#000", fontSize:14, fontWeight:600, padding:"9px 20px", cursor:"pointer" }}>
            Sign up
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ paddingTop:60, background:"#fff" }}>
        <div style={{ padding:"3rem 1.5rem 2rem" }}>
          <h1 style={{ fontSize:42, fontWeight:800, lineHeight:1.1, letterSpacing:-1, marginBottom:"1.5rem", color:"#000" }}>
            Nairobi's car care,<br/>at your fingertips.
          </h1>
          <p style={{ fontSize:16, color:"#6b6b6b", marginBottom:"2rem", lineHeight:1.6 }}>
            Book mechanics, order parts, wash your car and more — all from one app.
          </p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={()=>navigate("/auth")} style={{ background:"#000", border:"none", borderRadius:500, color:"#fff", fontSize:15, fontWeight:600, padding:"14px 28px", cursor:"pointer" }}>
              Get started free
            </button>
            <button onClick={()=>navigate("/auth")} style={{ background:"none", border:"1.5px solid #000", borderRadius:500, color:"#000", fontSize:15, fontWeight:600, padding:"14px 28px", cursor:"pointer" }}>
              Sign in
            </button>
          </div>
        </div>

        {/* Hero image */}
        <div style={{ background:"#000", margin:"0", padding:"2rem 1.5rem", minHeight:280, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:72, marginBottom:12 }}>🚗</div>
            <div style={{ fontFamily:"DM Sans", fontSize:24, fontWeight:700, color:"#fff", marginBottom:8 }}>Your car. Our care.</div>
            <div style={{ fontSize:14, color:"#888" }}>Simplified.</div>
          </div>
        </div>
      </div>

      {/* SERVICES GRID */}
      <div style={{ padding:"2.5rem 1.5rem", background:"#fff" }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:"1.5rem", letterSpacing:-0.5 }}>
          What can we help with?
        </h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {services.map(s=>(
            <div key={s.label} className="service-card" onClick={()=>navigate("/auth")}
              style={{ background:"#f5f5f5", borderRadius:16, padding:"1.25rem 0.75rem", textAlign:"center", cursor:"pointer", transition:"background 0.15s" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:2 }}>{s.label}</div>
              <div style={{ fontSize:11, color:"#6b6b6b" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PARTS SECTION */}
      <div style={{ background:"#f5f5f5", padding:"2.5rem 1.5rem" }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:8, letterSpacing:-0.5 }}>
          Parts delivered to you
        </h2>
        <p style={{ fontSize:15, color:"#6b6b6b", marginBottom:"1.5rem", lineHeight:1.6 }}>
          Browse genuine and aftermarket parts from verified Nairobi shops. Order online, pay with M-Pesa, get delivered by CCC riders.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:"1.5rem" }}>
          {["Engine and mechanical parts","Car accessories","Tyres all brands","Batteries and electrical","Engine oils and fluids"].map(item=>(
            <div key={item} style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, color:"#000" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#000", flexShrink:0 }}/>
              {item}
            </div>
          ))}
        </div>
        <button onClick={()=>navigate("/auth")} style={{ background:"#000", border:"none", borderRadius:500, color:"#fff", fontSize:15, fontWeight:600, padding:"14px 28px", cursor:"pointer" }}>
          Browse parts
        </button>
      </div>

      {/* GO SERVICE */}
      <div style={{ background:"#000", padding:"2.5rem 1.5rem" }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:8, letterSpacing:-0.5, color:"#fff" }}>
          Broke down? We come to you.
        </h2>
        <p style={{ fontSize:15, color:"#888", marginBottom:"1.5rem", lineHeight:1.6 }}>
          GO Service is 24/7 emergency roadside assistance. A certified mechanic comes to your location anywhere in Nairobi.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1.5rem" }}>
          {[
            { icon:"⚡", label:"Fast response", desc:"Under 30 mins" },
            { icon:"🔧", label:"Certified mechanics", desc:"Trained & vetted" },
            { icon:"💳", label:"Pay after service", desc:"M-Pesa or card" },
            { icon:"📍", label:"Any location", desc:"All Nairobi" },
          ].map(f=>(
            <div key={f.label} style={{ background:"#1a1a1a", borderRadius:12, padding:"1rem" }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{f.icon}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#fff", marginBottom:2 }}>{f.label}</div>
              <div style={{ fontSize:11, color:"#888" }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>navigate("/auth")} style={{ background:"#fff", border:"none", borderRadius:500, color:"#000", fontSize:15, fontWeight:600, padding:"14px 28px", cursor:"pointer" }}>
          Request emergency help
        </button>
      </div>

      {/* PROVIDERS SECTION */}
      <div style={{ background:"#fff", padding:"2.5rem 1.5rem" }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:8, letterSpacing:-0.5 }}>
          Are you a provider?
        </h2>
        <p style={{ fontSize:15, color:"#6b6b6b", marginBottom:"1.5rem", lineHeight:1.6 }}>
          Join CCC as a garage, parts dealer, tyre shop, car wash or auto electrician. Reach thousands of Nairobi car owners.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1.5rem" }}>
          {[
            { stat:"500+", label:"Car owners" },
            { stat:"50+", label:"Providers" },
            { stat:"95%", label:"Provider earnings" },
            { stat:"24/7", label:"Platform uptime" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#f5f5f5", borderRadius:12, padding:"1rem", textAlign:"center" }}>
              <div style={{ fontFamily:"DM Sans", fontSize:26, fontWeight:800, color:"#000" }}>{s.stat}</div>
              <div style={{ fontSize:12, color:"#6b6b6b", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>navigate("/auth")} style={{ background:"#000", border:"none", borderRadius:500, color:"#fff", fontSize:15, fontWeight:600, padding:"14px 28px", cursor:"pointer" }}>
          Join as a provider
        </button>
      </div>

      {/* FAQ */}
      <div style={{ background:"#f5f5f5", padding:"2.5rem 1.5rem" }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:"1.5rem", letterSpacing:-0.5 }}>
          Frequently asked questions
        </h2>
        {faqs.map((faq,i)=>(
          <div key={i} className="faq-item" style={{ padding:"1.25rem 0", cursor:"pointer" }} onClick={()=>setOpenFaq(openFaq===i?null:i)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:500, color:"#000", paddingRight:16 }}>{faq.q}</span>
              <span style={{ fontSize:20, color:"#000", flexShrink:0 }}>{openFaq===i?"−":"+"}</span>
            </div>
            {openFaq===i&&(
              <div style={{ fontSize:14, color:"#6b6b6b", marginTop:12, lineHeight:1.6 }}>{faq.a}</div>
            )}
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ background:"#000", padding:"2.5rem 1.5rem" }}>
        <div style={{ fontFamily:"DM Sans", fontSize:24, fontWeight:700, color:"#fff", marginBottom:"1rem" }}>
          Car<span style={{ color:"#e6821e" }}>Care</span> Connect
        </div>
        <p style={{ fontSize:13, color:"#888", marginBottom:"1.5rem", lineHeight:1.6 }}>
          Nairobi's automotive ecosystem. Your car. Our care. Simplified.
        </p>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:"1.5rem" }}>
          {["Privacy Policy","Terms of Service","Contact Us"].map(link=>(
            <a key={link} href={link==="Privacy Policy"?"/privacy":link==="Terms of Service"?"/terms":"#"}
              style={{ fontSize:13, color:"#888", textDecoration:"none" }}>{link}</a>
          ))}
        </div>
        <div style={{ fontSize:12, color:"#555" }}>© 2026 Car Care Connect Kenya. All rights reserved.</div>
      </div>

      {/* STICKY BOTTOM CTA */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #e5e5e5", padding:"0.75rem 1.5rem", zIndex:50 }}>
        <button onClick={()=>navigate("/auth")} style={{ width:"100%", background:"#000", border:"none", borderRadius:500, color:"#fff", fontSize:15, fontWeight:600, padding:"14px", cursor:"pointer" }}>
          Get started
        </button>
      </div>

      <div style={{ height:70 }}/>
    </div>
  )
}
