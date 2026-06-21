import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminPromos() {
  const isMobile = useIsMobile()
  const [promos, setPromos] = useState([])
  const [form, setForm] = useState({ code:"", description:"", discount_type:"percentage", discount_value:"", min_purchase:"0", usage_limit:"100", valid_until:"" })
  const [loading, setLoading] = useState(true)
  const [distributePanel, setDistributePanel] = useState(null)
  const [audience, setAudience] = useState("all")
  const [searchPhone, setSearchPhone] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at",{ascending:false})
    setPromos(data||[])
    setLoading(false)
  }

  async function create(e) {
    e.preventDefault()
    if (form.discount_type==="percentage" && Number(form.discount_value) > 100) {
      return toast.error("Percentage discount cannot exceed 100%")
    }
    if (Number(form.discount_value) <= 0) {
      return toast.error("Discount value must be greater than 0")
    }
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

  async function distributePromo(promo) {
    setSending(true)
    try {
      let userIds = []

      if (audience === "all") {
        const { data } = await supabase.from("profiles").select("id").eq("role","customer")
        userIds = (data||[]).map(p=>p.id)
      } else if (audience === "inactive") {
        const cutoff = new Date(Date.now()-30*24*60*60*1000).toISOString()
        const { data } = await supabase.from("profiles").select("id").eq("role","customer").lt("updated_at", cutoff)
        userIds = (data||[]).map(p=>p.id)
      } else if (audience === "specific") {
        if (!searchPhone.trim()) { toast.error("Enter a phone or email to search"); setSending(false); return }
        const { data: sens } = await supabase.from("profile_sensitive").select("id").or(`phone.ilike.%${searchPhone.trim()}%,email.ilike.%${searchPhone.trim()}%`)
        userIds = (sens||[]).map(s=>s.id)
        if (userIds.length === 0) { toast.error("No matching customer found"); setSending(false); return }
      }

      if (userIds.length === 0) { toast.error("No recipients found for this audience"); setSending(false); return }

      if (!confirm(`Send promo ${promo.code} to ${userIds.length} customer${userIds.length!==1?"s":""}?`)) { setSending(false); return }

      const discountText = promo.discount_type==="percentage" ? `${promo.discount_value}% off` : `KES ${promo.discount_value} off`
      await supabase.from("notifications").insert(userIds.map(uid => ({
        user_id: uid,
        title: "Special offer just for you! 🎉",
        message: `Use code ${promo.code} for ${discountText} your next booking${promo.min_purchase>0?` (min KES ${promo.min_purchase})`:""}${promo.valid_until?`. Valid until ${new Date(promo.valid_until).toLocaleDateString()}`:""}.`,
        type: "info"
      })))

      toast.success(`Promo sent to ${userIds.length} customer${userIds.length!==1?"s":""}!`)
      setDistributePanel(null)
      setSearchPhone("")
      setAudience("all")
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  async function deletePromo(id) {
    if (!confirm("Delete this promo code?")) return
    await supabase.from("promo_codes").delete().eq("id",id)
    toast.success("Promo deleted")
    load()
  }

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:10, fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      {loading && <div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {promos.map(p => (
        <div key={p.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>{p.code}</div>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:p.is_active?"#f0fdf4":"#f5f5f5", color:p.is_active?"#1d9e75":"#555" }}>
                {p.is_active?"Active":"Inactive"}
              </span>
            </div>
            <div style={{ fontSize:11, color:"#888" }}>
              {p.discount_type==="percentage"?`${p.discount_value}% off`:`KES ${p.discount_value} off`}
              {p.min_purchase>0&&` · min KES ${p.min_purchase}`}
              {` · ${p.used_count}/${p.usage_limit} used`}
              {p.valid_until&&` · expires ${new Date(p.valid_until).toLocaleDateString()}`}
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>setDistributePanel(distributePanel===p.id?null:p.id)} style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              📤 Distribute
            </button>
            <button onClick={()=>togglePromo(p.id,p.is_active)} style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {p.is_active?"Disable":"Enable"}
            </button>
            <button onClick={()=>deletePromo(p.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              Delete
            </button>
          </div>
          {distributePanel===p.id&&(
            <div style={{ background:"#fff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginTop:10, width:"100%" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#000", marginBottom:8 }}>Send {p.code} to:</div>
              <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                {[{k:"all",l:"All customers"},{k:"inactive",l:"Inactive 30+ days"},{k:"specific",l:"Specific customer"}].map(a=>(
                  <button key={a.k} onClick={()=>setAudience(a.k)}
                    style={{ padding:"6px 12px", borderRadius:6, border:"none", fontSize:11, cursor:"pointer", background:audience===a.k?"#e6821e":"#f0f0f0", color:audience===a.k?"#fff":"#666" }}>
                    {a.l}
                  </button>
                ))}
              </div>
              {audience==="specific"&&(
                <input value={searchPhone} onChange={e=>setSearchPhone(e.target.value)} placeholder="Search by phone or email"
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#000", outline:"none", marginBottom:10, boxSizing:"border-box" }}/>
              )}
              <button onClick={()=>distributePromo(p)} disabled={sending}
                style={{ background:sending?"#ccc":"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:sending?"not-allowed":"pointer" }}>
                {sending?"Sending...":"Send notification"}
              </button>
            </div>
          )}
        </div>
      ))}
      {!loading && promos.length===0 && <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No promo codes yet</div>}

      <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1.25rem", marginTop:"1.5rem" }}>
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
            <div><label style={lbl}>Min purchase (KES)</label><input style={inp} type="number" min="0" value={form.min_purchase} onChange={e=>setForm(f=>({...f,min_purchase:e.target.value}))} /></div>
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





