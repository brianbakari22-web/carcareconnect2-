import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#1a1208", confirmed:"#0c1f2e", "in-progress":"#160a2e", completed:"#071a12", cancelled:"#1a0808" }

export default function ProviderDashboard() {
  const { user, profile } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ pending:0, confirmed:0, completed:0, earnings:0 })
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("prov-dash")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user.id}` }, () => { load(); toast("Booking updated", { icon:"📋" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("bookings").select("*").eq("provider_id", user.id).order("created_at",{ascending:false}).limit(20)
    const bks = data||[]
    setBookings(bks)
    setStats({
      pending: bks.filter(b=>b.status==="pending").length,
      confirmed: bks.filter(b=>b.status==="confirmed").length,
      completed: bks.filter(b=>b.status==="completed").length,
      earnings: bks.filter(b=>b.status==="completed").reduce((s,b)=>s+Number(b.provider_earnings||0),0)
    })
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success(`Booking ${status}`)
    load()
  }

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#f0ede6" }}>
          {language==="sw"?"Karibu":"Welcome"}, <span style={{ color:"#378add" }}>{profile?.business_name||profile?.first_name}</span>
        </div>
        <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{new Date().toLocaleDateString("default",{weekday:"long",month:"long",day:"numeric"})}</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?8:10, marginBottom:"1.25rem" }}>
        {[
          { label:t("pending"), value:stats.pending, color:stats.pending>0?"#e6821e":undefined },
          { label:language==="sw"?"Zilizothibitishwa":"Confirmed", value:stats.confirmed, color:"#378add" },
          { label:t("completed"), value:stats.completed, color:"#1d9e75" },
          { label:t("earnings"), value:`$${stats.earnings.toFixed(2)}`, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>
        {language==="sw"?"Miadi ya hivi karibuni":"Recent bookings"}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&bookings.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>{language==="sw"?"Hakuna miadi bado":"No bookings yet"}</div>}

      {bookings.map(b=>(
        <div key={b.id} style={{ background:"#111", border:`1px solid ${SB[b.status]||"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ flex:1, minWidth:0, marginRight:8 }}>
              <div style={{ fontSize:isMobile?13:14, fontWeight:500, color:"#f0ede6", marginBottom:2 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#555" }}>{b.booking_date} · {b.booking_time?.slice(0,5)}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:SB[b.status]||"#111", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>{b.status}</span>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>${Number(b.total_amount).toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {b.status==="pending"&&<>
              <button onClick={()=>updateStatus(b.id,"confirmed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>{language==="sw"?"Thibitisha":"Confirm"}</button>
              <button onClick={()=>updateStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>{language==="sw"?"Kataa":"Decline"}</button>
            </>}
            {b.status==="confirmed"&&<button onClick={()=>updateStatus(b.id,"in-progress")} style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>{language==="sw"?"Anza huduma":"Start"}</button>}
            {b.status==="in-progress"&&<button onClick={()=>updateStatus(b.id,"completed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>{language==="sw"?"Kamilisha":"Complete"}</button>}
            <button onClick={()=>setExpanded(expanded===b.id?null:b.id)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {expanded===b.id?t("less"):t("details")}
            </button>
          </div>

          {expanded===b.id&&(
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1e1e1e" }}>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8 }}>
                {[
                  { l:language==="sw"?"Mapato yako":"Your earnings", v:`$${Number(b.provider_earnings||0).toFixed(2)}`, c:"#1d9e75" },
                  { l:"Platform 15%", v:`$${Number(b.platform_commission||0).toFixed(2)}` },
                  { l:t("paymentStatus"), v:b.payment_status },
                ].map(f=>(
                  <div key={f.l}>
                    <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:2 }}>{f.l}</div>
                    <div style={{ fontSize:12, color:f.c||"#f0ede6" }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
