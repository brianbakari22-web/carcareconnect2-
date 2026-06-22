import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminSettings() {
  const isMobile = useIsMobile()
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ value:"", description:"" })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase.from("app_settings").select("*").order("label")
    if (error) console.error("Settings load error:", error)
    setSettings(data||[])
    setLoading(false)
  }

  function startEdit(s) {
    setEditing(s.id)
    setForm({ value: s.value, description: s.description||"" })
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const { error } = await supabase.from("app_settings").update({
        value: form.value,
        description: form.description,
        updated_at: new Date().toISOString()
      }).eq("id", editing)
      if (error) throw error
      toast.success("Setting updated!")
      setEditing(null)
      load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  function formatValue(setting) {
    if (setting.type === "currency") return `KES ${Number(setting.value).toLocaleString()}`
    if (setting.type === "percentage") return `${setting.value}%`
    return setting.value
  }

  const ICONS = {
    inspection_fee: "🔍",
    featured_listing_week_price: "⭐",
    min_payout_amount: "💰",
    go_callout_fee: "🚨",
    marketplace_processing_fee_rate: "💳",
  }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000", marginBottom:4 }}>Platform Settings</div>
      <div style={{ fontSize:12, color:"#888", marginBottom:"1.5rem" }}>Configure fees, rates and platform-wide settings</div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total settings", value:settings.length },
          { label:"Last updated", value:settings.length>0?new Date(Math.max(...settings.map(s=>new Date(s.updated_at)))).toLocaleDateString():"—" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#000000" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {settings.map(s=>(
        <div key={s.id} style={{ background:"#f8f8f8", border:`1px solid ${editing===s.id?"#8b5cf6":"#eeeeee"}`, borderRadius:12, padding:"1rem", marginBottom:10, transition:"border-color 0.2s" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:editing===s.id?12:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                {ICONS[s.key]||"⚙️"}
              </div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000" }}>{s.label}</div>
                <div style={{ fontSize:11, color:"#888" }}>{s.description}</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {editing!==s.id&&(
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>{formatValue(s)}</div>
                  <div style={{ fontSize:10, color:"#888", textTransform:"uppercase" }}>{s.type}</div>
                </div>
              )}
              <button onClick={()=>editing===s.id?setEditing(null):startEdit(s)}
                style={{ background:editing===s.id?"#e0e0e0":"#f8f8f8", border:`1px solid ${editing===s.id?"#555":"#e0e0e0"}`, borderRadius:8, color:editing===s.id?"#888":"#e6821e", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                {editing===s.id?"Cancel":"Edit"}
              </button>
            </div>
          </div>

          {editing===s.id&&(
            <div>
              <label style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>
                {s.type==="currency"?"Value (KES)":s.type==="percentage"?"Value (%)":"Value"}
              </label>
              <input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #dddddd", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:10 }}/>
              <label style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Description</label>
              <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #dddddd", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:10 }}/>
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.6rem 0.75rem", marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#e6821e" }}>
                  {s.type==="currency"?`Customers will be charged KES ${Number(form.value||0).toLocaleString()}`:
                   s.type==="percentage"?`Rate will be ${form.value}%`:
                   `Value will be set to: ${form.value}`}
                </div>
              </div>
              <button onClick={save} disabled={saving}
                style={{ background:saving?"#e0e0e0":"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":"Save changes"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
