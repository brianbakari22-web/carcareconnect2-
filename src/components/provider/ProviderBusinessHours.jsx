import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

const DEFAULT_HOURS = DAYS.map((day, i) => ({
  day_of_week: i,
  day_name: day,
  is_open: i >= 1 && i <= 6,
  open_time: "08:00",
  close_time: "18:00"
}))

export default function ProviderBusinessHours() {
  const { user } = useAuth()
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
      toast.success("Business hours saved")
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

  const inp = { background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"7px 10px", color:"#000000", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem" }}>
        {[{k:"hours",l:"Business hours"},{k:"closures",l:`Closures (${closures.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#378add":"#555555", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="hours"&&(
        <form onSubmit={saveHours}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Operating hours</div>
            {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
            {hours.map((day, i) => (
              <div key={day.day_of_week} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #eeeeee" }}>
                <div style={{ width:90, fontSize:13, color:day.is_open?"#000000":"#555", fontWeight:day.is_open?500:400 }}>{day.day_name}</div>
                <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                  <input type="checkbox" checked={day.is_open} onChange={e=>updateDay(i,"is_open",e.target.checked)}/>
                  <span style={{ fontSize:12, color:day.is_open?"#1d9e75":"#555" }}>{day.is_open?"Open":"Closed"}</span>
                </label>
                {day.is_open&&(
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
                    <input type="time" value={day.open_time} onChange={e=>updateDay(i,"open_time",e.target.value)} style={inp}/>
                    <span style={{ fontSize:12, color:"#777777" }}>to</span>
                    <input type="time" value={day.close_time} onChange={e=>updateDay(i,"close_time",e.target.value)} style={inp}/>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={saving}
            style={{ background:saving?"#555555":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Saving...":"Save hours"}
          </button>
        </form>
      )}

      {tab==="closures"&&(
        <div>
          {closures.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No closures set</div>}
          {closures.map(c=>(
            <div key={c.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, background:"#fff5f5", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>≡🕐</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>
                  {new Date(c.closure_date+"T00:00:00").toLocaleDateString("default",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                </div>
                {c.reason&&<div style={{ fontSize:11, color:"#777777", marginTop:2 }}>{c.reason}</div>}
              </div>
              <button onClick={()=>deleteClosure(c.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Remove</button>
            </div>
          ))}

          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginTop:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Add closure date</div>
            <form onSubmit={addClosure}>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Date</label>
                <input type="date" value={closureForm.closure_date} onChange={e=>setClosureForm(f=>({...f,closure_date:e.target.value}))} required
                  min={new Date().toISOString().split("T")[0]}
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }}/>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Reason (optional)</label>
                <input placeholder="e.g. Public holiday, Staff training" value={closureForm.reason} onChange={e=>setClosureForm(f=>({...f,reason:e.target.value}))}
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
              </div>
              <button type="submit"
                style={{ background:"#378add", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
                Add closure
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}



