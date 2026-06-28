import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const DAY_ICONS = ["🌅","💼","💼","💼","💼","💼","🎉"]

const DEFAULT_HOURS = DAYS.map((day, i) => ({
  day_of_week: i,
  day_name: day,
  is_open: i >= 1 && i <= 6,
  open_time: "08:00",
  close_time: "18:00"
}))

const PRESETS = [
  { label:"Mon–Fri", icon:"💼", apply:(hours)=>hours.map((d,i)=>({...d,is_open:i>=1&&i<=5,open_time:"08:00",close_time:"18:00"})) },
  { label:"Mon–Sat", icon:"📅", apply:(hours)=>hours.map((d,i)=>({...d,is_open:i>=1&&i<=6,open_time:"08:00",close_time:"18:00"})) },
  { label:"7 Days", icon:"🗓️", apply:(hours)=>hours.map(d=>({...d,is_open:true,open_time:"08:00",close_time:"18:00"})) },
  { label:"Half day", icon:"☀️", apply:(hours)=>hours.map((d,i)=>({...d,is_open:i>=1&&i<=6,open_time:"08:00",close_time:"13:00"})) },
]

export default function ProviderBusinessHours() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [closures, setClosures] = useState([])
  const [closureForm, setClosureForm] = useState({ closure_date:"", reason:"" })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("hours")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: bh }, { data: bc }] = await Promise.all([
      supabase.from("business_hours").select("*").eq("provider_id", user.id).order("day_of_week"),
      supabase.from("business_closures").select("*").eq("provider_id", user.id).order("closure_date")
    ])
    if (bh && bh.length > 0) {
      setHours(DEFAULT_HOURS.map(d => {
        const saved = bh.find(h => h.day_of_week === d.day_of_week)
        return saved ? { ...d, is_open:saved.is_open, open_time:saved.open_time?.slice(0,5)||"08:00", close_time:saved.close_time?.slice(0,5)||"18:00" } : d
      }))
    }
    setClosures(bc||[])
    setLoading(false)
  }

  function updateDay(dayIndex, field, value) {
    setHours(h => h.map((d,i) => i===dayIndex ? {...d, [field]:value} : d))
  }

  function applyPreset(preset) {
    setHours(preset.apply(hours))
    toast.success("Preset applied — tap Save to confirm")
  }

  async function saveHours(e) {
    e.preventDefault()
    setSaving(true)
    try {
      for (const day of hours) {
        await supabase.from("business_hours").upsert({
          provider_id: user.id,
          day_of_week: day.day_of_week,
          is_open: day.is_open,
          open_time: day.open_time,
          close_time: day.close_time
        }, { onConflict: "provider_id,day_of_week" })
      }
      toast.success("Business hours saved! ✓")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function addClosure(e) {
    e.preventDefault()
    const { error } = await supabase.from("business_closures").insert({
      provider_id: user.id,
      closure_date: closureForm.closure_date,
      reason: closureForm.reason || null
    })
    if (error) return toast.error(error.message)
    toast.success("Closure date added")
    setClosureForm({ closure_date:"", reason:"" })
    load()
  }

  async function deleteClosure(id) {
    await supabase.from("business_closures").delete().eq("id", id).eq("provider_id", user.id)
    toast.success("Closure removed")
    load()
  }

  const openDays = hours.filter(d=>d.is_open).length

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>Business Hours</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.5rem" }}>Set when customers can book your services</div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[{k:"hours",l:"⏰ Hours"},{k:"closures",l:`🚫 Closures (${closures.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 18px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#378add":"#f0f0f0", color:tab===t.k?"#fff":"#666", fontFamily:"DM Sans,sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="hours"&&(
        <form onSubmit={saveHours}>
          {/* Summary pill */}
          <div style={{ background:"linear-gradient(135deg,#378add,#5ba3f5)", borderRadius:12, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#fff" }}>{openDays} days open</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>
                {hours.filter(d=>d.is_open).map(d=>DAY_SHORT[d.day_of_week]).join(" · ")}
              </div>
            </div>
            <div style={{ fontSize:36 }}>🕐</div>
          </div>

          {/* Quick presets */}
          <div style={{ marginBottom:"1.25rem" }}>
            <div style={{ fontSize:11, color:"#888", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Quick presets</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {PRESETS.map(p=>(
                <button key={p.label} type="button" onClick={()=>applyPreset(p)}
                  style={{ background:"#f0f7ff", border:"1px solid #378add30", borderRadius:8, color:"#378add", fontSize:12, fontWeight:600, padding:"7px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Days */}
          {loading&&<div style={{ color:"#777", fontSize:13 }}>Loading...</div>}
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:14, overflow:"hidden", marginBottom:"1.25rem" }}>
            {hours.map((day, i) => (
              <div key={day.day_of_week} style={{ padding:"0.9rem 1.1rem", borderBottom:i<6?"1px solid #f5f5f5":"none", background:day.is_open?"#ffffff":"#fafafa" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {/* Day toggle */}
                  <div style={{ width:36, height:36, borderRadius:10, background:day.is_open?"#378add":"#e0e0e0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0, transition:"background 0.2s" }}>
                    {day.is_open?DAY_ICONS[i]:"—"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:day.is_open?700:400, color:day.is_open?"#000":"#999", marginBottom:2 }}>{day.day_name}</div>
                    {day.is_open&&(
                      <div style={{ fontSize:11, color:"#378add" }}>{day.open_time} – {day.close_time}</div>
                    )}
                    {!day.is_open&&<div style={{ fontSize:11, color:"#bbb" }}>Closed</div>}
                  </div>
                  {/* Toggle switch */}
                  <label style={{ position:"relative", width:44, height:24, flexShrink:0, cursor:"pointer" }}>
                    <input type="checkbox" checked={day.is_open} onChange={e=>updateDay(i,"is_open",e.target.checked)} style={{ opacity:0, width:0, height:0, position:"absolute" }}/>
                    <div style={{ position:"absolute", inset:0, background:day.is_open?"#378add":"#ddd", borderRadius:12, transition:"background 0.2s" }}>
                      <div style={{ position:"absolute", top:2, left:day.is_open?22:2, width:20, height:20, background:"#fff", borderRadius:"50%", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                    </div>
                  </label>
                </div>
                {/* Time inputs - shown when open */}
                {day.is_open&&(
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, paddingLeft:48 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#888", marginBottom:3 }}>Opens</div>
                      <input type="time" value={day.open_time} onChange={e=>updateDay(i,"open_time",e.target.value)}
                        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px 10px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                    </div>
                    <div style={{ fontSize:12, color:"#888", marginTop:16 }}>→</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#888", marginBottom:3 }}>Closes</div>
                      <input type="time" value={day.close_time} onChange={e=>updateDay(i,"close_time",e.target.value)}
                        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px 10px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}
            style={{ width:"100%", background:saving?"#ccc":"linear-gradient(135deg,#378add,#5ba3f5)", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:saving?"not-allowed":"pointer", boxShadow:"0 4px 12px rgba(55,138,221,0.3)" }}>
            {saving?"Saving...":"✓ Save Business Hours"}
          </button>
        </form>
      )}

      {tab==="closures"&&(
        <div>
          {/* Add closure form */}
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:14, padding:"1.25rem", marginBottom:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:"1rem" }}>🚫 Add closure date</div>
            <form onSubmit={addClosure}>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Date *</label>
                <input type="date" value={closureForm.closure_date} onChange={e=>setClosureForm(f=>({...f,closure_date:e.target.value}))} required
                  min={new Date().toISOString().split("T")[0]}
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Reason (optional)</label>
                <input placeholder="e.g. Public holiday, Staff training, Annual leave" value={closureForm.reason} onChange={e=>setClosureForm(f=>({...f,reason:e.target.value}))}
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
              </div>
              <button type="submit"
                style={{ width:"100%", background:"#e24b4a", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                + Add closure date
              </button>
            </form>
          </div>

          {/* Closures list */}
          {closures.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888", fontSize:13 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
              No closures set — you are open on all your scheduled days
            </div>
          )}
          {closures.map(c=>(
            <div key={c.id} style={{ background:"#ffffff", border:"1px solid #e24b4a20", borderRadius:12, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, background:"#fff5f5", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🚫</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>
                  {new Date(c.closure_date+"T00:00:00").toLocaleDateString("default",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                </div>
                {c.reason&&<div style={{ fontSize:11, color:"#888", marginTop:2 }}>📝 {c.reason}</div>}
              </div>
              <button onClick={()=>deleteClosure(c.id)} style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:11, fontWeight:600, padding:"6px 12px", cursor:"pointer" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}