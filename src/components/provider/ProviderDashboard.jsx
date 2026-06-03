import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const COMMISSION_RATES = {
  garage: { platform:10, provider:90 },
  garage_premium: { platform:20, provider:80 },
  parts_dealer: { platform:5, provider:95 },
  accessories_shop: { platform:8, provider:92 },
  tyre_shop: { platform:6, provider:94 },
  auto_electrician: { platform:12, provider:88 },
  car_wash: { platform:10, provider:90 },
  panel_beater: { platform:15, provider:85 },
  auto_glass: { platform:12, provider:88 },
}

export default function ProviderDashboard() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ pending:0, confirmed:0, completed:0, earnings:0 })
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [showPolicy, setShowPolicy] = useState(!localStorage.getItem("ccc_policy_acknowledged"))

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("prov-dash")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user.id}` }, () => { load(); toast("Booking updated", { icon:"≡ƒôï" }) })
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

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  return (
    <div>
      {/* Service Guarantee Policy Banner */}
      {showPolicy&&(
        <div style={{ background:"#1a0808", border:"2px solid #e24b4a", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>≡ƒ¢í∩╕Å Important ΓÇö Service Guarantee Policy</div>
          <div style={{ fontSize:12, color:"#888", lineHeight:1.8, marginBottom:"1rem" }}>
            Car Care Connect operates a <strong style={{ color:"#f0ede6" }}>Service Guarantee</strong> for all customers. As a provider, you must be aware of the following:
          </div>
          {[
            { icon:"1∩╕ÅΓâú", text:"If a customer is unhappy with your service, they can submit a Service Guarantee claim within 7 days." },
            { icon:"2∩╕ÅΓâú", text:"If the claim is approved, the full service cost is deducted from your earnings and a voucher is issued to the customer." },
            { icon:"3∩╕ÅΓâú", text:"1st approved claim ΓåÆ Warning + cost deduction." },
            { icon:"4∩╕ÅΓâú", text:"2nd approved claim ΓåÆ 7 day suspension + cost deduction." },
            { icon:"5∩╕ÅΓâú", text:"3rd approved claim ΓåÆ Permanent ban from the platform." },
            { icon:"Γ£à", text:"The best protection is to always deliver excellent, professional service." },
          ].map(item=>(
            <div key={item.icon} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:6 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
              <span style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>{item.text}</span>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:"1rem" }}>
            <button onClick={()=>{ localStorage.setItem("ccc_policy_acknowledged","true"); setShowPolicy(false) }}
              style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
              I understand ΓÇö got it
            </button>
            <button onClick={()=>window.open("/terms","_blank")}
              style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
              Read full policy
            </button>
          </div>
        </div>
      )}

      {/* Permanent policy reminder */}
      {!showPolicy&&(
        <div style={{ background:"#111", border:"1px solid #e24b4a20", borderRadius:10, padding:"0.75rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:11, color:"#555" }}>≡ƒ¢í∩╕Å Service Guarantee active ΓÇö deliver quality service to avoid claims</div>
          <button onClick={()=>setShowPolicy(true)}
            style={{ background:"none", border:"none", color:"#e24b4a", fontSize:11, cursor:"pointer" }}>
            View policy
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:t("pending"), value:stats.pending, color:"#e6821e" },
          { label:"Confirmed", value:stats.confirmed, color:"#378add" },
          { label:t("completed"), value:stats.completed, color:"#1d9e75" },
          { label:"Earnings", value:`KES ${Number(stats.earnings).toLocaleString()}`, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Commission rate banner */}
      <div style={{ background:"#111", border:"1px solid #378add30", borderRadius:10, padding:"0.75rem 1rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>Your commission rate ┬╖ {(profile?.provider_type||"garage").replace(/_/g," ")}</div>
          <div style={{ fontSize:13, color:"#378add", fontWeight:600 }}>
            You earn {COMMISSION_RATES[profile?.provider_type||"garage"]?.provider||90}% ┬╖ Platform takes {COMMISSION_RATES[profile?.provider_type||"garage"]?.platform||10}%
          </div>
        </div>
        <div style={{ fontSize:11, color:"#444" }}>
          {profile?.provider_type==="parts_dealer"?"Lowest platform rate for parts dealers ≡ƒÄë":
           profile?.provider_type==="accessories_shop"?"8% platform rate for accessories":
           profile?.provider_type==="tyre_shop"?"6% platform rate for tyre shops ≡ƒÄë":""}
        </div>
      </div>

      {/* Recent bookings */}
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#f0ede6", marginBottom:"1rem" }}>
        {language==="sw"?"Miadi ya hivi karibuni":"Recent bookings"}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&bookings.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>≡ƒôà</div>
          {language==="sw"?"Hakuna miadi bado":"No bookings yet"}
        </div>
      )}

      {bookings.map(b=>(
        <div key={b.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ flex:1, minWidth:0, marginRight:8 }}>
              <div style={{ fontSize:isMobile?13:14, fontWeight:500, color:"#f0ede6", marginBottom:4 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#555" }}>{b.booking_date} ┬╖ {b.booking_time?.slice(0,5)}</div>
              {b.booking_number&&<div style={{ fontSize:10, color:"#444", marginTop:2 }}>#{b.booking_number}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>
                {b.status}
              </span>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>
                KES {Number(b.total_amount).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {b.status==="pending"&&<>
              <button onClick={()=>updateStatus(b.id,"confirmed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {language==="sw"?"Thibitisha":"Confirm"}
              </button>
              <button onClick={()=>updateStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {language==="sw"?"Kataa":"Decline"}
              </button>
            </>}
            {b.status==="confirmed"&&(
              <button onClick={()=>updateStatus(b.id,"in-progress")} style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {language==="sw"?"Anza huduma":"Start"}
              </button>
            )}
            {b.status==="in-progress"&&(
              <button onClick={()=>updateStatus(b.id,"completed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {language==="sw"?"Kamilisha":"Complete"}
              </button>
            )}
            <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
              style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {expanded===b.id?t("less"):t("details")}
            </button>
          </div>

          {expanded===b.id&&(
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1e1e1e" }}>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8 }}>
                {[
                  { l:language==="sw"?"Mapato yako":"Your earnings", v:`KES ${Number(b.provider_earnings||0).toFixed(0)}`, c:"#1d9e75" },
                  { l:"Platform fee", v:`KES ${Number(b.platform_commission||0).toFixed(0)}` },
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


