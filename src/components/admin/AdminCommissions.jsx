import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const PROVIDER_TYPES = [
  { key:"garage", label:"Garage / Mechanic", icon:"🔧" },
  { key:"garage_premium", label:"Mobile Mechanic", icon:"🚗" },
  { key:"parts_dealer", label:"Parts Dealer", icon:"⚙️" },
  { key:"accessories_shop", label:"Accessories Shop", icon:"✨" },
  { key:"tyre_shop", label:"Tyre Shop", icon:"🛞" },
  { key:"auto_electrician", label:"Auto Electrician", icon:"⚡" },
  { key:"car_wash", label:"Car Wash", icon:"🚿" },
  { key:"panel_beater", label:"Panel Beater", icon:"🔨" },
  { key:"auto_glass", label:"Auto Glass", icon:"🪟" },
  { key:"go_service", label:"GO Service", icon:"🚨" },
]

export default function AdminCommissions() {
  const isMobile = useIsMobile()
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ platform_rate:"", provider_rate:"", description:"" })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("commission_rates").select("*").order("provider_type")
    setRates(data||[])
    setLoading(false)
  }

  function startEdit(rate) {
    setEditing(rate.id)
    setForm({
      platform_rate: (rate.platform_rate*100).toString(),
      provider_rate: (rate.provider_rate*100).toString(),
      description: rate.description||""
    })
  }

  async function save() {
    if (!editing) return
    const platform = parseFloat(form.platform_rate)/100
    const provider = parseFloat(form.provider_rate)/100
    if (Math.abs(platform + provider - 1) > 0.001) {
      return toast.error("Platform + Provider rates must add up to 100%")
    }
    setSaving(true)
    try {
      const { error } = await supabase.from("commission_rates").update({
        platform_rate: platform,
        provider_rate: provider,
        description: form.description,
      }).eq("id", editing)
      if (error) throw error
      toast.success("Commission rate updated!")
      setEditing(null)
      load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const totalRevenue = rates.reduce((s,r) => s + (r.platform_rate*100), 0) / rates.length

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Commission Rates</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>Manage platform and provider revenue splits for each business type</div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Provider types", value:rates.length, color:"#378add" },
          { label:"Avg platform cut", value:`${totalRevenue.toFixed(1)}%`, color:"#e6821e" },
          { label:"Avg provider keep", value:`${(100-totalRevenue).toFixed(1)}%`, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"0.75rem", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      {rates.map(rate=>{
        const typeInfo = PROVIDER_TYPES.find(t=>t.key===rate.provider_type)||{ icon:"🔧", label:rate.provider_type }
        const isEditing = editing===rate.id
        return (
          <div key={rate.id} style={{ background:"#111", border:`1px solid ${isEditing?"#8b5cf6":"#1e1e1e"}`, borderRadius:12, padding:"1rem", marginBottom:10, transition:"border-color 0.2s" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:isEditing?12:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                  {typeInfo.icon}
                </div>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6" }}>{typeInfo.label}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{rate.description}</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {!isEditing&&(
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>Provider keeps {(rate.provider_rate*100).toFixed(0)}%</div>
                    <div style={{ fontSize:11, color:"#e6821e" }}>Platform earns {(rate.platform_rate*100).toFixed(0)}%</div>
                  </div>
                )}
                <button onClick={()=>isEditing?setEditing(null):startEdit(rate)}
                  style={{ background:isEditing?"#333":"#111", border:`1px solid ${isEditing?"#555":"#333"}`, borderRadius:8, color:isEditing?"#888":"#e6821e", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                  {isEditing?"Cancel":"Edit"}
                </button>
              </div>
            </div>

            {isEditing&&(
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Platform % (e.g. 10)</label>
                    <input type="number" min="0" max="100" step="0.5" value={form.platform_rate}
                      onChange={e=>{ setForm(f=>({...f, platform_rate:e.target.value, provider_rate:(100-parseFloat(e.target.value||0)).toString()})) }}
                      style={{ width:"100%", background:"#0f0f0f", border:"1px solid #333", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none" }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Provider % (auto)</label>
                    <input type="number" min="0" max="100" step="0.5" value={form.provider_rate}
                      onChange={e=>setForm(f=>({...f, provider_rate:e.target.value}))}
                      style={{ width:"100%", background:"#0f0f0f", border:"1px solid #333", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none" }}/>
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Description</label>
                  <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                    style={{ width:"100%", background:"#0f0f0f", border:"1px solid #333", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none" }}/>
                </div>
                <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem", marginBottom:10, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:"#555" }}>Total must equal 100%</span>
                  <span style={{ fontSize:12, color:(parseFloat(form.platform_rate||0)+parseFloat(form.provider_rate||0))===100?"#1d9e75":"#e24b4a", fontWeight:600 }}>
                    {parseFloat(form.platform_rate||0)+parseFloat(form.provider_rate||0)}%
                  </span>
                </div>
                <button onClick={save} disabled={saving}
                  style={{ background:saving?"#333":"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                  {saving?"Saving...":"Save changes"}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
