import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminPromos() {
  const isMobile = useIsMobile()
  const [promos, setPromos] = useState([])
  const [form, setForm] = useState({ code:"", description:"", discount_type:"percentage", discount_value:"", min_purchase:"0", usage_limit:"100", valid_until:"" })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at",{ascending:false})
    setPromos(data||[])
    setLoading(false)
  }

  async function create(e) {
    e.preventDefault()
    const { error } = await supabase.from("promo_codes").insert({
      code: form.code.toUpperCase(),
      description: form.description,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_purchase: Number(form.min_purchase),
      usage_limit: Number(form.usage_limit),
      valid_until: form.valid_until || null,
      is_active: true,
    })
    if (error) return toast.error(error.message)
    toast.success("Promo code created")
    setForm({ code:"", description:"", discount_type:"percentage", discount_value:"", min_purchase:"0", usage_limit:"100", valid_until:"" })
    load()
  }

  async function togglePromo(id, is_active) {
    await supabase.from("promo_codes").update({ is_active:!is_active }).eq("id",id)
    load()
  }

  async function deletePromo(id) {
    if (!confirm("Delete this promo code?")) return
    await supabase.from("promo_codes").delete().eq("id",id)
    toast.success("Promo deleted")
    load()
  }

  const inp = { width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", marginBottom:10, fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      {loading && <div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {promos.map(p => (
        <div key={p.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>{p.code}</div>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:p.is_active?"#071a12":"#1a1a1a", color:p.is_active?"#1d9e75":"#555" }}>
                {p.is_active?"Active":"Inactive"}
              </span>
            </div>
            <div style={{ fontSize:11, color:"#555" }}>
              {p.discount_type==="percentage"?`${p.discount_value}% off`:`$${p.discount_value} off`}
              {p.min_purchase>0&&` · min $${p.min_purchase}`}
              {` · ${p.used_count}/${p.usage_limit} used`}
              {p.valid_until&&` · expires ${new Date(p.valid_until).toLocaleDateString()}`}
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>togglePromo(p.id,p.is_active)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {p.is_active?"Disable":"Enable"}
            </button>
            <button onClick={()=>deletePromo(p.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              Delete
            </button>
          </div>
        </div>
      ))}
      {!loading && promos.length===0 && <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No promo codes yet</div>}

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1.25rem", marginTop:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem" }}>Create promo code</div>
        <form onSubmit={create}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div><label style={lbl}>Code</label><input style={inp} placeholder="SAVE20" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} required /></div>
            <div><label style={lbl}>Discount type</label>
              <select style={inp} value={form.discount_type} onChange={e=>setForm(f=>({...f,discount_type:e.target.value}))}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div><label style={lbl}>Value</label><input style={inp} type="number" min="0" placeholder="20" value={form.discount_value} onChange={e=>setForm(f=>({...f,discount_value:e.target.value}))} required /></div>
            <div><label style={lbl}>Min purchase ($)</label><input style={inp} type="number" min="0" value={form.min_purchase} onChange={e=>setForm(f=>({...f,min_purchase:e.target.value}))} /></div>
            <div><label style={lbl}>Usage limit</label><input style={inp} type="number" min="1" value={form.usage_limit} onChange={e=>setForm(f=>({...f,usage_limit:e.target.value}))} /></div>
            <div><label style={lbl}>Expires (optional)</label><input style={inp} type="date" value={form.valid_until} onChange={e=>setForm(f=>({...f,valid_until:e.target.value}))} /></div>
          </div>
          <div><label style={lbl}>Description</label><input style={inp} placeholder="e.g. 20% off first booking" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          <button type="submit" style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
            Create promo code
          </button>
        </form>
      </div>
    </div>
  )
}


