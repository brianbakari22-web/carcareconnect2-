import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function ProviderBundles() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [bundles, setBundles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:"", description:"", service_ids:[], bundle_price:"" })

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: svcs }, { data: bds }] = await Promise.all([
      supabase.from("services").select("*").eq("provider_id", user.id).eq("is_active", true),
      supabase.from("service_bundles").select("*").eq("provider_id", user.id).order("created_at",{ascending:false})
    ])
    setServices(svcs||[])
    setBundles(bds||[])
    setLoading(false)
  }

  function toggleService(id) {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id) 
        ? f.service_ids.filter(s=>s!==id) 
        : [...f.service_ids, id]
    }))
  }

  function originalTotal() {
    return form.service_ids.reduce((sum, id) => {
      const s = services.find(sv=>sv.id===id)
      return sum + (s ? Number(s.price) : 0)
    }, 0)
  }

  function weightedCommissionRate() {
    const total = originalTotal()
    if (total === 0) return 0.10
    const weightedSum = form.service_ids.reduce((sum, id) => {
      const s = services.find(sv=>sv.id===id)
      if (!s) return sum
      const rate = Number(s.platform_commission_rate || 0.10)
      return sum + (Number(s.price) * rate)
    }, 0)
    return weightedSum / total
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name || form.service_ids.length < 2 || !form.bundle_price) {
      return toast.error("Name, at least 2 services, and bundle price required")
    }
    const origTotal = originalTotal()
    if (Number(form.bundle_price) >= origTotal) {
      return toast.error("Bundle price must be less than the total of individual services (KES " + origTotal.toLocaleString() + ")")
    }
    setSaving(true)
    try {
      const { error } = await supabase.from("service_bundles").insert({
        provider_id: user.id,
        name: form.name,
        description: form.description,
        service_ids: form.service_ids,
        bundle_price: Number(form.bundle_price),
        original_price: origTotal,
        platform_commission_rate: weightedCommissionRate(),
        is_active: true,
      })
      if (error) throw error
      toast.success("Bundle created!")
      setForm({ name:"", description:"", service_ids:[], bundle_price:"" })
      setShowForm(false)
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id, is_active) {
    await supabase.from("service_bundles").update({ is_active: !is_active }).eq("id", id)
    toast.success(is_active ? "Bundle deactivated" : "Bundle activated")
    load()
  }

  async function deleteBundle(id) {
    if (!confirm("Delete this bundle?")) return
    await supabase.from("service_bundles").delete().eq("id", id)
    toast.success("Bundle deleted")
    load()
  }

  const lbl = { display:"block", fontSize:12, color:"#666", marginBottom:4, fontWeight:600 }
  const inp = { width:"100%", background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif" }

  if (services.length < 2) {
    return (
      <div>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:8 }}>Service Bundles</div>
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"1rem", fontSize:13, color:"#e6821e" }}>
          You need at least 2 active services to create a bundle. Add more services first.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800 }}>Service Bundles</div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
          {showForm?"Cancel":"+ New Bundle"}
        </button>
      </div>

      <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>
        Bundle 2+ services together at a discounted price. Customers save money, you get more bookings.
      </div>

      {showForm&&(
        <form onSubmit={save} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:"1rem" }}>
          <label style={lbl}>Bundle name</label>
          <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Full Service Package" style={inp}/>

          <label style={lbl}>Description (optional)</label>
          <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What's included" style={inp}/>

          <label style={lbl}>Select services to include (choose 2+)</label>
          <div style={{ marginBottom:"1rem" }}>
            {services.map(s=>(
              <label key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #eeeeee", cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={()=>toggleService(s.id)}/>
                <span style={{ flex:1 }}>{s.name}</span>
                <span style={{ color:"#888" }}>KES {Number(s.price).toLocaleString()}</span>
              </label>
            ))}
          </div>

          {form.service_ids.length>=2&&(
            <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, padding:"0.75rem", marginBottom:"1rem", fontSize:12 }}>
              Individual total: <strong>KES {originalTotal().toLocaleString()}</strong>
            </div>
          )}

          <label style={lbl}>Bundle price (KES) — must be less than individual total</label>
          <input type="number" value={form.bundle_price} onChange={e=>setForm({...form,bundle_price:e.target.value})} placeholder="e.g. 6500" style={inp}/>

          <button type="submit" disabled={saving}
            style={{ background:saving?"#ccc":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Creating...":"Create bundle"}
          </button>
        </form>
      )}

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&bundles.length===0&&!showForm&&(
        <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1.5rem", textAlign:"center", color:"#888", fontSize:13 }}>
          No bundles yet. Create one to offer discounted packages!
        </div>
      )}
      {bundles.map(b=>{
        const savings = Number(b.original_price) - Number(b.bundle_price)
        const savingsPct = Math.round((savings / Number(b.original_price)) * 100)
        return (
          <div key={b.id} style={{ background:"#f8f8f8", border:`1px solid ${!b.is_active?"#e24b4a20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:6 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#000" }}>{b.name}</div>
                {b.description&&<div style={{ fontSize:11, color:"#888", marginTop:2 }}>{b.description}</div>}
              </div>
              {!b.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 6px", borderRadius:10 }}>Inactive</span>}
            </div>
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:13, color:"#888", textDecoration:"line-through" }}>KES {Number(b.original_price).toLocaleString()}</span>
              <span style={{ fontSize:16, fontWeight:800, color:"#1d9e75" }}>KES {Number(b.bundle_price).toLocaleString()}</span>
              <span style={{ fontSize:11, color:"#1d9e75", background:"#f0fdf4", padding:"2px 8px", borderRadius:10 }}>Save {savingsPct}%</span>
            </div>
            {b.platform_commission_rate&&(
              <div style={{ fontSize:10, color:"#888", marginBottom:8 }}>
                Platform commission: {(b.platform_commission_rate*100).toFixed(1)}% (KES {(Number(b.bundle_price)*Number(b.platform_commission_rate)).toFixed(0)}) · You earn: KES {(Number(b.bundle_price)*(1-Number(b.platform_commission_rate))).toFixed(0)}
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>toggleActive(b.id,b.is_active)} style={{ background:b.is_active?"#fff5f5":"#f0fdf4", border:`1px solid ${b.is_active?"#e24b4a40":"#1d9e7540"}`, borderRadius:7, color:b.is_active?"#e24b4a":"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                {b.is_active?"Deactivate":"Activate"}
              </button>
              <button onClick={()=>deleteBundle(b.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
