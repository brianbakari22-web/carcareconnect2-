import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"

export default function AdminRefunds() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  return (
    <div style={{ maxWidth:600, margin:"0 auto", textAlign:"center", padding:"3rem 1rem" }}>
      <div style={{ fontSize:48, marginBottom:"1rem" }}>🛡️</div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#000000", marginBottom:8 }}>
        Refunds have moved
      </div>
      <div style={{ fontSize:13, color:"#888", lineHeight:1.8, marginBottom:"2rem", maxWidth:460, margin:"0 auto 2rem" }}>
        We have replaced the old refund system with our new <strong style={{ color:"#e6821e" }}>Service Guarantee</strong> system.
        It is fairer, faster, and holds providers accountable.
        Cash refunds are still available as a last resort inside Service Claims.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:"2rem", textAlign:"left" }}>
        {[
          { icon:"❌", label:"Old refund system", desc:"Cash back only. Provider not penalized. Customer may leave platform.", color:"#e24b4a" },
          { icon:"✅", label:"New Service Guarantee", desc:"Voucher for full service value. Provider penalized. Customer stays on platform.", color:"#1d9e75" },
        ].map(item=>(
          <div key={item.label} style={{ background:"#f8f8f8", border:`1px solid ${item.color}30`, borderRadius:12, padding:"1rem" }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{item.icon}</div>
            <div style={{ fontSize:13, fontWeight:600, color:item.color, marginBottom:4 }}>{item.label}</div>
            <div style={{ fontSize:11, color:"#888", lineHeight:1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <button onClick={()=>navigate("/admin-dashboard/claims")}
        style={{ background:"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px 32px", cursor:"pointer" }}>
        Go to Service Claims →
      </button>

      <div style={{ fontSize:11, color:"#888", marginTop:12 }}>
        Cash refunds are available as an exception inside Service Claims
      </div>
    </div>
  )
}
